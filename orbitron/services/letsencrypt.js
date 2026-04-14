/**
 * Let's Encrypt certificate manager — wraps certbot in webroot mode.
 *
 * Design:
 *   - certbot runs as the "stevenlim" user (no sudo) with explicit --config-dir/--work-dir/--logs-dir
 *     pointing at /home/stevenlim/letsencrypt so Orbitron (same user) can read the certs.
 *   - The webroot /home/stevenlim/WORK/orbitron/webroot-acme is mounted read-only into dev-nginx
 *     at /var/www/certbot. The default.conf serves /.well-known/acme-challenge/* from there.
 *   - Issued certs land at $LE_CONFIG_DIR/live/<domain>/{fullchain,privkey}.pem and are also
 *     mounted read-only into dev-nginx at /etc/letsencrypt, so nginx can reference them directly.
 *
 * Env overrides:
 *   CERTBOT_BIN          (default: certbot)
 *   LE_WEBROOT           (default: /home/stevenlim/WORK/orbitron/webroot-acme)
 *   LE_CONFIG_DIR        (default: /home/stevenlim/letsencrypt/config)
 *   LE_WORK_DIR          (default: /home/stevenlim/letsencrypt/work)
 *   LE_LOGS_DIR          (default: /home/stevenlim/letsencrypt/logs)
 *   LE_EMAIL             (default: admin@twinverse.org — registration email)
 *   LE_STAGING           set to "1" to use Let's Encrypt staging (for tests — do not trust these certs)
 */

const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const execAsync = util.promisify(exec);

const CERTBOT_BIN  = process.env.CERTBOT_BIN || 'certbot';
const WEBROOT      = process.env.LE_WEBROOT    || '/home/stevenlim/WORK/orbitron/webroot-acme';
const CONFIG_DIR   = process.env.LE_CONFIG_DIR || '/home/stevenlim/letsencrypt/config';
const WORK_DIR     = process.env.LE_WORK_DIR   || '/home/stevenlim/letsencrypt/work';
const LOGS_DIR     = process.env.LE_LOGS_DIR   || '/home/stevenlim/letsencrypt/logs';
const EMAIL        = process.env.LE_EMAIL      || 'admin@twinverse.org';
const USE_STAGING  = process.env.LE_STAGING === '1';

function certPaths(domain) {
    return {
        fullchain: path.join(CONFIG_DIR, 'live', domain, 'fullchain.pem'),
        privkey:   path.join(CONFIG_DIR, 'live', domain, 'privkey.pem'),
        // The paths visible inside dev-nginx (volume mount maps CONFIG_DIR → /etc/letsencrypt)
        nginxFullchain: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
        nginxPrivkey:   `/etc/letsencrypt/live/${domain}/privkey.pem`,
    };
}

function hasCert(domain) {
    try {
        const p = certPaths(domain).fullchain;
        return fs.existsSync(p) && fs.statSync(p).size > 0;
    } catch { return false; }
}

async function certInfo(domain) {
    const p = certPaths(domain).fullchain;
    if (!fs.existsSync(p)) return { domain, exists: false };
    try {
        // Use openssl to read expiry without requiring the private key
        const { stdout } = await execAsync(`openssl x509 -in "${p}" -noout -enddate -subject -issuer 2>&1`);
        const enddateMatch = stdout.match(/notAfter=(.+)/);
        const expiresAt = enddateMatch ? new Date(enddateMatch[1]).toISOString() : null;
        const daysLeft = expiresAt ? Math.floor((new Date(expiresAt) - new Date()) / 86400000) : null;
        return {
            domain,
            exists: true,
            expiresAt,
            daysLeft,
            needsRenewal: daysLeft !== null && daysLeft < 30,
            paths: certPaths(domain),
        };
    } catch (e) {
        return { domain, exists: true, error: e.message };
    }
}

/**
 * Issue (or renew-if-exists) a certificate for a domain. Uses webroot HTTP-01 challenge.
 * IMPORTANT: DNS for `domain` must already point at this server's public IP and nginx must
 * be serving the ACME challenge path on port 80. Caller is responsible for verifying that.
 *
 * @param {string} domain — single hostname, e.g. "app.example.com"
 * @param {{email?: string, staging?: boolean}} [opts]
 * @returns {Promise<{domain, issued:boolean, cert:object, stdout, stderr}>}
 */
