'use strict';

// ── Task 3.3: 컨테이너 로그 검색 — 순수 필터 로직 ───────────────────────────
// routes/projects.js 의 GET /:id/logs/search 가 사용. 사용자 입력 q 는
// **정규식이 아니라 plain substring** 으로만 비교한다 (ReDoS/이스케이프 사고
// 원천 차단 — 대소문자 무시). test/logSearch.test.js 가 핀.

const MAX_QUERY_LENGTH = 200;
const MAX_MATCHES = 500;
const DEFAULT_SEARCH_LINES = 2000;

/**
 * 검색어 검증 → { ok } | { ok:false, error } (라우트에서 400 으로 변환).
 * 규칙: 문자열 + 비어있지 않음(trim 후) + 최대 200자.
 */
function validateQuery(q) {
    if (typeof q !== 'string' || q.trim().length === 0) {
        return { ok: false, error: 'q: 검색어가 필요합니다. / q (search text) is required.' };
    }
    if (q.length > MAX_QUERY_LENGTH) {
        return { ok: false, error: `q: 최대 ${MAX_QUERY_LENGTH}자입니다. / q must be at most ${MAX_QUERY_LENGTH} chars.` };
    }
    return { ok: true };
}

/**
 * 로그 텍스트에서 q 를 포함하는 줄만 추출 (case-insensitive substring).
 * @returns {{ matches: Array<{line:number,text:string}>, truncated: boolean }}
 *   line 은 1-기반 줄 번호, matches 는 최대 maxMatches(기본 500)개,
 *   truncated 는 한도 초과로 잘렸는지 여부.
 */
function searchLogText(logText, q, maxMatches = MAX_MATCHES) {
    const matches = [];
    let truncated = false;
    const needle = String(q).toLowerCase();
    const lines = String(logText || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].toLowerCase().includes(needle)) continue;
        if (matches.length >= maxMatches) {
            truncated = true;
            break;
        }
        matches.push({ line: i + 1, text: lines[i] });
    }
    return { matches, truncated };
}

module.exports = {
    validateQuery,
    searchLogText,
    MAX_QUERY_LENGTH,
    MAX_MATCHES,
    DEFAULT_SEARCH_LINES,
};
