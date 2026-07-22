'use strict';

// 출력 포매터 — 순수 함수 (test/cli.test.js). 외부 색상 라이브러리 없음.

const ANSI = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
};

// no-color.org 규약: NO_COLOR 가 존재하고 빈 문자열이 아니면 색 끔. TTY 아니어도 끔.
function colorEnabled(env = process.env, isTTY = Boolean(process.stdout && process.stdout.isTTY)) {
    if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
    return isTTY;
}

function colorize(text, color, enabled) {
    if (!enabled || !ANSI[color]) return String(text);
    return `${ANSI[color]}${text}${ANSI.reset}`;
}

const STATUS_COLORS = {
    running: 'green',
    success: 'green',
    building: 'yellow',
    queued: 'yellow',
    deploying: 'yellow',
    failed: 'red',
    error: 'red',
    stopped: 'gray',
};

function colorizeStatus(status, enabled) {
    const color = STATUS_COLORS[String(status || '').toLowerCase()];
    return color ? colorize(status, color, enabled) : String(status ?? '-');
}

// East Asian Wide/Fullwidth 코드포인트 — 터미널에서 2칸 차지 (한글 프로젝트명 정렬용)
function isWideCodePoint(cp) {
    return (
        (cp >= 0x1100 && cp <= 0x115F)   // Hangul Jamo
        || (cp >= 0x2E80 && cp <= 0x303E)  // CJK Radicals, Kangxi, CJK Symbols/Punct
        || (cp >= 0x3041 && cp <= 0x33FF)  // Hiragana, Katakana, CJK Compat
        || (cp >= 0x3400 && cp <= 0x4DBF)  // CJK Ext A
        || (cp >= 0x4E00 && cp <= 0x9FFF)  // CJK Unified
        || (cp >= 0xA000 && cp <= 0xA4CF)  // Yi
        || (cp >= 0xAC00 && cp <= 0xD7A3)  // Hangul Syllables
        || (cp >= 0xF900 && cp <= 0xFAFF)  // CJK Compat Ideographs
        || (cp >= 0xFE30 && cp <= 0xFE4F)  // CJK Compat Forms
        || (cp >= 0xFF00 && cp <= 0xFF60)  // Fullwidth Forms
        || (cp >= 0xFFE0 && cp <= 0xFFE6)  // Fullwidth Signs
        || (cp >= 0x1F300 && cp <= 0x1F64F) // Emoji (misc symbols/emoticons)
        || (cp >= 0x1F900 && cp <= 0x1F9FF) // Supplemental symbols
        || (cp >= 0x20000 && cp <= 0x3FFFD) // CJK Ext B+
    );
}

// ANSI 이스케이프를 제외하고, 전각(한글/CJK/일부 이모지)은 2칸으로 센 표시 폭 (정렬 계산용)
function visibleWidth(text) {
    const stripped = String(text).replace(/\x1b\[[0-9;]*m/g, '');
    let width = 0;
    for (const ch of stripped) width += isWideCodePoint(ch.codePointAt(0)) ? 2 : 1;
    return width;
}

function padCell(text, width) {
    const s = String(text);
    return s + ' '.repeat(Math.max(0, width - visibleWidth(s)));
}

// 정렬된 텍스트 테이블. headers: string[], rows: (string|number|null)[][].
// 셀 값에 ANSI 색이 있어도 열이 흐트러지지 않는다.
function formatTable(headers, rows, { color = false } = {}) {
    const normalize = (v) => (v === null || v === undefined || v === '' ? '-' : String(v));
    const body = rows.map((row) => row.map(normalize));
    const widths = headers.map((h, i) => Math.max(
        visibleWidth(h),
        ...body.map((row) => visibleWidth(row[i] ?? ''))
    ));
    const headerLine = headers.map((h, i) => padCell(colorize(h, 'bold', color), widths[i])).join('  ').trimEnd();
    const lines = body.map((row) => row.map((cell, i) => padCell(cell, widths[i])).join('  ').trimEnd());
    return [headerLine, ...lines].join('\n');
}

module.exports = { colorEnabled, colorize, colorizeStatus, visibleWidth, isWideCodePoint, formatTable, ANSI };
