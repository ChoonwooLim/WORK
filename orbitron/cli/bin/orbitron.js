#!/usr/bin/env node
'use strict';

// Orbitron CLI — zero-dependency (Node ≥18 내장만 사용).

const { main } = require('../lib/main');

main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
}).catch((err) => {
    process.stderr.write(`예상치 못한 오류 / Unexpected error: ${err && err.message}\n`);
    process.exitCode = 1;
});
