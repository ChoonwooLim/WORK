'use strict';

// 명령별 인자 파싱 — util.parseArgs 래퍼. 순수 함수 (test/cli.test.js).
// parseCliArgs(argv) → 정규화된 { command, ... } 객체, 오류는 UsageError.

const { parseArgs } = require('node:util');
const { UsageError } = require('./errors');

// 명령 테이블: options 는 parseArgs options, positionals 는 [이름, 필수여부]
const COMMANDS = {
    login: { options: { server: { type: 'string' } }, positionals: [] },
    logout: { options: {}, positionals: [] },
    status: { options: {}, positionals: [] },
    deploy: { options: { project: { type: 'string' } }, positionals: [] },
    logs: { options: { tail: { type: 'string' }, grep: { type: 'string' } }, positionals: [['project', true]] },
    rollback: { options: {}, positionals: [['project', true]] },
    previews: { options: {}, positionals: null }, // 가변 — 아래에서 직접 처리
    cron: { options: {}, positionals: null },     // 가변 — 아래에서 직접 처리
    help: { options: {}, positionals: [['topic', false]] },
};

function parsePositiveInt(value, flagName) {
    if (!/^\d+$/.test(String(value))) {
        throw new UsageError(`${flagName} 값은 1 이상의 정수여야 합니다. / ${flagName} must be a positive integer.`);
    }
    const n = parseInt(value, 10);
    if (n < 1) {
        throw new UsageError(`${flagName} 값은 1 이상의 정수여야 합니다. / ${flagName} must be a positive integer.`);
    }
    return n;
}

function parseCliArgs(argv) {
    if (!argv || argv.length === 0) return { command: 'help', topic: null };

    const [command, ...rest] = argv;
    if (command === '--help' || command === '-h' || command === 'help') {
        return { command: 'help', topic: rest[0] || null };
    }
    if (command === '--version' || command === '-v') return { command: 'version' };

    const spec = COMMANDS[command];
    if (!spec) {
        throw new UsageError(`알 수 없는 명령: ${command} / Unknown command: ${command} ('orbitron --help' 참고)`);
    }
    if (rest.includes('--help') || rest.includes('-h')) {
        return { command: 'help', topic: command };
    }

    let parsed;
    try {
        parsed = parseArgs({ args: rest, options: spec.options, allowPositionals: true, strict: true });
    } catch (e) {
        throw new UsageError(`${e.message} ('orbitron help ${command}' 참고)`);
    }
    const { values, positionals } = parsed;

    // previews: `previews <project>` | `previews rm <project> <pr>`
    if (command === 'previews') {
        if (positionals[0] === 'rm') {
            if (positionals.length !== 3) {
                throw new UsageError('사용법: orbitron previews rm <project> <pr> / Usage: orbitron previews rm <project> <pr>');
            }
            return { command: 'previews', action: 'rm', project: positionals[1], pr: parsePositiveInt(positionals[2], '<pr>') };
        }
        if (positionals.length !== 1) {
            throw new UsageError('사용법: orbitron previews <project> / Usage: orbitron previews <project>');
        }
        return { command: 'previews', action: 'list', project: positionals[0] };
    }

    // cron: `cron <project>` | `cron run <project> <name>`
    if (command === 'cron') {
        if (positionals[0] === 'run') {
            if (positionals.length !== 3) {
                throw new UsageError('사용법: orbitron cron run <project> <name> / Usage: orbitron cron run <project> <name>');
            }
            return { command: 'cron', action: 'run', project: positionals[1], name: positionals[2] };
        }
        if (positionals.length !== 1) {
            throw new UsageError('사용법: orbitron cron <project> / Usage: orbitron cron <project>');
        }
        return { command: 'cron', action: 'list', project: positionals[0] };
    }

    // 고정 positional 검증
    const wanted = spec.positionals;
    const required = wanted.filter(([, req]) => req).length;
    if (positionals.length < required || positionals.length > wanted.length) {
        const usage = wanted.map(([n, req]) => (req ? `<${n}>` : `[${n}]`)).join(' ');
        throw new UsageError(`사용법: orbitron ${command} ${usage} / Usage: orbitron ${command} ${usage}`.trim());
    }

    const result = { command };
    wanted.forEach(([name], i) => { result[name] = positionals[i] !== undefined ? positionals[i] : null; });

    if (command === 'login') result.server = values.server || null;
    if (command === 'deploy') result.project = values.project || null;
    if (command === 'logs') {
        result.tail = values.tail !== undefined ? parsePositiveInt(values.tail, '--tail') : 200;
        // grep 은 지정됐을 때만 키를 만든다 (기존 결과 형태 불변 — 테스트 핀)
        if (values.grep !== undefined) {
            if (values.grep.length === 0) {
                throw new UsageError('--grep 값은 비어 있을 수 없습니다. / --grep requires a non-empty value.');
            }
            result.grep = values.grep;
        }
    }

    return result;
}

module.exports = { parseCliArgs, COMMANDS };
