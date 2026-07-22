// Tests for static-asset cache headers in generated nginx configs (Task 1.4).
//
// Contract:
//   - Every HTTP-proxying server block gets EXACTLY ONE static-assets regex
//     location, placed BEFORE `location /`, containing the same resolver+variable
//     proxy body (regression-guard compatible) plus ONE Cache-Control add_header
//     that references the $orbitron_static_cc map variable — NO expires directive,
//     NO literal max-age in generated confs.
//   - The map lives in infrastructure/nginx/conf.d/00-orbitron-cache.conf
//     (hand-managed, # orbitron:manual): upstream sent no Cache-Control → default
//     public 1d; upstream sent ANY Cache-Control (private/no-store/immutable/…)
//     → empty map value → nginx omits add_header → upstream header passes through.
//   - `location /` stays byte-identical (HTML/SPA responses must never be cached).
//   - The asset extension list must NOT include html/htm/json/xml/txt.
//   - The ACME challenge location keeps `^~` (prefix-priority) so it beats the
//     new regex location.
//   - The tunnel-redirect server block (canonical-hostname mode) proxies nothing,
//     so it must NOT get the static block.
//
// NOTE on DB projects (db_postgres / db_redis): deployer.js never calls
// nginxService.addProject for them ("프록시 설정 건너뜀 (내부 네트워크 통신)") —
// they get no generated conf at all, so there is nothing to exclude here.
//
// All fixtures live in mkdtemp dirs. NGINX_CONF_DIR and LE_CONFIG_DIR must be
// set BEFORE requiring the services (both are read at module load).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpConfDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitron-nginx-static-'));
const tmpLeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbitron-le-static-'));
process.env.NGINX_CONF_DIR = tmpConfDir;
process.env.LE_CONFIG_DIR = tmpLeDir;

const nginxService = require('../services/nginx');
const { STATIC_ASSET_EXT_REGEX, STATIC_CACHE_VAR } = nginxService;

test.after(() => {
    fs.rmSync(tmpConfDir, { recursive: true, force: true });
    fs.rmSync(tmpLeDir, { recursive: true, force: true });
});

// Safety stub: never touch the real dev-nginx container.
nginxService.reload = async () => {};

// ── helpers ─────────────────────────────────────────────────────────

// A plain web project. No targetContainer is ever passed in these tests, so
// generateConfig never shells out to docker (port auto-detection is skipped).
function plainProject(overrides = {}) {
    return { name: 'Plain App', subdomain: 'plainapp', port: 3123, ...overrides };
}

