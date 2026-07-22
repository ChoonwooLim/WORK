'use strict';

// 대화형 입력 — readline 기반. 비밀번호는 raw 모드로 에코 없이 읽는다 (내장만 사용).

const readline = require('node:readline');

function ask(question, { input = process.stdin, output = process.stdout } = {}) {
    const rl = readline.createInterface({ input, output });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// 에코 끔 비밀번호 입력. TTY 면 raw 모드로 문자 단위 수집 (Backspace 처리,
// Ctrl+C 는 reject). TTY 아니면(파이프 입력) 일반 라인 읽기로 폴백.
function askHidden(question, { input = process.stdin, output = process.stdout } = {}) {
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
        // 파이프/리다이렉트 입력 — 에코 문제 없음
        return ask(question, { input, output });
    }

    return new Promise((resolve, reject) => {
        output.write(question);
        const wasRaw = input.isRaw === true;
        input.setRawMode(true);
        input.resume();
        let buffer = '';

        const cleanup = () => {
            input.removeListener('data', onData);
            input.setRawMode(wasRaw);
            input.pause();
        };

        const onData = (chunk) => {
            for (const ch of chunk.toString('utf8')) {
                if (ch === '\r' || ch === '\n') {
                    cleanup();
                    output.write('\n');
                    return resolve(buffer);
                }
                if (ch === '\u0003') { // Ctrl+C
                    cleanup();
                    output.write('\n');
                    return reject(new Error('입력이 중단되었습니다. / Input cancelled.'));
                }
                if (ch === '\u007f' || ch === '\b') { // Backspace
                    buffer = buffer.slice(0, -1);
                    continue;
                }
                if (ch >= ' ' || ch === '\t') buffer += ch; // 제어문자 무시
            }
        };

        input.on('data', onData);
    });
}

module.exports = { ask, askHidden };
