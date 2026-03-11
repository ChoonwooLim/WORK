const express = require('express');
const router = express.Router();
const dns = require('dns');
const util = require('util');
const db = require('../db/db');
const nginxService = require('../services/nginx');
const tunnelService = require('../services/tunnel');

const dnsResolveCname = util.promisify(dns.resolveCname);
const dnsResolve4 = util.promisify(dns.resolve4);

// Helper: Get project with admin bypass
async function getProjectForUser(projectId, user) {
    if (user.role === 'admin' || user.role === 'superadmin') {
        return await db.queryOne('SELECT * FROM projects WHERE id = $1', [projectId]);
    }
    return await db.queryOne('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, user.userId]);
}

// Validate domain format
function isValidDomain(domain) {
    // Allows subdomains like www.example.com, app.example.co.kr
    return /^(?!-)[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(domain) && domain.length <= 253;
}

// POST /api/projects/:id/domain/verify - Verify DNS records for a custom domain
router.post('/:id/domain/verify', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: '도메인을 입력해주세요.' });
        if (!isValidDomain(domain)) return res.status(400).json({ error: '올바른 도메인 형식이 아닙니다.' });

        const expectedTarget = `${project.subdomain}.twinverse.org`;
        const results = { domain, expectedTarget, cnameRecords: [], aRecords: [], verified: false, message: '' };

        // Check CNAME records
        try {
            const cnameRecords = await dnsResolveCname(domain);
            results.cnameRecords = cnameRecords;

            const isCorrectCname = cnameRecords.some(record =>
                record.toLowerCase() === expectedTarget.toLowerCase()
            );

            if (isCorrectCname) {
                results.verified = true;
                results.message = `✅ DNS 검증 성공! CNAME이 올바르게 ${expectedTarget}를 가리키고 있습니다.`;
            } else {
                results.message = `⚠️ CNAME 레코드가 발견되었지만 잘못된 대상을 가리키고 있습니다. 현재: ${cnameRecords.join(', ')} → 필요: ${expectedTarget}`;
            }
        } catch (cnameErr) {
            // No CNAME, check A records as fallback info
            try {
                const aRecords = await dnsResolve4(domain);
                results.aRecords = aRecords;
                results.message = `⚠️ CNAME 레코드가 없습니다. A 레코드(${aRecords.join(', ')})가 발견되었습니다. CNAME 레코드를 ${expectedTarget}로 설정해주세요.`;
            } catch (aErr) {
                results.message = `❌ DNS 레코드를 찾을 수 없습니다. 도메인 등록기관에서 CNAME 레코드를 ${expectedTarget}로 설정한 후 다시 시도해주세요. (DNS 전파에 최대 48시간 소요될 수 있습니다)`;
            }
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/projects/:id/domain/connect - Connect a verified custom domain
router.post('/:id/domain/connect', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        const { domain } = req.body;
        if (!domain) return res.status(400).json({ error: '도메인을 입력해주세요.' });
        if (!isValidDomain(domain)) return res.status(400).json({ error: '올바른 도메인 형식이 아닙니다.' });

        // Step 1: Verify DNS before connecting
        const expectedTarget = `${project.subdomain}.twinverse.org`;
        let dnsVerified = false;

        try {
            const cnameRecords = await dnsResolveCname(domain);
            dnsVerified = cnameRecords.some(r => r.toLowerCase() === expectedTarget.toLowerCase());
        } catch (e) {
            // CNAME not found
        }

        if (!dnsVerified) {
            return res.status(400).json({
                error: `DNS 검증 실패: CNAME 레코드가 ${expectedTarget}를 가리키고 있지 않습니다. 먼저 DNS 설정을 완료해주세요.`
            });
        }

        // Step 2: Add Cloudflare tunnel DNS route for custom domain
        try {
            await tunnelService.addCustomDomainRoute(domain, project);
            console.log(`✅ Cloudflare DNS route added for custom domain: ${domain}`);
        } catch (tunnelErr) {
            console.error(`⚠️ Cloudflare DNS route failed for ${domain}:`, tunnelErr.message);
            // Continue anyway — Nginx routing will still work if user's DNS directly points to server
        }

        // Step 3: Update DB
        const updatedProject = await db.queryOne(
            'UPDATE projects SET custom_domain = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [domain, project.id]
        );

        // Step 4: Update Nginx config with custom domain
        await nginxService.addProject(updatedProject);

        res.json({
            success: true,
            message: `✅ 도메인 ${domain}이(가) 성공적으로 연결되었습니다!`,
            domain,
            url: `https://${domain}`,
            status: 'connected'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/projects/:id/domain/status - Get domain connection status
router.get('/:id/domain/status', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        if (!project.custom_domain) {
            return res.json({
                status: 'none',
                domain: null,
                message: '커스텀 도메인이 설정되지 않았습니다.'
            });
        }

        // Check if DNS is still valid
        const expectedTarget = `${project.subdomain}.twinverse.org`;
        let dnsValid = false;

        try {
            const cnameRecords = await dnsResolveCname(project.custom_domain);
            dnsValid = cnameRecords.some(r => r.toLowerCase() === expectedTarget.toLowerCase());
        } catch (e) {
            // CNAME lookup failed
        }

        res.json({
            status: dnsValid ? 'connected' : 'dns_error',
            domain: project.custom_domain,
            expectedTarget,
            dnsValid,
            url: `https://${project.custom_domain}`,
            message: dnsValid
                ? `✅ ${project.custom_domain} 정상 연결 중`
                : `⚠️ DNS 레코드가 변경되었습니다. CNAME을 ${expectedTarget}로 재설정해주세요.`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/projects/:id/domain - Disconnect custom domain
router.delete('/:id/domain', async (req, res) => {
    try {
        const project = await getProjectForUser(req.params.id, req.user);
        if (!project) return res.status(404).json({ error: 'Project not found or unauthorized' });

        if (!project.custom_domain) {
            return res.status(400).json({ error: '연결된 도메인이 없습니다.' });
        }

        const oldDomain = project.custom_domain;

        // Remove domain from DB
        const updatedProject = await db.queryOne(
            'UPDATE projects SET custom_domain = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
            [project.id]
        );

        // Regenerate Nginx config (without custom domain)
        await nginxService.addProject(updatedProject);

        res.json({
            success: true,
            message: `도메인 ${oldDomain} 연결이 해제되었습니다.`,
            status: 'none'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
