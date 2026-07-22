'use strict';

// 운영 알림 채널 (Task 2.2) — Telegram Bot API 로 알림 전송.
//
// - TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID env 가 모두 설정된 경우에만 실제 전송,
//   아니면 콘솔 폴백 (모니터링 자체는 알림 채널 없이도 동작해야 함).
// - parse_mode 미사용(plain text) — MarkdownV2 이스케이프 버그로 알림이
//   조용히 실패하는 사고를 원천 차단한다.
// - 절대 throw 하지 않는다: 알림 실패가 호출자(헬스 모니터 등)를 죽이면 안 됨.
// - zero-dependency: Node >= 24 global fetch + AbortSignal.timeout 사용.

const TELEGRAM_TIMEOUT_MS = 10000;

function isConfigured() {
    return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * 알림 전송. 성공 시 true, 실패/미설정 시 false (never throws).
 * @param {string} title 제목 줄
 * @param {string} body 본문
 * @returns {Promise<boolean>}
 */
async function sendAlert(title, body) {
    const text = `${title}\n\n${body}`;
    try {
        if (!isConfigured()) {
            console.warn(`[alerts] telegram 미설정 — 콘솔 폴백: ${text}`);
            return false;
        }
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
            signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
        });
        if (!res.ok) {
            console.error(`[alerts] telegram 전송 실패: HTTP ${res.status}`);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`[alerts] telegram 전송 실패: ${e && e.message ? e.message : e}`);
        return false;
    }
}

module.exports = { sendAlert, isConfigured, TELEGRAM_TIMEOUT_MS };
