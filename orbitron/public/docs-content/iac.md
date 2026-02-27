# Infrastructure as Code (orbitron.yaml) 완벽 가이드

대시보드 화면상에서 મા우스를 이리저리 조작해가며 세팅을 바꾸는 것도 귀찮으신 베테랑 서버 개발자이신가요? 

**Infrastructure as Code (IaC)**, 이른바 '코드로 짜는 인프라' 기능은 프로젝트 소스 폴더 최상단(Root)에 `orbitron.yaml` 이라는 작은 텍스트 문서 하나만 툭 던져두는 것만으로 대시보드 접속 없이 배포의 모든 세팅(포트, 시작 명령어, 환경 변수 등)을 로봇처럼 자동 결정하는 절대 구문입니다.

---

## 📄 기본 설계 철학 (How it Works)

1. Orbitron 시스템은 GitHub에서 코드를 당겨올 때 가장 먼저 최상단에 `orbitron.yaml` 파일이 숨어있는지 탐색합니다.
2. 만약 발견된다면, 여러분이 대시보드의 웹 UI 폼에서 입력해 둔 값들보다 **이 YAML 파일 안의 명세서를 최우선(Override)**으로 읽고 복종하여 컨테이너 환경을 뚝딱 만들어냅니다.
3. 따라서 코드 로직이 바뀌면서 실행 명령어(Start Command)가 바뀌어야 할 때마다 대시보드에 들어올 필요 없이, 소스 코드랑 같이 YAML 파일 단 한 줄만 푸시해 버리면 서버 아키텍처까지 알아서 변경됩니다!

---

## 🏗 전체 구조 상세 

딱 하나의 `services` 블록 밑에 여러분의 여러 앱들을 쭉 나열하면 끝입니다.
가장 기본적인 문법 구조는 아래와 같습니다.

```yaml
# orbitron.yaml — 이것 만으로 모든 게 끝납니다.
services:
  web:
    # 1. 서버 실행을 위한 준비 명령어 (패키지 설치, 빌드 등)
    build_command: "npm install && npm run build"
    
    # 2. 웹 서버를 영구적으로 켜는 최종 런칭 명령어
    start_command: "npm start"
    
    # 3. 내부 컨테이너가 열고 대기할 포트 번호 명시! (Nginx와 연결 고리)
    port: 3000
    
    # 4. 소스 코드에 은밀하게 숨겨진 환경변수 (Secret 제외)
    env:
      - "NODE_ENV=production"
      - "API_VERSION=v2.5.1"
```

---

## 💡 실전 예제 (Framework Examples)

여러분이 무슨 프레임워크를 좋아할지 몰라서 가장 인기 있는 생태계 3대장의 `orbitron.yaml` 정답 템플릿을 준비했습니다. 복사해서 쓰시면 됩니다!

### 1. Next.js (SSR Node 환경)

```yaml
services:
  web:
    type: web-service
    build_command: "npm ci && npm run build"
    start_command: "npm run start"
    port: 3000
    env:
      - "NODE_ENV=production"
```

### 2. Python Django + Gunicorn (방탄 서버)

파이썬의 경우는 내장 `manage.py runserver`로 상용 배포하면 절대 안 됩니다! 반드시 `pip install gunicorn`을 선행한 뒤, `gunicorn` 이라는 튼튼한 총알받이 서버 모듈로 돌려야 수십 명의 동시 접속 트래픽에 파이프가 터지지 않습니다.

```yaml
services:
  web:
    type: web-service
    build_command: "pip install -r requirements.txt && python manage.py migrate"
    start_command: "gunicorn myproject.wsgi:application --bind 0.0.0.0:8000"
    port: 8000
    env:
      - "DJANGO_SETTINGS_MODULE=myproject.settings.prod"
```

### 3. 정적 사이트 React CRA (Vite, Svelte 등)

오직 순수 HTML 파일들만 광속 CDN으로 서빙하는 경우, 포트(port)나 서버 시작 명령어(start_command) 따위는 개념상 존재하지 않습니다! 빌드 후 어떤 폴더 이름(`dist`, `build`)을 빼내갈 건지만 정확히 지정하세요.

```yaml
services:
  web:
    type: static-site  # 타입이 웹 서비스가 아니라 정적(static)으로 들어갑니다!
    build_command: "npm install && npm run build"
    publish_dir: "build"  # Vite나 Svelte라면 "dist" 로 적으세요
```

아주 간단하죠? Orbitron은 똑똑한 지니 요정처럼 이 종이 한 장을 읽고 인프라를 지어냅니다.
