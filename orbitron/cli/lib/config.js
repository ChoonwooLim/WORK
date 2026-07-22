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

module.exports = { DEFAULT_SERVER, configPath, readConfig, writeConfig, clearConfig, normalizeServerUrl };
