'use strict';

// CLI 에러 계층 + 종료 코드 매핑.
// 0 성공 / 1 API·네트워크 오류 / 2 사용법 오류 / 3 인증 오류

class UsageError extends Error {}      // exit 2 — 잘못된 인자/플래그
class AuthError extends Error {}       // exit 3 — 토큰 만료/누락 (401)
class ApiError extends Error {         // exit 1 — 그 외 API/네트워크 오류
    constructor(message, status = null, code = null) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const EXIT = { OK: 0, API: 1, USAGE: 2, AUTH: 3 };

function exitCodeFor(err) {
    if (err instanceof UsageError) return EXIT.USAGE;
    if (err instanceof AuthError) return EXIT.AUTH;
    return EXIT.API;
}

module.exports = { UsageError, AuthError, ApiError, EXIT, exitCodeFor };
