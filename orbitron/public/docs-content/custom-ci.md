# 커스텀 CI/CD 통합 (GitHub Actions, GitLab)

> 💡 **출시 예정 기능 (Coming Soon)**
> 
> 이 기능은 현재 Orbitron 엔지니어링 팁에서 열심히 개발 중인 핵심 로드맵 기능입니다.
> 

현재 지원하는 GitHub `push` 이벤트 기반의 자동 배포를 넘어, 엔터프라이즈 레벨의 정교한 파이프라인 연계를 지원합니다. 

여러분이 기존에 사내에서 사용하고 계시던 다양한 CI(Continuous Integration) 도구들과 Orbitron의 초고속 CD(Continuous Deployment) 엔진을 매끄럽게 결합할 수 있습니다.

*   **GitHub Actions 연동**: 테스트 코드(Jest, PyTest) 커버리지가 80%를 넘겼을 때만 조건부 배포 파이프라인 트리거.
*   **GitLab / Bitbucket 지원**: GitHub 외부 생태계 사용자를 위한 전용 Webhook Payload 제공.
*   **커스텀 API 배포 트리거**: 단순한 `cURL` POST 요청 한 번으로 최신 컨테이너 이미지를 강제 교체할 수 있는 인증 기반 Deploy Hook API.
