# Orbitron: The Ultimate Serverless & Game Deployment Platform

## 1. 개요 (Overview)
**Orbitron(오비트론)**은 복잡한 서버 인프라 지식 없이도 누구나 자신의 웹 애플리케이션, 데이터베이스, 심지어 **언리얼 엔진(Unreal Engine) 및 유니티(Unity) 게임**까지 단 몇 번의 클릭으로 클라우드에 배포할 수 있도록 돕는 혁신적인 **올인원 배포 자동화 대시보드(All-in-One Deployment Dashboard)**입니다.

Orbitron은 개발자가 코딩과 콘텐츠 자체에만 집중할 수 있도록 "서버리스(Serverless)" 라이크한 경험을 제공하며, 내부적으로 Docker, Nginx, PM2, Cloudflare Tunnel 기반의 강력한 자동화 아키텍처를 갖추고 있습니다.

## 2. 타겟 고객 및 핵심 가치 (Target Audience & Value Proposition)
### 타겟 고객
- **인디 게임 개발자 및 스튜디오**: 언리얼/유니티로 만든 게임을 전 세계 유저들이 웹 환경에서 다운로드 없이 플레이(Pixel Streaming & WebGL)할 수 있게 만들고 싶을 때.
- **백엔드/프론트엔드 개발자**: GitHub에 코드를 푸시하기만 하면 즉시 서버에 빌드, 컨테이너화, 자동 배포가 이루어지는 CI/CD 환경을 원할 때.
- **IT 교육 기관 및 해커톤 참가자**: 서버 호스팅, 도메인 연결, 인증서 발급 등 번거로운 과정 없이 빠르게 프로토타입을 공개해야 할 때.

### 핵심 가치 (Value Propositions)
1. **Zero Configuration**: 포트 설정, 리버스 프록시, 도메인 연결 등 복잡한 네트워크 설정을 사용자 몰래 자동으로 처리합니다.
2. **다중 게임 엔진 지원**: 게임 클라이언트를 클라우드로 스트리밍하는 **언리얼 엔진 픽셀 스트리밍(Pixel Streaming)** 기능과 맵핑된 **유니티 WebGL** 빌드 자동 호스팅을 특별히 지원합니다.
3. **무중단 운영 자동화**: 서버 재부팅 시 앱 복구(Systemd/PM2), GitHub 훅 연동을 통한 무중단 CI/CD 롤백 기능 탑재.

---

## 3. 주요 핵심 기능 (Core Features)

### 🚀 1. 원클릭 배포 및 자동화 CI/CD (GitHub 연동)
사용자는 GitHub 레포지토리 주소만 입력하면 됩니다. 
Orbitron은 실시간으로 코드를 Pull하고, 자동으로 Docker 컨테이너를 빌드 및 실행합니다. 프로젝트 소스 코드에 변경이 발생하면 GitHub Webhook을 통해 감지하여 백그라운드에서 새로운 컨테이너로 **자동 무중단 배포(Auto-Deploy)**를 수행합니다.

### 🌐 2. 서버리스 네트워킹 & Cloudflare Tunnels 내장
배포된 모든 앱은 로컬 네트워크 밖에서도 즉시 접속할 수 있도록 **자동으로 서브도메인이 할당**됩니다 (`https://[프로젝트명].twinverse.org`).
Vercel이나 Netlify처럼 개발자가 복잡한 포트포워딩이나 인증서 발급(SSL/HTTPS)을 신경 쓸 필요 없이, 백엔드의 `Cloudflare Tunnel (cloudflared)` 서비스가 안전하고 빠른 글로벌 엣지 연결을 1초 만에 구성합니다.

### 🎮 3. 언리얼 엔진 픽셀 스트리밍 (Unreal Engine Pixel Streaming) 전용 호스팅
고성능 데스크톱 앱인 언리얼 엔진 게임을 브라우저에서 실행할 수 있는 "클라우드 게이밍" 아키텍처를 내장했습니다. 
- GPU 할당을 최적화(`--gpus` 동적 할당 방식)하여 한 서버에서 여러 인스턴스가 독립적으로 구동되게 합니다. (Ex: `GTX 1080`과 같은 듀얼 GPU 자동 할당 등).
- 미사용 세션(디버그된 좀비 컨테이너)은 백그라운드에서 추적되어 1분마다 정리되어 불필요한 서버 자원 독점을 막습니다.

### 🎲 4. 유니티 WebGL (Unity WebGL) 자동 배포
데스크톱 빌드를 WebGL로 뽑은 ZIP 파일을 업로드하면, 즉시 경량 Nginx 컨테이너 환경에서 게임을 서비스합니다. 게임을 공유하기 위한 URL 생성까지 단 10초가 소요됩니다.

### 🗄 5. 매니지드 데이터베이스 런처 & 워커 엔진
프로젝트에 필요한 `PostgreSQL`이나 `Redis` 같은 데이터베이스를 클릭 한 번으로 가상 네트워크 망에 생성합니다. 동일한 Orbitron 대시보드 내의 앱들은 서로 프라이빗 네트워크(`orbitron_internal`)를 통해 외부에 데이터베이스를 노출하지 않고 직접 고속 통신할 수 있습니다.
또한 외부 포트를 열지 않고 백그라운드 데이터 처리만 담당하는 **Background Worker** 컨테이너 모드를 완벽하게 지원합니다.

### 🛡️ 6. 실시간 자원 모니터링 및 AI 어시스턴트 디버깅 (AI Analyzer)
대시보드 상에서 실행 중인 컨테이너의 콘솔을 확인하고 환경 변수를 실시간으로 주입(`Bulk Import .env`) 할 수 있습니다. 빌드 중 혹은 실행 중 에러가 발생한 경우, 엮어진 로그를 **내장된 AI 어시스턴트 엔진**에 넘겨 문제의 원인과 해결 코드를 즉석에서 추천받는 강력한 오류 대응력을 자랑합니다.

### ⚙️ 7. Infrastructure-as-Code (IaC) 적용
개발자가 프로젝트 루트 폴더에 `orbitron.yaml` 파일만 넣어두면, 빌드 명령어, 시작 명령어, 포트 설정 및 내부 환경 변수를 Orbitron 엔진이 감지하여 프로젝트 설정들을 대시보드의 개입 없이 동적으로 덮어씌웁니다 (`Override`). 

---

## 4. 인프라 아키텍처 및 보안 (Architecture & Security)
- **Host System**: 리눅스 기반 Docker 호스트 엔진. Systemd 데몬으로 서버 레벨의 재시작 시 자동 복구를 지원.
- **Traffic Routing**: Cloudflare Tunnels -> 로컬 Nginx Reverse Proxy -> 개별 Docker 컨테이너 및 Pixel Streaming Session 간 다이나믹 매핑.
- **Data Protection**: 환경 변수(`env_vars`)나 API Key 등의 민감한 정보는 AES-256 기반 단방향/양방향 암호화(`db/crypto.js`)를 거쳐 Database에 저장. 추가로, 사용자 의도 없이 데이터가 유실되지 않도록 **전체 자동 드라이브 백업(Project & Media Backup)** 파이프라인이 매 배포마다 동작.

---

## 5. 결론: 왜 Orbitron인가?
- 기존의 AWS EC2, GCP 서버 관리 방식을 아는 **DevOps 엔지니어가 팀에 없어도**,
- 개발자 본인이 인프라 트러블슈팅에 긴 밤을 지새우지 않아도,
- 단타성 게임 프로토타입이나 무거운 언리얼 빌드를 누구나 즉시 시연할 수 있게 해주는 **"개발자를 위한 우주정거장(Orbitron)"**입니다.
