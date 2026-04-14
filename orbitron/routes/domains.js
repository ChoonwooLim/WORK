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
const db = require('../db/db');
const { decrypt } = require('../db/crypto');
const nginxService = require('../services/nginx');
const letsencrypt = require('../services/letsencrypt');

// Our public IP — resolved once at module load. Fallback to ipify if the env var isn't set.
let PUBLIC_IP = process.env.PUBLIC_IP || null;
(async () => {
    if (PUBLIC_IP) return;
    try {
        const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
        const { ip } = await res.json();
        PUBLIC_IP = ip;
        console.log(`[domains] resolved public IP: ${PUBLIC_IP}`);
    } catch (e) {
        console.warn('[domains] could not resolve public IP automatically:', e.message);
    }
})();

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

function isValidDomain(domain) {
    // rfc-ish: labels of [a-z0-9-], at least one dot, TLD ≥2, total ≤253
    if (!domain || domain.length > 253) return false;
    return /^(?!-)[a-zA-Z0-9-]{1,63}(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/.test(domain);
}

/**
 * Build a list of DNS expectations and attempt to verify them.
 * Accepts EITHER:
 *   - A record pointing directly at our public IP
 *   - CNAME pointing at <sub>.twinverse.org (which itself resolves via our Cloudflare tunnel)
 *
 * Returns { verified: bool, details: {...} } — details always include what we found.
 */
async function verifyDomainDns(domain, project) {
    const expectedIp = PUBLIC_IP;
    const expectedCname = `${project.subdomain}.twinverse.org`;
    const details = { domain, expectedIp, expectedCname, a: [], cname: [], reason: null };

    try { details.cname = await dns.resolveCname(domain).catch(() => []); } catch { /* */ }
    try { details.a = await dns.resolve4(domain).catch(() => []); } catch { /* */ }

    // Acceptance rule 1: CNAME points at <sub>.twinverse.org
    if (details.cname.some(r => r.toLowerCase() === expectedCname.toLowerCase())) {
        return { verified: true, details: { ...details, matched: 'cname-to-tunnel' } };
    }
    // Acceptance rule 2: A record matches our public IP
    if (expectedIp && details.a.includes(expectedIp)) {
        return { verified: true, details: { ...details, matched: 'a-to-public-ip' } };
    }
    // Fall-through: we know Cloudflare flattens apex CNAMEs. If A records match known CF edge
    // addresses AND the user explicitly said "I've pointed this at the tunnel", we accept — but
    // we can't tell that from DNS alone, so we require explicit A to *our* IP instead. Reason:
    details.reason = details.a.length
        ? `A records ${details.a.join(', ')} do not match our public IP ${expectedIp}`
        : details.cname.length
            ? `CNAME ${details.cname.join(', ')} does not point at ${expectedCname}`
            : `No A or CNAME records found for ${domain}`;
    return { verified: false, details };
}

// POST /api/projects/:id/domain/verify  — dry-run DNS check
router.post('/:id/domain/verify', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const { domain } = req.body || {};
        if (!domain)             return res.status(400).json({ error: '도메인을 입력해주세요.' });
        if (!isValidDomain(domain)) return res.status(400).json({ error: '올바른 도메인 형식이 아닙니다.' });

        const result = await verifyDomainDns(domain, project);
        res.json({
            domain,
            publicIp: PUBLIC_IP,
            ...result,
            message: result.verified
                ? `✅ DNS 검증 성공 (${result.details.matched})`
                : `⚠️ ${result.details.reason}`,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:id/domain/connect  — verify + issue cert + wire nginx
router.post('/:id/domain/connect', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const { domain, skipVerify, staging } = req.body || {};
        if (!domain)                 return res.status(400).json({ error: '도메인을 입력해주세요.' });
        if (!isValidDomain(domain))  return res.status(400).json({ error: '올바른 도메인 형식이 아닙니다.' });

        // Step 1: verify DNS (unless admin explicitly overrides)
        const isAdmin = req.user.role === 'admin' || req.user.role === 'superadmin';
        if (!(isAdmin && skipVerify)) {
            const v = await verifyDomainDns(domain, project);
            if (!v.verified) {
                return res.status(400).json({
                    error: `DNS 검증 실패: ${v.details.reason}`,
                    details: v.details,
                });
            }
        }

        // Step 2: issue Let's Encrypt cert (HTTP-01 via webroot). DNS must already be in place.
        let cert = null;
        try {
            const out = await letsencrypt.issueCert(domain, { staging: !!staging });
            cert = out.cert;
        } catch (certErr) {
            return res.status(502).json({
                error: `Let's Encrypt 발급 실패: ${certErr.message}`,
                hint: 'DNS가 방금 바뀌었다면 몇 분 후 다시 시도하세요. staging=true 로 테스트 모드 발급도 가능합니다.',
            });
        }

        // Step 3: update DB
        const updated = await db.queryOne(
            'UPDATE projects SET custom_domain = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [domain, project.id]
        );
        decryptEnvIfString(updated);

        // Step 4: regenerate nginx config — generateConfig() now automatically emits an HTTPS
        // server block for updated.custom_domain because letsencrypt.hasCert(domain) is now true.
        // We pass the actual running container as targetContainer so the HTTPS block's proxy_pass
        // points at the real Blue-Green container, not the bare fallback name.
        const targetContainer = project.container_id || null;
        await nginxService.addProject(updated, targetContainer);

        res.json({
            success: true,
            message: `✅ ${domain} 연결 완료 — https://${domain}`,
            domain,
            url: `https://${domain}`,
            cert,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:id/domain/status  — DNS + cert summary
router.get('/:id/domain/status', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!project.custom_domain) return res.json({ status: 'none', message: '커스텀 도메인 미설정' });

        const dnsCheck = await verifyDomainDns(project.custom_domain, project);
        const cert = await letsencrypt.certInfo(project.custom_domain);

        res.json({
            status: dnsCheck.verified && cert.exists ? 'connected' : (cert.exists ? 'dns_drift' : 'cert_missing'),
            domain: project.custom_domain,
            publicIp: PUBLIC_IP,
            dns: dnsCheck.details,
            dnsValid: dnsCheck.verified,
            cert,
            url: `https://${project.custom_domain}`,
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:id/domain  — revoke cert, remove from nginx, clear DB
router.delete('/:id/domain', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!project.custom_domain) return res.status(400).json({ error: '연결된 도메인이 없습니다.' });

        const oldDomain = project.custom_domain;

        // Revoke cert (best-effort — keep going even if this fails)
        try { await letsencrypt.revokeCert(oldDomain); }
        catch (e) { console.warn(`[domains] revokeCert(${oldDomain}) failed:`, e.message); }

        // Clear DB binding
        const updated = await db.queryOne(
            'UPDATE projects SET custom_domain = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
            [project.id]
        );
        decryptEnvIfString(updated);

        // Regenerate nginx config without the custom domain / HTTPS block
        const targetContainer = project.container_id || null;
        await nginxService.addProject(updated, targetContainer);

        res.json({ success: true, message: `도메인 ${oldDomain} 연결 해제 완료`, status: 'none' });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:id/domain/renew  — re-run certbot renew for this domain specifically.
// Mostly useful for operators — the daily cron handles normal renewals.
router.post('/:id/domain/renew', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });
        if (!project.custom_domain) return res.status(400).json({ error: '연결된 도메인이 없습니다.' });

        const result = await letsencrypt.issueCert(project.custom_domain); // keep-until-expiring
        const targetContainer = project.container_id || null;
        const fresh = await db.queryOne('SELECT * FROM projects WHERE id = $1', [project.id]);
        decryptEnvIfString(fresh);
        await nginxService.addProject(fresh, targetContainer);

        res.json({ success: true, cert: result.cert });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
