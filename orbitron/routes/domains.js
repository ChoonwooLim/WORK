/**
 * Custom Domain — multi-tenant "bring your own domain" feature.
 *
 * Flow:
 *   1. User enters a domain (e.g. app.example.com) in the dashboard.
 *   2. UI shows DNS instructions — either A record → <public-ip>, or CNAME → <sub>.twinverse.org.
 *      Any DNS that actually resolves to this server's public IP is accepted.
 *   3. POST /api/projects/:id/domain/verify checks that the domain's IP matches ours.
 *   4. POST /api/projects/:id/domain/connect verifies, then issues a Let's Encrypt cert via
 *      certbot webroot (HTTP-01), updates the DB, regenerates nginx config (HTTP + HTTPS blocks),
 *      and reloads nginx.
 *   5. GET /api/projects/:id/domain/status returns DNS + cert status.
 *   6. DELETE /api/projects/:id/domain revokes the cert and removes the custom-domain binding.
 *
 * The old Cloudflare-tunnel-route path is NOT used here, because that requires the target
 * domain to be in *our* Cloudflare account — which it won't be for external users' domains.
 */

const express = require('express');
const router = express.Router();
const dns = require('dns').promises;
const { domainToASCII } = require('url');
const db = require('../db/db');
const { decrypt } = require('../db/crypto');
const nginxService = require('../services/nginx');
const letsencrypt = require('../services/letsencrypt');
const publicIp = require('../services/publicIp');

// All reads go through publicIp:
//   - publicIp.get()     → async, will retry fresh if cache is empty
//   - publicIp.getSync() → sync, returns cached-or-null immediately (fine for responses)

async function getProjectForUser(projectId, user) {
    if (user.role === 'admin' || user.role === 'superadmin') {
        return db.queryOne('SELECT * FROM projects WHERE id = $1', [projectId]);
    }
    return db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, user.userId]);
}

function decryptEnvIfString(project) {
    if (project?.env_vars && typeof project.env_vars === 'string') {
        try { project.env_vars = JSON.parse(decrypt(project.env_vars)) || {}; }
        catch { project.env_vars = {}; }
    }
    return project;
}

// Normalize a hostname to ASCII-compatible Punycode form. Accepts IDNs like
// "한글.com" → "xn--bj0bj06e.com". Returns '' if the input is unparseable (WHATWG
// domainToASCII returns empty string on failure).
function toAscii(domain) {
    if (!domain) return '';
    try { return domainToASCII(String(domain).trim().toLowerCase()); }
    catch { return ''; }
}

function isValidDomain(domain) {
    // Validate AFTER Punycode normalization so IDNs like "한글.com" pass.
    const ascii = toAscii(domain);
    if (!ascii || ascii.length > 253) return false;
    return /^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})*\.[a-z]{2,}$/.test(ascii);
}

// Normalize a user-supplied string that may be one domain OR a comma/space/newline-
// separated list into a Punycode-ASCII, deduped array. IDN input like "한글.com" is
// converted so nginx server_name, cert CN, and DNS lookups all see the ASCII form.
function parseDomainList(input) {
    if (!input) return [];
    const seen = new Set();
    const out = [];
    for (const raw of String(input).split(/[\s,]+/)) {
        const d = toAscii(raw);
        if (d && !seen.has(d)) { seen.add(d); out.push(d); }
    }
    return out;
}

/**
 * Build a list of DNS expectations and attempt to verify them.
 * Accepts EITHER:
 *   - A record pointing directly at our public IP
 *   - CNAME pointing at <sub>.twinverse.org (which itself resolves via our Cloudflare tunnel)
 *
 * Returns { verified: bool, details: {...} } — details always include what we found.
 */
// Normalize an IPv6 string so "::1" and "0:0:0:0:0:0:0:1" compare equal. Best-effort:
// falls back to lowercase-raw on parse failure (still better than string compare).
function normalizeIp6(s) {
    if (!s) return '';
    try {
        const { isIPv6 } = require('net');
        if (!isIPv6(s)) return String(s).toLowerCase();
        // Expand via URL trick: new URL returns bracketed canonical form
        return new URL(`http://[${s}]`).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    } catch { return String(s).toLowerCase(); }
}

