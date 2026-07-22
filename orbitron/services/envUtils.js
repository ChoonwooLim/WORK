function parseUrl(value) {
    try {
        return value ? new URL(value) : null;
    } catch {
        return null;
    }
}

function isLocalHost(hostname) {
    return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(String(hostname || '').toLowerCase());
}

function isDockerBridgeIp(hostname) {
    const host = String(hostname || '');
    const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (!m) return false;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a === 172 && b >= 16 && b <= 31;
}

function preserveProtocol(currentUrl, targetUrl) {
    const current = parseUrl(currentUrl);
    const target = parseUrl(targetUrl);
    if (!current || !target) return targetUrl;

    // SQLAlchemy URLs may specify a driver, e.g. postgresql+psycopg://.
    // Keep that driver when replacing host/port with the Docker-internal endpoint.
    const currentBase = current.protocol.split('+')[0].replace(':', '');
    const targetBase = target.protocol.split('+')[0].replace(':', '');
    if (currentBase && currentBase === targetBase && current.protocol !== target.protocol) {
        target.protocol = current.protocol;
    }
    return target.toString();
}

function shouldReplaceManagedDatabaseUrl(currentUrl, targetUrl) {
    if (!currentUrl) return true;

    const current = parseUrl(currentUrl);
    const target = parseUrl(targetUrl);
    if (!current || !target) return String(currentUrl).includes('localhost');

    const currentHost = current.hostname;
    const targetHost = target.hostname;
    const currentPort = current.port || (current.protocol.startsWith('redis') ? '6379' : '5432');
    const targetPort = target.port || (target.protocol.startsWith('redis') ? '6379' : '5432');

    if (isLocalHost(currentHost)) return true;
    if (currentHost === targetHost && currentPort !== targetPort) return true;
    if (currentHost.startsWith('orbitron-') && currentPort !== targetPort) return true;
    if (isDockerBridgeIp(currentHost) && currentPort !== targetPort) return true;

    return false;
}

function managedDatabaseUrl(currentUrl, targetUrl) {
    return shouldReplaceManagedDatabaseUrl(currentUrl, targetUrl)
        ? preserveProtocol(currentUrl, targetUrl)
        : currentUrl;
}

module.exports = {
    managedDatabaseUrl,
    shouldReplaceManagedDatabaseUrl
};