// Split a config into server blocks (fragment = everything after `server {` up
// to the next `server {`). Good enough for ordering/counting assertions.
function serverBlocks(config) {
    return config.split(/\nserver\s*\{/).slice(1);
}

function countOccurrences(haystack, needle) {
    return haystack.split(needle).length - 1;
}

// Fake an issued Let's Encrypt cert so letsencrypt.hasCert() → true and
// generateConfig renders the real _httpsBlock (no unit seam needed).
function fakeCert(domain) {
    const liveDir = path.join(tmpLeDir, 'live', domain);
    fs.mkdirSync(liveDir, { recursive: true });
    fs.writeFileSync(path.join(liveDir, 'fullchain.pem'), 'FAKE CERT — test fixture\n');
}

const STATIC_LOCATION_LINE = `location ~* ${STATIC_ASSET_EXT_REGEX} {`;
const CACHE_CONTROL_LINE = `        add_header Cache-Control ${STATIC_CACHE_VAR};`;

// The hand-managed http-context map that defines $orbitron_static_cc, resolved
// relative to the nginx.js module dir the same way NGINX_CONF_DIR's default is.
const CACHE_MAP_CONF = path.join(
    __dirname, '..', '..', 'infrastructure', 'nginx', 'conf.d', '00-orbitron-cache.conf'
);

// ── consts + the shared map file ────────────────────────────────────

test('consts exported: extension regex + map variable name', () => {
    assert.strictEqual(typeof STATIC_ASSET_EXT_REGEX, 'string');
    assert.strictEqual(STATIC_CACHE_VAR, '$orbitron_static_cc');
});

test('00-orbitron-cache.conf: manual marker first line, map with 1d default-when-silent', () => {
    const content = fs.readFileSync(CACHE_MAP_CONF, 'utf-8');
    const lines = content.split('\n');

    // Hand-managed contract: marker must open the file (within first 512 bytes
    // for isManuallyManaged — line 1 satisfies that trivially).
    assert.ok(lines[0].startsWith('# orbitron:manual'), 'first line must be the # orbitron:manual marker');
    assert.strictEqual(nginxService.isManuallyManaged(CACHE_MAP_CONF), true, 'Orbitron must treat the map conf as protected');

    // http-context map keyed on the UPSTREAM Cache-Control header, defining the
    // exact variable the generated confs reference.
    assert.ok(
        content.includes(`map $upstream_http_cache_control ${STATIC_CACHE_VAR} {`),
        'map block must define the STATIC_CACHE_VAR variable from $upstream_http_cache_control'
    );

    // Default applies ONLY when upstream sent nothing ('' key) — 1 day public.
    const emptyKeyLine = lines.find(l => l.trim().startsWith(`''`));
    assert.ok(emptyKeyLine, `map must have a '' (upstream-silent) entry`);
    assert.ok(emptyKeyLine.includes('max-age=86400'), 'upstream-silent default must be 1 day (max-age=86400)');
    assert.ok(emptyKeyLine.includes('public'), 'upstream-silent default must be public');

    // Any upstream-sent Cache-Control → empty value → nginx omits add_header
    // → upstream header (private/no-store/immutable/…) passes through untouched.
    assert.ok(/default\s+'';/.test(content), `map default must be '' (pass upstream Cache-Control through)`);
});

test('static asset regex: html/htm/json/xml/txt are NOT cacheable extensions', () => {
    for (const forbidden of ['html', 'htm', 'json', 'xml', 'txt']) {
        assert.ok(
            !new RegExp(`[(|]${forbidden}[|)]`).test(STATIC_ASSET_EXT_REGEX),
            `"${forbidden}" must not be in the static asset extension list`
        );
    }
});

test('static asset regex: matches asset URLs, never HTML/JSON', () => {
    const re = new RegExp(STATIC_ASSET_EXT_REGEX, 'i');
    for (const url of ['/assets/main.js', '/m.mjs', '/style.css', '/logo.PNG', '/f/font.woff2', '/app.js.map', '/pic.avif']) {
        assert.ok(re.test(url), `should match: ${url}`);
    }
    for (const url of ['/', '/index.html', '/page.htm', '/api/data.json', '/sitemap.xml', '/robots.txt', '/api/users', '/ws/socket']) {
        assert.ok(!re.test(url), `must NOT match: ${url}`);
    }
});

// ── plain web project (single HTTP server block) ────────────────────

test('plain project: exactly one static location, placed before location /', () => {
    const config = nginxService.generateConfig(plainProject());
    const blocks = serverBlocks(config);
    assert.strictEqual(blocks.length, 1, 'plain project renders one server block');

    assert.strictEqual(countOccurrences(config, 'location ~*'), 1, 'exactly one regex location');
    assert.ok(config.includes(STATIC_LOCATION_LINE), 'static location regex must match the module const');

    const staticIdx = config.indexOf(STATIC_LOCATION_LINE);
    const rootIdx = config.indexOf('location / {');
    assert.ok(staticIdx !== -1 && rootIdx !== -1);
    assert.ok(staticIdx < rootIdx, 'static assets location must come BEFORE location /');
});

test('plain project: static block reuses resolver+$upstream proxy body (guard-compatible)', () => {
    const config = nginxService.generateConfig(plainProject());

    // The static block's body is everything between its opening line and `location /`.
    const staticBody = config.slice(config.indexOf(STATIC_LOCATION_LINE), config.indexOf('location / {'));
    assert.ok(staticBody.includes('resolver 127.0.0.11 valid=10s ipv6=off;'), 'static block must carry the docker DNS resolver');
    assert.ok(staticBody.includes('set $upstream orbitron-plainapp:3123;'), 'static block must set $upstream');
    assert.ok(staticBody.includes('proxy_pass http://$upstream;'), 'static block must proxy via variable');

    // Same two checks addProject's regression guard runs at config-write time.
    assert.ok(config.includes('resolver 127.0.0.11'), 'addProject guard #1 must pass');
    assert.ok(config.includes('proxy_pass http://$upstream'), 'addProject guard #2 must pass');
});

test('plain project: exact Cache-Control add_header via map variable — no expires, no literal max-age', () => {
    const config = nginxService.generateConfig(plainProject());

    assert.ok(config.includes(CACHE_CONTROL_LINE), 'exact `add_header Cache-Control $orbitron_static_cc;` line required');
    assert.strictEqual(countOccurrences(config, 'Cache-Control'), 1, 'exactly one Cache-Control reference');

    // Cache VALUES live only in 00-orbitron-cache.conf — never in generated confs.
    assert.ok(!config.includes('expires'), 'no expires directive (it would override upstream Cache-Control)');
    assert.ok(!config.includes('max-age'), 'no literal max-age in generated conf (single tuning point is the map conf)');

    // The add_header lives INSIDE the static block, before location /.
    assert.ok(config.indexOf(CACHE_CONTROL_LINE) < config.indexOf('location / {'));
});

test('plain project: location / stays byte-identical (HTML/SPA never cached)', () => {
    const config = nginxService.generateConfig(plainProject());

    // Exact pre-existing shape: location / wraps _proxyPassBlock and nothing else.
    const expectedRootLocation = `    location / {\n${nginxService._proxyPassBlock('orbitron-plainapp', 3123)}\n    }`;
    assert.ok(config.includes(expectedRootLocation), 'location / must be exactly _proxyPassBlock — no cache directives');

    // And nothing after location / carries cache headers.
    const tail = config.slice(config.indexOf('location / {'));
    assert.ok(!tail.includes('Cache-Control'), 'no Cache-Control at/after location /');
    assert.ok(!tail.includes('expires'), 'no expires at/after location /');
});

test('plain project: ACME challenge location keeps ^~ prefix-priority (beats regex locations)', () => {
    const config = nginxService.generateConfig(plainProject());
    assert.ok(config.includes('location ^~ /.well-known/acme-challenge/'), 'ACME location must use ^~ so it wins over ~* regex');
});

test('addProject: full write path passes the regression guard with the static block present', async () => {
    const project = plainProject({ subdomain: 'guardpass' });
    await nginxService.addProject(project); // must NOT throw (guard runs inside)

    const written = fs.readFileSync(path.join(tmpConfDir, 'guardpass.conf'), 'utf-8');
    assert.ok(written.includes(STATIC_LOCATION_LINE));
    assert.ok(written.includes('resolver 127.0.0.11'));
    assert.ok(written.includes('proxy_pass http://$upstream'));
});

// ── custom domain: HTTPS block (via real hasCert with LE_CONFIG_DIR fixture) ──

test('custom domain with cert: HTTP and HTTPS blocks each get one static location before location /', () => {
    fakeCert('app.example.com');
    const config = nginxService.generateConfig(plainProject({
        subdomain: 'customapp', port: 4000, custom_domain: 'app.example.com',
    }));

    const blocks = serverBlocks(config);
    assert.strictEqual(blocks.length, 2, 'HTTP block + HTTPS (Let\'s Encrypt) block');
    assert.ok(config.includes('listen 443 ssl'), 'HTTPS block must render (cert fixture found)');

    for (const [i, block] of blocks.entries()) {
        assert.strictEqual(countOccurrences(block, 'location ~*'), 1, `server block #${i} has exactly one static location`);
        assert.ok(block.includes(STATIC_LOCATION_LINE), `server block #${i} regex matches the const`);
        assert.ok(block.indexOf(STATIC_LOCATION_LINE) < block.indexOf('location / {'), `server block #${i}: static before location /`);
        assert.ok(block.includes(CACHE_CONTROL_LINE), `server block #${i} exact Cache-Control line`);
        assert.ok(!block.includes('expires') && !block.includes('max-age'), `server block #${i}: no expires / literal max-age`);
        assert.ok(block.includes('location ^~ /.well-known/acme-challenge/'), `server block #${i} keeps ^~ ACME location`);
        // location / itself stays cache-free in every block.
        const tail = block.slice(block.indexOf('location / {'));
        assert.ok(!tail.includes('Cache-Control'), `server block #${i}: location / stays uncached`);
    }
});

test('canonical-redirect mode: redirect block gets NO static location, proxying blocks get one each', () => {
    fakeCert('canon.example.com');
    const config = nginxService.generateConfig(plainProject({
        subdomain: 'canonapp', port: 5000,
        custom_domain: 'canon.example.com', redirect_to_custom_domain: true,
    }));

    const blocks = serverBlocks(config);
    assert.strictEqual(blocks.length, 3, 'redirect block + custom-domain :80 block + HTTPS block');

    // Block 0: tunnel-name redirect — proxies nothing, must stay cache-free.
    const redirectBlock = blocks[0];
    assert.ok(redirectBlock.includes('return 301 https://canon.example.com$request_uri;'));
    assert.strictEqual(countOccurrences(redirectBlock, 'location ~*'), 0, 'redirect block must NOT get the static location');
    assert.ok(!redirectBlock.includes('location / {'), 'redirect block has no proxying location /');
    assert.ok(redirectBlock.includes('location ^~ /.well-known/acme-challenge/'), 'ACME stays reachable during redirects');

    // Blocks 1 and 2 proxy the app → one static location each, before location /.
    for (const i of [1, 2]) {
        assert.strictEqual(countOccurrences(blocks[i], 'location ~*'), 1, `server block #${i} has exactly one static location`);
        assert.ok(blocks[i].indexOf(STATIC_LOCATION_LINE) < blocks[i].indexOf('location / {'), `server block #${i}: static before location /`);
        assert.ok(blocks[i].includes(CACHE_CONTROL_LINE), `server block #${i} exact Cache-Control line`);
    }
});
