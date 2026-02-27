# 고급 APM 모니터링 연동 (Datadog 등)

> 💡 **출시 예정 기능 (Coming Soon)**
> 
> 이 기능은 현재 Orbitron 엔지니어링 팁에서 열심히 개발 중인 핵심 로드맵 기능입니다.
> 

이미 회사 차원에서 수백만 원짜리 최상급 기업용 애플리케이션 퍼포먼스 모니터링(APM) 툴을 쓰고 계신가요? 
Orbitron은 그런 프로페셔널 팀을 외면하지 않습니다. 여러분이 작성한 소스 코드에 어떤 셋업 로직도 추가할 필요 없이, 인프라 단에서 자동으로 거물급 APM 에이전트들을 주입해 줍니다. 

*   **지원 예정 연동처:** Datadog, New Relic, Sentry, Prometheus/Grafana 에지
*   **에이전트 제로 설정 (Agentless-like):** 대시보드의 `Integrations` 탭에 들어가서 Datadog의 API Key와 Site 주소만 붙여넣으세요. 코드가 빌드될 때 Orbitron 데몬이 알아서 `dd-trace` 등을 엮어서, 여러분의 함수 하나하나가 몇 밀리초(ms) 지연되는지 저쪽 사이트로 로그 폭탄을 쏴줍니다.
