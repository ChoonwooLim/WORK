// 빌드 동시 실행 제한 큐 (Task 1.3)
//
// webhook burst 로 서로 다른 프로젝트의 docker build 가 한꺼번에 몰리면
// 8코어를 전부 잠식해 서비스 전체가 굶주린다. 전역 세마포어 + FIFO 로
// 동시 빌드 수를 제한한다 (zero-dependency, promise 기반).
//
// - 같은 프로젝트의 중복 배포는 deployer.activeDeployments 가 이미 직렬화
//   → 재진입 가드 불필요. 단 release 중복 호출은 no-op (idempotent).
// - compose build 도 dockerService.buildImage() 를 경유하므로 같은 제한 적용.
// - 큐는 in-memory — 프로세스가 죽으면 'queued' 배포 레코드는 server.js
//   시작 시 stale 복구 스윕이 정리한다.

const DEFAULT_MAX_CONCURRENT_BUILDS = 2;

class BuildQueue {
    // limit 을 명시하면 env 대신 그 값을 사용 (테스트용 주입 지점)
    constructor(limit = null) {
        this.limit = (Number.isInteger(limit) && limit >= 1) ? limit : this.maxConcurrentBuilds();
        this.active = 0;
        this.waiting = []; // FIFO: { label, start }
    }

    // 동시 빌드 상한 — env MAX_CONCURRENT_BUILDS, 검증 실패/1 미만 시 기본 2
    // (docker.js deployImageRetention 과 동일한 엄격 왕복 파싱)
    maxConcurrentBuilds(rawValue = process.env.MAX_CONCURRENT_BUILDS) {
        const n = parseInt(rawValue, 10);
        if (Number.isNaN(n) || n < 1 || String(n) !== String(rawValue).trim()) return DEFAULT_MAX_CONCURRENT_BUILDS;
        return n;
    }

    // 슬롯 확보 — 자리가 나면 release 함수로 resolve (FIFO 순서 보장).
    // release 는 중복 호출해도 안전하다. label 은 로깅/introspection 전용.
    acquire(label = 'unnamed') {
        return new Promise((resolve) => {
            const task = {
                label,
                start: () => {
                    this.active += 1;
                    let released = false;
                    resolve(() => {
                        if (released) return; // idempotent release
                        released = true;
                        this.active -= 1;
                        this._startNext();
                    });
                },
            };
            if (this.active < this.limit) task.start();
            else this.waiting.push(task);
        });
    }

    _startNext() {
        if (this.active < this.limit && this.waiting.length > 0) {
            this.waiting.shift().start();
        }
    }

    // 주 사용 API: 슬롯 확보 → fn 실행 → 성공/실패와 무관하게 항상 해제
    async withSlot(label, fn) {
        const release = await this.acquire(label);
        try {
            return await fn();
        } finally {
            release();
        }
    }

    stats() {
        return { limit: this.limit, active: this.active, queued: this.waiting.length };
    }
}

const buildQueue = new BuildQueue();
buildQueue.BuildQueue = BuildQueue; // 테스트에서 독립 인스턴스 생성용
module.exports = buildQueue;
