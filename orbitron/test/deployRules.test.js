'use strict';

// Zero-downtime 배포 실패-경로 가드 핀 (services/deployRules.js).
//
// 배경: 단일 웹 컨테이너 배포가 start-new-first / stop-old-last 로 재배열되면서
// _doDeploy 의 catch 는 "실패한 새 컨테이너"를 best-effort 로 제거한다.
// 이 판정이 틀리면 두 방향의 사고가 난다:
//   (a) 구 컨테이너를 제거 → 실패한 배포가 멀쩡히 서빙 중이던 사이트를 죽임
//   (b) nginx 전환 후의 새 컨테이너를 제거 → 방금 트래픽을 받기 시작한
//       컨테이너를 죽임
// 오케스트레이션(도커/nginx 부수효과)은 단위 테스트 불가 — 판정만 여기서 핀.
//
// NEVER invokes docker/DB — 순수 함수만 검증.

const test = require('node:test');
const assert = require('node:assert');

const { shouldRemoveFailedNewContainer } = require('../services/deployRules');

test('guard: removes the failed new container before the nginx switch', () => {
    assert.strictEqual(
        shouldRemoveFailedNewContainer('orbitron-myapp-m2abc1', 'orbitron-myapp-m1old9', false),
        true
    );
});

test('guard: first deploy (no old container) still cleans the failed new one', () => {
    assert.strictEqual(shouldRemoveFailedNewContainer('orbitron-myapp-m2abc1', null, false), true);
    assert.strictEqual(shouldRemoveFailedNewContainer('orbitron-myapp-m2abc1', undefined, false), true);
});

test('guard: NEVER removes once nginx has switched to the new container', () => {
    // 전환 후 실패(예: Step 6 DB 오류) — 새 컨테이너가 트래픽을 받는 중
    assert.strictEqual(
        shouldRemoveFailedNewContainer('orbitron-myapp-m2abc1', 'orbitron-myapp-m1old9', true),
        false
    );
    // 첫 배포(구 컨테이너 없음)라도 전환 후에는 마찬가지로 제거 금지 —
    // 유일하게 트래픽을 받는 컨테이너를 죽이면 그대로 장애다
    assert.strictEqual(shouldRemoveFailedNewContainer('x', null, true), false);
});

test('guard: no-op when the new container never started', () => {
    // 빌드 실패 / clone 실패 등 — 시작 전 실패라 정리할 것이 없다
    assert.strictEqual(shouldRemoveFailedNewContainer(null, 'orbitron-myapp-m1old9', false), false);
    assert.strictEqual(shouldRemoveFailedNewContainer('', 'orbitron-myapp-m1old9', false), false);
    assert.strictEqual(shouldRemoveFailedNewContainer(undefined, null, false), false);
});

test('guard: defensive — never removes when new name equals the old name', () => {
    // deployHash 유니크로 이론상 불가하지만, 이 함수가 마지막 방어선
    assert.strictEqual(
        shouldRemoveFailedNewContainer('orbitron-myapp-same1', 'orbitron-myapp-same1', false),
        false
    );
});

test('guard: rejects non-string container names', () => {
    assert.strictEqual(shouldRemoveFailedNewContainer(123, null, false), false);
    assert.strictEqual(shouldRemoveFailedNewContainer({}, null, false), false);
});