async function verifyDomainDns(domain, project) {
    const expectedIp = await publicIp.get();          // IPv4
    const expectedIp6 = await publicIp.get6?.() || null; // optional IPv6 (resolver may not expose)
    const expectedCname = `${project.subdomain}.twinverse.org`;
    const details = { domain, expectedIp, expectedIp6, expectedCname, a: [], aaaa: [], cname: [], reason: null };

    try { details.cname = await dns.resolveCname(domain).catch(() => []); } catch { /* */ }
    try { details.a    = await dns.resolve4(domain).catch(() => []); } catch { /* */ }
    try { details.aaaa = await dns.resolve6(domain).catch(() => []); } catch { /* */ }

    // Acceptance rule 1: CNAME points at <sub>.twinverse.org
    if (details.cname.some(r => r.toLowerCase() === expectedCname.toLowerCase())) {
        return { verified: true, details: { ...details, matched: 'cname-to-tunnel' } };
    }
    // Acceptance rule 2: A record matches our public IPv4
    if (expectedIp && details.a.includes(expectedIp)) {
        return { verified: true, details: { ...details, matched: 'a-to-public-ip' } };
    }
    // Acceptance rule 3: AAAA record matches our public IPv6 (if we know it)
    if (expectedIp6) {
        const want = normalizeIp6(expectedIp6);
        if (details.aaaa.some(r => normalizeIp6(r) === want)) {
            return { verified: true, details: { ...details, matched: 'aaaa-to-public-ip6' } };
        }
    }
    details.reason = details.a.length
        ? `A records ${details.a.join(', ')} do not match our public IP ${expectedIp}`
        : details.aaaa.length
            ? `AAAA records ${details.aaaa.join(', ')} do not match our public IPv6${expectedIp6 ? ` ${expectedIp6}` : ' (not configured)'}`
            : details.cname.length
                ? `CNAME ${details.cname.join(', ')} does not point at ${expectedCname}`
                : `No A/AAAA/CNAME records found for ${domain}`;
    return { verified: false, details };
}

