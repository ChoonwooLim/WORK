'use strict';

// Tests for services/logSearch.js (Task 3.3) — pure log filter only.
//
// Pins:
//   1. case-insensitive plain substring (사용자 입력은 절대 정규식이 아님)
//   2. 1-기반 줄 번호 + 원본 줄 텍스트 보존
//   3. 매치 500개 캡 + truncated 플래그
//   4. validateQuery: 비어있음/공백만/200자 초과/비문자열 거부

const test = require('node:test');
const assert = require('node:assert');

const { validateQuery, searchLogText, MAX_MATCHES, MAX_QUERY_LENGTH } = require('../services/logSearch');

test('searchLogText: case-insensitive substring match with 1-based line numbers', () => {
    const log = 'Server started\nERROR: db down\nrequest ok\nerror handled\n';
    const { matches, truncated } = searchLogText(log, 'Error');
    assert.strictEqual(truncated, false);
    assert.deepStrictEqual(matches, [
        { line: 2, text: 'ERROR: db down' },
        { line: 4, text: 'error handled' },
    ]);
});

test('searchLogText: regex metacharacters are treated literally', () => {
    const log = 'value=a.b\nvalue=axb\nvalue=[test]\n';
    // '.' 이 정규식이었다면 axb 도 매칭됐을 것 — plain substring 이므로 1건만
    assert.deepStrictEqual(searchLogText(log, 'a.b').matches, [{ line: 1, text: 'value=a.b' }]);
    assert.deepStrictEqual(searchLogText(log, '[test]').matches, [{ line: 3, text: 'value=[test]' }]);
});

test('searchLogText: no matches → empty, not truncated', () => {
    const r = searchLogText('aaa\nbbb', 'zzz');
    assert.deepStrictEqual(r, { matches: [], truncated: false });
});

test('searchLogText: empty/undefined log text → no matches', () => {
    assert.deepStrictEqual(searchLogText('', 'x'), { matches: [], truncated: false });
    assert.deepStrictEqual(searchLogText(undefined, 'x'), { matches: [], truncated: false });
});

test('searchLogText: caps at 500 matches and sets truncated', () => {
    const log = Array.from({ length: 600 }, (_, i) => `hit ${i}`).join('\n');
    const { matches, truncated } = searchLogText(log, 'hit');
    assert.strictEqual(matches.length, MAX_MATCHES);
    assert.strictEqual(matches.length, 500);
    assert.strictEqual(truncated, true);
    assert.deepStrictEqual(matches[0], { line: 1, text: 'hit 0' });
    assert.deepStrictEqual(matches[499], { line: 500, text: 'hit 499' });
});

test('searchLogText: exactly 500 matches → not truncated', () => {
    const log = Array.from({ length: 500 }, (_, i) => `hit ${i}`).join('\n');
    const { matches, truncated } = searchLogText(log, 'hit');
    assert.strictEqual(matches.length, 500);
    assert.strictEqual(truncated, false);
});

test('validateQuery: valid queries pass', () => {
    assert.deepStrictEqual(validateQuery('error'), { ok: true });
    assert.deepStrictEqual(validateQuery('x'.repeat(MAX_QUERY_LENGTH)), { ok: true });
});

test('validateQuery: empty / whitespace-only / too long / non-string rejected', () => {
    for (const q of ['', '   ', 'x'.repeat(201), undefined, null, 42, ['a']]) {
        assert.strictEqual(validateQuery(q).ok, false, `q ${JSON.stringify(q)} should fail`);
    }
});
