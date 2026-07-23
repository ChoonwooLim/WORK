'use strict';

// ── Zero-downtime 배포 규칙 (순수 함수) ──────────────────────────────────────
// deployer._doDeploy 의 catch 경로가 "실패한 새 웹 컨테이너"를 정리할지
// 판정한다. 오케스트레이션 자체는 부수효과 덩어리라 단위 테스트가 어려우므로
// 판정 로직만 여기로 분리해 핀한다 (test/deployRules.test.js).
//
// 절대 불변식: 실패 경로에서 구(舊) 컨테이너는 어떤 경우에도 제거되지 않는다.
//   - newContainerName 이 없으면(컨테이너 시작 전 실패) 정리할 것도 없다.
//   - nginx 전환이 이미 끝난 뒤의 실패라면 새 컨테이너가 트래픽을 받고 있다
//     — 제거 금지 (구+신 모두 살려두고 다음 배포의 정리에 맡긴다).
//   - 방어적 이중 가드: 새 이름이 구 이름과 같으면 제거하지 않는다
//     (deployHash 가 유니크라 이론상 불가하지만, 이 함수가 마지막 방어선).
function shouldRemoveFailedNewContainer(newContainerName, oldContainerName, nginxSwitched) {
    if (!newContainerName || typeof newContainerName !== 'string') return false;
    if (nginxSwitched) return false;
    if (oldContainerName && newContainerName === oldContainerName) return false;
    return true;
}

module.exports = { shouldRemoveFailedNewContainer };
