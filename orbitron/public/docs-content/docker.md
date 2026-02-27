# Docker 커스텀 & 다중 배포 (Docker Compose)

단순한 Node.js나 Python 앱을 넘어, 아예 여러분만의 운영체제 환경을 꾸린 `Dockerfile` 기반의 커스텀 이미지를 배포하거나 여러 개의 컨테이너를 하나로 묶어 배포해야 할 때 사용하는 고급 기능입니다.

---

## 1. 단일 Docker 배포 (Dockerfile)

여러분의 프로젝트 폴더 최상단(루트 디렉토리)에 `Dockerfile` 이 존재한다면, Orbitron은 즉시 정적 사이트나 기본 웹 서비스 빌드 파이프라인을 중지하고 **Docker Build 엔진**을 가동합니다.

1.  GitHub 레포지토리에 `Dockerfile`을 푸시합니다.
2.  Orbitron 대시보드에서 `웹 서비스(Web Service)`로 배포합니다.
3.  시스템이 이미지 빌드 중 발생하는 모든 계층(`layers`) 단계를 로그에 출력하며 빌드를 완료합니다.

> 📝 **Docker 배포 시 주의사항 (EXPOSE)**
> Orbitron 라우터가 외부 80/443번 포트 트래픽을 여러분의 컨테이너 안으로 무사히 전달하려면, `Dockerfile` 내부에 반드시 `EXPOSE 3000`(또는 여러분이 사용하는 포트) 명령어가 선언되어 있어야 합니다. 그래야 Orbitron이 어떤 포트로 트래픽을 넘겨줄지 알 수 있습니다.

---

## 2. 멀티 컨테이너 (Docker Compose) 오케스트레이션

프론트엔드(`React`), API 서버(`Django`), 자체 캐시 메모리(`Redis`), 워커 프로세스(`Celery` 등) 여러 개의 별도 컨테이너가 하나처럼 유기적으로 맞물려 돌아가는 거대한 풀스택 시스템을 배포하고 싶으신가요?

Orbitron은 `docker-compose.yml` 리딩을 완벽하게 지원하는 강력한 오케스트레이터입니다. 오직 한 번의 클릭과 푸시(Push)만으로 여러 대의 가상 서버가 동시에 군단처럼 켜집니다.

### 사용 방법 (스마트 라우팅)

1.  프로젝트 폴더 최상단에 `docker-compose.yml` (또는 `.yaml`) 파일을 위치시킵니다.
2.  대시보드에서 배포를 진행하면, Orbitron은 단일 이미지 빌드를 뛰어넘고 전체 스택을 백그라운드로 한꺼번에 가동합니다.
3.  **라우팅 마법:** 전체 컨테이너 중, **외부 인터넷에 노출해야 하는(사용자 브라우저와 접점인) 단 하나의 메인 서비스**를 찾아야 합니다. Orbitron은 여러분의 yml 파일 안에서 `web`, `app`, `api` 등의 이름표(Service Name)를 가진 블록을 최우선적으로 찾아내어 외부 글로벌 트래픽의 도착지로 연결(포트포워딩)해 줍니다. 

### `docker-compose.yml` 예제

아래 예시에서 Orbitron은 `web` 서비스가 유저와 만나는 문(Door)이라고 스스로 판단하고 외부 호스트명(Twinverse)을 3000번 포트에 꽂아줍니다!

```yaml
version: '3.8'

services:
  web:                     # <-- Orbitron이 자동으로 이곳을 글로벌 라우팅의 메인 목적지로 삼습니다.
    build: 
      context: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - api-server

  api-server:              # 이건 백엔드 API (web 서비스에서 호출)
    build: 
      context: ./backend
    environment:
      - REDIS_URL=redis://redis-cache:6379

  redis-cache:             # 이건 내부에서만 도는 캐시 메모리 컨테이너
    image: redis:alpine
    # 포트를 외부에 열 일이 없으므로 안 적어도 됨
```

### Docker Compose 활용 팁
*   각 컨테이너끼린 파일 안에 명시된 **서비스 이름 (예: `api-server`, `redis-cache`)** 그 자체를 도메인 주소(Host)로 사용하여 통신할 수 있습니다.
*   백그라운드에서만 도는 워커 노드 같은 것들은 포트 설정 없이 그냥 정의해두기만 하면 알아서 돕니다.
