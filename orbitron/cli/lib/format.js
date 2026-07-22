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

// ANSI 이스케이프를 제외한 표시 폭 (정렬 계산용)
function visibleWidth(text) {
    // eslint-disable-next-line no-control-regex
    return String(text).replace(/\x1b\[[0-9;]*m/g, '').length;
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

module.exports = { colorEnabled, colorize, colorizeStatus, visibleWidth, formatTable, ANSI };
