# 백엔드 웹 서비스 (Web Services)

Node.js, Python(Django/FastAPI), Go, Rust 라이브 서버나 REST API를 배포해야 하나요? **웹 서비스 (Web Services)** 타입이 정답입니다!

웹 서비스는 정적인 파일만을 보여주는 프론트엔드와 달리, 서버가 항상 켜져서 데이터베이스와 통신하고 동적인 로직을 처리하는 컨테이너 환경을 의미합니다.

---

## 기본 지원 언어 및 프레임워크

Orbitron은 전 세계에서 가장 많이 쓰이는 백엔드 생태계를 별도의 잡다한 설정(Dockerfile 등) 없이 소스 코드만으로 즉시 구별하고 빌드해 냅니다.

*   **Node.js**: `package.json` 하나만 있으면 됩니다. (Express.js, NestJS 등 완벽 지원)
*   **Python**: `requirements.txt` 나 `Pipfile` 을 감지하여 패키지를 설치하고 구동합니다.
*   **Go & Rust**: 컴파일 언어의 특성에 맞춰 알아서 빌드 후 초경량 바이너리 이미지만을 띄웁니다.

---

## 포트(Port) 바인딩 규칙

배포가 실패하는 가장 흔한 이유는 "서버가 엉뚱한 포트를 바라보고 있기" 때문입니다.

> ⚠️ **매우 중요**
> 컨테이너 기반 서버는 웹 브라우저가 접속하는 **80번, 443번 포트로 직접 열면 절대 안 됩니다.**

여러분의 코드 속 서버 구동 파일 (예: `server.js` 또는 `main.py`) 에서는 다음과 같이 코딩해야 합니다.

### Node.js (Express) 예제
```javascript
// 하드코딩 금지! 환경변수 PORT를 우선적으로 수용하게 만드세요.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
```

Orbitron은 배포 시 내부적으로 여러분의 앱과 연결할 포트를 자동으로 할당하며, 이를 환경 변수 `PORT` 로 주입합니다. 앱은 이 `PORT` 번호를 열고 신호를 기다리기만 하면 나머지는 Orbitron Nginx 라우터가 앞단의 URL 트래픽을 해당 포트로 토스해 줍니다!

---

## 시작 명령어 (Start Command) 맞춤 설정

소스 코드에 따라 시스템이 기본적으로 실행하는 명령어(`npm start` 등)가 맞지 않을 수 있습니다.
대시보드의 **Settings > Build & Run** 탭에서 이를 덮어쓸 수 있습니다.

*   **Build Command**: 코드를 실행하기 전 준비 단계 명렁어입니다. (예: `npm install && npm run build`, `pip install -r requirements.txt`)
*   **Start Command**: 웹 서버를 런칭하는 최종 명령어입니다. (예: `node dist/main.js`, `gunicorn myapp.wsgi`)

---

## 문제 해결 가이드 (Troubleshooting)

배포에 실패하여 Dashboard가 'Failed'를 띄운다면, 아래의 사항을 체크해보세요.
1.  **빌드 로그 확인**: 터미널 형태의 검은색 빌드 창 화면을 확인하세요. `Module not found` 에러가 있다면 `package.json` 등에 빼먹은 모듈이 있는 것입니다.
2.  **IP 바인딩 오류 (Python 등)**: Flask나 FastAPI 등을 띄울 때 로컬호스트(`127.0.0.1`)로 열면 외부에서 접속이 안 됩니다. 반드시 호스트를 전방위인 `0.0.0.0`으로 열어야 합니다. (예: `uvicorn main:app --host 0.0.0.0`)
3.  **[AI 에러 분석기](#/ai-analyzer)**: 그래도 모르겠다면 `💬 AI 분석` 버튼을 누르세요. Claude AI 기술이 여러분의 로그를 분석해 정확한 한국어 해결책을 진단해 줍니다.
