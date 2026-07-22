'use strict';

// ~/.orbitronrc 설정 파일 — JSON { server, token, ... }, 항상 chmod 600.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_SERVER = 'https://orbitron.twinverse.org';

function configPath(env = process.env) {
    return env.ORBITRON_CONFIG || path.join(os.homedir(), '.orbitronrc');
}

// 없거나 깨진 파일은 빈 설정으로 취급 (login 이 다시 만든다)
function readConfig(file) {
    try {
        const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
        return {};
    }
}

// 토큰이 담기므로 생성/갱신 모두 0600 보장
function writeConfig(file, config) {
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
    fs.chmodSync(file, 0o600); // 기존 파일 덮어쓸 때 mode 옵션이 무시되므로 명시적으로
}

function clearConfig(file) {
    try {
        fs.unlinkSync(file);
        return true;
    } catch (e) {
        return false;
    }
}

// 서버 URL 정규화: 스킴 없으면 https://, 끝 슬래시 제거
function normalizeServerUrl(url) {
    let u = String(url || '').trim();
    if (!u) return DEFAULT_SERVER;
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u.replace(/\/+$/, '');
}

// 평문 http:// 로 비밀번호/토큰이 나가는 경우 감지 (경고용 — 차단 아님).
// localhost/127.0.0.1/::1/*.localhost 는 조용히 허용.
function isInsecureServerUrl(url) {
    let u;
    try {
        u = new URL(url);
    } catch (e) {
        return false;
    }
    if (u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, ''); // [::1] → ::1
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.localhost')) return false;
    return true;
}

module.exports = { DEFAULT_SERVER, configPath, readConfig, writeConfig, clearConfig, normalizeServerUrl, isInsecureServerUrl };