// POST /api/projects/:id/domain/verify  — dry-run DNS check for one OR many domains
// Body: { domain: "example.com" }                   // single
//    or { domain: "example.com, www.example.com" }  // comma/space/newline separated
router.post('/:id/domain/verify', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const { domain } = req.body || {};
        const list = parseDomainList(domain);
        if (list.length === 0)                    return res.status(400).json({ error: '도메인을 입력해주세요.' });
        for (const d of list) {
            if (!isValidDomain(d))                return res.status(400).json({ error: `올바른 도메인 형식이 아닙니다: ${d}` });
        }

        const perDomain = [];
        for (const d of list) {
            const r = await verifyDomainDns(d, project);
            perDomain.push({ domain: d, ...r });
        }
        const allVerified = perDomain.every(d => d.verified);
        const messages = perDomain.map(d =>
            d.verified
                ? `✅ ${d.domain} (${d.details.matched})`
                : `⚠️ ${d.domain}: ${d.details.reason}`
        );

        res.json({
            domains: list,
            publicIp: publicIp.getSync(),
            verified: allVerified,
            perDomain,
            message: messages.join('\n'),
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:id/domain/connect  — verify + issue SAN cert + wire nginx
// Body: { domain: "a.com" }                       // single
//    or { domain: "a.com, www.a.com" }            // apex + www on one cert
router.post('/:id/domain/connect', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const { domain, skipVerify, staging, redirect } = req.body || {};
        const list = parseDomainList(domain);
        if (list.length === 0)     return res.status(400).json({ error: '도메인을 입력해주세요.' });
        for (const d of list) {
            if (!isValidDomain(d)) return res.status(400).json({ error: `올바른 도메인 형식이 아닙니다: ${d}` });
        }

        // Step 1: verify DNS for each domain (admin may skip)
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        if (!(isAdmin && skipVerify)) {
            const failures = [];
            for (const d of list) {
                const v = await verifyDomainDns(d, project);
                if (!v.verified) failures.push({ domain: d, reason: v.details.reason });
            }
            if (failures.length) {
                return res.status(400).json({
                    error: 'DNS 검증 실패',
                    failures,
                    message: failures.map(f => `${f.domain}: ${f.reason}`).join('\n'),
                });
            }
        }

        // Step 2: issue a single Let's Encrypt cert that covers every hostname as SAN.
        // First hostname is the primary (cert-name / directory under live/).
        let cert = null;
        try {
            const out = await letsencrypt.issueCert(list, { staging: !!staging });
            cert = out.cert;
        } catch (certErr) {
            return res.status(502).json({
                error: `Let's Encrypt 발급 실패: ${certErr.message}`,
                hint: 'DNS가 방금 바뀌었다면 몇 분 후 다시 시도하세요. staging=true 로 테스트 모드 발급도 가능합니다.',
            });
        }

        // Step 3: store the normalized list in custom_domain + canonical redirect flag.
        const storedValue = list.join(',');
        const redirectFlag = !!redirect;
        const updated = await db.queryOne(
            'UPDATE projects SET custom_domain = $1, redirect_to_custom_domain = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
            [storedValue, redirectFlag, project.id]
        );
        decryptEnvIfString(updated);

        // Step 4: regenerate nginx — generateConfig() splits custom_domain by comma and adds
        // all of them to both the HTTP server_name and the single HTTPS SAN block.
        const targetContainer = project.container_id || null;
        await nginxService.addProject(updated, targetContainer);

        res.json({
            success: true,
            message: `✅ ${list.length === 1 ? list[0] : list.length + '개 도메인'} 연결 완료`,
            domain: list[0],
            domains: list,
            url: `https://${list[0]}`,
            urls: list.map(d => `https://${d}`),
            cert,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:id/domain/status  — DNS + cert summary (supports multi-domain)
router.get('/:id/domain/status', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!project.custom_domain) return res.json({ status: 'none', message: '커스텀 도메인 미설정' });

        const list = parseDomainList(project.custom_domain);
        const primary = list[0];
        const cert = await letsencrypt.certInfo(primary);

        const perDomain = [];
        for (const d of list) {
            const v = await verifyDomainDns(d, project);
            perDomain.push({ domain: d, dnsValid: v.verified, details: v.details });
        }
        const allDnsValid = perDomain.every(d => d.dnsValid);

        res.json({
            status: allDnsValid && cert.exists ? 'connected' : (cert.exists ? 'dns_drift' : 'cert_missing'),
            domain: primary,                 // backwards-compat (UI may still read this)
            domains: list,                   // new: full list
            publicIp: publicIp.getSync(),
            dns: perDomain[0]?.details,       // backwards-compat
            dnsValid: allDnsValid,
            perDomain,
            cert,
            url: `https://${primary}`,
            urls: list.map(d => `https://${d}`),
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:id/domain  — revoke cert, remove from nginx, clear DB
router.delete('/:id/domain', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!project.custom_domain) return res.status(400).json({ error: '연결된 도메인이 없습니다.' });

        const list = parseDomainList(project.custom_domain);
        const primary = list[0];

        // Revoke the single SAN cert (cert-name = primary). Best-effort.
        try { await letsencrypt.revokeCert(primary); }
        catch (e) { console.warn(`[domains] revokeCert(${primary}) failed:`, e.message); }

        // Clear DB binding
        const updated = await db.queryOne(
            'UPDATE projects SET custom_domain = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
            [project.id]
        );
        decryptEnvIfString(updated);

        // Regenerate nginx config without the custom domain / HTTPS block
        const targetContainer = project.container_id || null;
        await nginxService.addProject(updated, targetContainer);

        res.json({ success: true, message: `연결 해제 완료 (${list.join(', ')})`, status: 'none' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/projects/:id/domain/redirect  — toggle canonical-hostname redirect without
// reissuing the cert. Body: { enabled: boolean }
router.patch('/:id/domain/redirect', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!project.custom_domain) return res.status(400).json({ error: '연결된 도메인이 없습니다.' });

        const enabled = !!(req.body && req.body.enabled);
        const updated = await db.queryOne(
            'UPDATE projects SET redirect_to_custom_domain = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [enabled, project.id]
        );
        decryptEnvIfString(updated);
        const targetContainer = project.container_id || null;
        await nginxService.addProject(updated, targetContainer);

        res.json({
            success: true,
            enabled,
            message: enabled
                ? `✅ 공식 도메인 리다이렉트 활성 — ${project.subdomain}.twinverse.org 방문 시 https://${parseDomainList(project.custom_domain)[0]}로 자동 이동`
                : '공식 도메인 리다이렉트 비활성 — 두 주소 독립 동작',
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:id/domain/renew  — re-issue the SAN cert for all current domains.
// Daily cron handles normal renewals; this is a manual kick for operators.
router.post('/:id/domain/renew', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!project.custom_domain) return res.status(400).json({ error: '연결된 도메인이 없습니다.' });

        const list = parseDomainList(project.custom_domain);
        const result = await letsencrypt.issueCert(list); // keep-until-expiring
        const targetContainer = project.container_id || null;
        const fresh = await db.queryOne('SELECT * FROM projects WHERE id = $1', [project.id]);
        decryptEnvIfString(fresh);
        await nginxService.addProject(fresh, targetContainer);

        res.json({ success: true, domains: list, cert: result.cert });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// NOTE: /public-ip endpoints moved to routes/system.js (mounted at /api/system) because
// /api/projects/:id pattern in routes/projects.js was catching "public-ip" as a project ID.

module.exports = router;
