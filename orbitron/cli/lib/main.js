'use strict';

// CLI 진입 로직 — bin/orbitron.js 가 호출. 종료 코드를 반환한다 (직접 exit 안 함).

const { parseCliArgs } = require('./args');
const { exitCodeFor, EXIT, AuthError, UsageError } = require('./errors');
const { HANDLERS, buildContext } = require('./commands');

async function main(argv, ctxOverrides = {}) {
    let parsed;
    const stderr = ctxOverrides.stderr || process.stderr;
    try {
        parsed = parseCliArgs(argv);
    } catch (e) {
        stderr.write(`${e.message}\n`);
        return exitCodeFor(e);
    }

    const ctx = buildContext(parsed, ctxOverrides);
    const handler = HANDLERS[parsed.command];
    if (!handler) {
        stderr.write(`알 수 없는 명령: ${parsed.command}\n`);
        return EXIT.USAGE;
    }

    try {
        return await handler(ctx);
    } catch (e) {
        if (e instanceof AuthError) {
            stderr.write(`인증 오류 / Auth error: ${e.message}\n`);
            stderr.write('`orbitron login` 으로 다시 로그인하세요. / Run `orbitron login` to re-authenticate.\n');
        } else if (e instanceof UsageError) {
            stderr.write(`${e.message}\n`);
        } else {
            stderr.write(`오류 / Error: ${e.message}\n`);
        }
        return exitCodeFor(e);
    }
}

module.exports = { main };