async function issueCert(domain, opts = {}) {
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
        throw new Error(`invalid domain: ${domain}`);
    }
    // Ensure dirs exist (safe if they already do)
    for (const d of [WEBROOT, CONFIG_DIR, WORK_DIR, LOGS_DIR]) {
        fs.mkdirSync(d, { recursive: true });
    }

    const email = opts.email || EMAIL;
    const staging = opts.staging ?? USE_STAGING;

    const args = [
        'certonly',
        '--webroot', '-w', WEBROOT,
        '--config-dir', CONFIG_DIR,
        '--work-dir', WORK_DIR,
        '--logs-dir', LOGS_DIR,
        '-d', domain,
        '--email', email,
        '--agree-tos',
        '--non-interactive',
        '--no-eff-email',
        '--keep-until-expiring', // if cert already exists and is not near expiry, do nothing
    ];
    if (staging) args.push('--staging');

    const cmd = `${CERTBOT_BIN} ${args.map(a => JSON.stringify(a)).join(' ')}`;
    console.log(`[letsencrypt] issuing cert for ${domain} (staging=${staging})`);
    try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
        const info = await certInfo(domain);
        console.log(`[letsencrypt] ✅ ${domain} — expires ${info.expiresAt}`);
        return { domain, issued: true, cert: info, stdout, stderr };
    } catch (e) {
        const out = (e.stdout || '') + '\n' + (e.stderr || '');
        console.error(`[letsencrypt] ❌ ${domain}:`, out.slice(0, 800));
        throw new Error(`certbot failed for ${domain}: ${out.slice(0, 500)}`);
    }
}

/**
 * Revoke a certificate + delete the local cert store entry.
 * Call this when a custom domain is being disconnected.
 */
async function revokeCert(domain) {
    if (!hasCert(domain)) return { domain, revoked: false, reason: 'no cert on disk' };
    const args = [
        'revoke',
        '--cert-path', certPaths(domain).fullchain,
        '--config-dir', CONFIG_DIR,
        '--work-dir', WORK_DIR,
        '--logs-dir', LOGS_DIR,
        '--non-interactive',
    ];
    const cmd = `${CERTBOT_BIN} ${args.map(a => JSON.stringify(a)).join(' ')}`;
    try {
        await execAsync(cmd, { timeout: 60000 });
    } catch (e) {
        console.warn(`[letsencrypt] revoke for ${domain} failed: ${e.message}`);
    }
    // Delete leftover config even if revoke failed
    try {
        await execAsync(`${CERTBOT_BIN} delete --cert-name "${domain}" --config-dir "${CONFIG_DIR}" --work-dir "${WORK_DIR}" --logs-dir "${LOGS_DIR}" --non-interactive`);
    } catch (e) { /* ignore */ }
    return { domain, revoked: true };
}

/**
 * Renew all certificates that are close to expiry. Safe to run daily from cron.
 */
async function renewAll() {
    const cmd = `${CERTBOT_BIN} renew --webroot -w "${WEBROOT}" --config-dir "${CONFIG_DIR}" --work-dir "${WORK_DIR}" --logs-dir "${LOGS_DIR}" --non-interactive --quiet`;
    try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: 300000, maxBuffer: 4 * 1024 * 1024 });
        return { ok: true, stdout, stderr };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

async function listCerts() {
    try {
        const { stdout } = await execAsync(
            `${CERTBOT_BIN} certificates --config-dir "${CONFIG_DIR}" --work-dir "${WORK_DIR}" --logs-dir "${LOGS_DIR}" 2>&1`,
            { timeout: 15000 }
        );
        return stdout;
    } catch (e) {
        return `(error: ${e.message})`;
    }
}

module.exports = {
    CERTBOT_BIN, WEBROOT, CONFIG_DIR, EMAIL,
    certPaths,
    hasCert,
    certInfo,
    issueCert,
    revokeCert,
    renewAll,
    listCerts,
};
