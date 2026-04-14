/**
 * Public-IP resolver with four layers of defense:
 *
 *   1. `process.env.PUBLIC_IP`  — explicit override in .env. Never overridden.
 *   2. Runtime admin override   — `setManual(ip)` stores a sticky value until restart.
 *   3. Auto-detection           — tries multiple providers in order, short timeout each.
 *   4. Fallback                 — returns null; caller shows guidance to the user.
 *
 * The auto-detection result is cached for 1 hour (rare to change during runtime). If the
 * first call succeeds, later calls return the cached value instantly. If the first call
 * fails, subsequent calls retry with the full provider chain (so a transient DNS/network
 * hiccup doesn't permanently disable the feature).
 */

const PROVIDERS = [
    { name: 'ipify',    url: 'https://api.ipify.org?format=json',       pick: j => j.ip },
    { name: 'ipify-v2', url: 'https://api64.ipify.org?format=json',     pick: j => j.ip },
    { name: 'ifconfig', url: 'https://ifconfig.me/all.json',            pick: j => j.ip_addr },
    { name: 'icanhaz',  url: 'https://ipv4.icanhazip.com/',             pick: (_, t) => t.trim() },
    { name: 'seeip',    url: 'https://api.seeip.org/jsonip',            pick: j => j.ip },
    { name: 'myip.com', url: 'https://api.myip.com',                    pick: j => j.ip },
];

const CACHE_MS = 60 * 60 * 1000; // 1h
let _manual = null;          // runtime admin override
let _autoDetected = null;    // last successful auto-detect
let _autoAt = 0;             // timestamp of last successful auto-detect
let _lastError = null;       // last auto-detect failure reason (for diagnostics)

function fromEnv() {
    const v = (process.env.PUBLIC_IP || '').trim();
    return v || null;
}

function isValidIp(s) {
    return typeof s === 'string' && /^(\d{1,3}\.){3}\d{1,3}$/.test(s.trim());
}

async function tryProvider(p, timeoutMs = 4000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(p.url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        const text = await res.text();
        let picked;
        if (ct.includes('application/json') || text.trim().startsWith('{')) {
            try { picked = p.pick(JSON.parse(text), text); } catch { picked = p.pick({}, text); }
        } else {
            picked = p.pick({}, text);
        }
        if (!isValidIp(picked)) throw new Error(`bad payload: ${String(picked).slice(0, 40)}`);
        return picked.trim();
    } finally {
        clearTimeout(timer);
    }
}

async function autoDetect(force = false) {
    // Cached fresh result?
    if (!force && _autoDetected && (Date.now() - _autoAt) < CACHE_MS) return _autoDetected;
    const errors = [];
    for (const p of PROVIDERS) {
        try {
            const ip = await tryProvider(p);
            _autoDetected = ip;
            _autoAt = Date.now();
            _lastError = null;
            return ip;
        } catch (e) {
            errors.push(`${p.name}: ${e.message || e.name}`);
        }
    }
    _lastError = errors.join(' | ');
    return null;
}

/**
 * Return the best-known public IP. Returns a string like "116.33.16.12" on success,
 * or null if every provider failed AND no manual override is set.
 *
 * Precedence: env PUBLIC_IP > manual override > cached auto-detect > fresh auto-detect
 */
async function get() {
    const env = fromEnv(); if (env) return env;
    if (isValidIp(_manual)) return _manual;
    if (_autoDetected && (Date.now() - _autoAt) < CACHE_MS) return _autoDetected;
    return await autoDetect();
}

/**
 * Synchronous form — returns whatever's cached without hitting the network. Useful for
 * UI status endpoints that want to render immediately.
 */
function getSync() {
    const env = fromEnv(); if (env) return env;
    if (isValidIp(_manual)) return _manual;
    return _autoDetected || null;
}

function setManual(ip) {
    if (!isValidIp(ip)) throw new Error('invalid IPv4 address');
    _manual = ip.trim();
    return _manual;
}

function clearManual() {
    _manual = null;
    _autoDetected = null;
    _autoAt = 0;
    return true;
}

function diagnostics() {
    return {
        env: fromEnv(),
        manual: _manual,
        autoDetected: _autoDetected,
        autoAt: _autoAt ? new Date(_autoAt).toISOString() : null,
        autoAgeSec: _autoAt ? Math.round((Date.now() - _autoAt) / 1000) : null,
        lastError: _lastError,
        providers: PROVIDERS.map(p => p.name),
    };
}

// Warm up the cache in the background at module-load, but don't block.
autoDetect().then(ip => {
    if (ip) console.log(`[publicIp] auto-detected ${ip}`);
    else    console.warn(`[publicIp] auto-detection failed on startup — will retry on demand. errors: ${_lastError}`);
}).catch(() => { /* ignore */ });

module.exports = { get, getSync, setManual, clearManual, diagnostics, autoDetect };
