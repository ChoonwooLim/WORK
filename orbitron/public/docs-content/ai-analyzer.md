# 천재 AI 어시스턴트 (에러 트러블슈팅)

배포 중 검은 화면에 시뻘건 에러 터미널 로그가 멈추지 않아 당황하신 적 있으신가요? 

> `ModuleNotFoundError: No module named 'django.core.wsgi'`
> `Error: listen EADDRINUSE: address already in use :::3000`

이런 끔찍한 에러를 만났을 때 보통 구글링(구글 검색)이나 스택 오버플로우를 뒤지느라 수십 분을 낭비하곤 합니다만, Orbitron 시스템 뒤엔 여러분의 에러 코드를 1초 만에 간파하는 **초정밀 인공지능 엔지니어(Claude, Gemini)**가 대기하고 있습니다.

---

## 🔑 AI 어시스턴트 설정 방법

이 기능을 쓰려면 우선 인공지능 두뇌를 빌려올 열쇠(API Key)를 여러분이 직접 꽂아두어야 합니다. 한 번만 해두면 평생 당신의 전담 코딩 비서가 생깁니다.

1.  대시보드 우측 상단 톱니바퀴 아이콘인 **`설정(Settings)`** 메뉴로 들어갑니다.
2.  **`LLM 설정`** 탭을 클릭하면 구글 최강의 AI 창(Gemini)과 앤스로픽 1티어 코딩 특화 AI 창(Claude)이 보일 것입니다.
3.  원하는 회사의 사이트로 넘어가 회원가입을 하고 `API Key(비밀키)`를 무료로 발급받아 빈칸에 붙여넣고 저장(Save)합니다.
4.  이제 시스템 대시보드 하단의 인공지능 뇌 활성화 스위치가 초록불(ON)로 켜집니다.

---

## 🩺 실전 활용: "어디 고쳐야 해?"

이제 모든 준비가 끝났습니다! 나중에 배포 중 컨테이너가 폭파(Build Failed)되거나 런타임에 뻑이 났다면, 좌측 하단의 빨갛게 물든 프로젝트를 클릭하세요.

1. 로그(Log) 패널 옆에 붙어있는 반짝이는 **`💬 AI 분석 요청`** 버튼을 누릅니다.
2. 시스템이 방금 수백 줄에 걸쳐 뿜어낸 시뻘건 에러 텍스트 통째로 복사해서, 여러분의 언어(Node.js, Python 등) 문맥과 함께 AI 뇌로 전송합니다.
3. 2~3초 뒤, **"왜 터졌고, 어떤 파일을 열어서 코드 몇 번째 줄을 어떻게 수정해야 해결되는지"** 완벽한 한국어로 답변이 도착합니다! 

```markdown
> 💡 AI 분석 결과:
>
> 포트 바인딩 중복 에러네요!
> 지금 `src/main.js` 에서 이미 3000번 포트로 서버를 열었는데, Orbitron이 밖에서 3000번 포트를 
> 한 번 더 열려고 하다가 충돌(EADDRINUSE)이 났습니다.
> 코드를 아래와 같이 수정하세요.
> 
> ```javascript
> // 수정 전
> app.listen(3000); 
> 
> // 수정 후 (환경변수 수용 허락)
> app.listen(process.env.PORT || 3000);
> ```
```

이런 식으로 친절한 조언을 받아 즉시 깃허브 코드를 수정하고 푸시(Push)하시면 끝입니다. 스트레스 없는 디버깅 라이프를 즐기세요!

---

## 🧠 스마트 프로젝트 분석기 (Smart Project Analyzer)

> ✨ **2026.03 신규**: AI 에러 분석 외에도, Orbitron은 이제 배포 시 **프로젝트 구조를 자동으로 100% 분석**합니다!

### 자동 감지 항목

배포가 시작되면 Orbitron의 빌트인 **프로젝트 분석기**가 전체 레포를 스캔하여 다음을 자동으로 파악합니다:

| 분석 항목 | 감지 방법 | 예시 |
|-----------|-----------|------|
| **런타임** | 설정 파일로 판별 | `package.json` → Node.js, `requirements.txt` → Python |
| **프레임워크** | 의존성 패키지 분석 | `fastapi` → FastAPI, `@vitejs/plugin-react` → Vite+React |
| **서비스 타입** | 프레임워크 + 디렉토리명 | backend → Docker, frontend → CF Pages |
| **포트 번호** | 코드/설정에서 추출 | `--port 8000`, `process.env.PORT` 등 |
| **빌드 명령어** | scripts 분석 | `npm install && npm run build` |
| **시작 명령어** | 엔트리포인트 분석 | `uvicorn main:app`, `npm start` |
| **의존관계** | 환경변수/디렉토리명 | frontend가 backend URL을 참조 |

### 배포 로그 예시

```
📊 프로젝트 구조 분석 결과 (소스: auto-detect)
   프로젝트: sodamfn
   서비스: 3개
   데이터베이스: 0개

   🌐 app-backend
      타입: web | 런타임: python | 프레임워크: fastapi
      배포: Docker | 디렉토리: SodamApp/backend
      포트: 8000

   📄 app-frontend
      타입: static | 런타임: node | 프레임워크: vite-react  
      배포: CF Pages | 디렉토리: SodamApp/frontend
      의존: app-backend

   📄 app-staff-app
      타입: static | 런타임: node | 프레임워크: vite-react
      배포: CF Pages | 디렉토리: SodamApp/staff-app
      의존: app-backend
```

### orbitron.yaml 없이도 동작

`orbitron.yaml`이 없는 프로젝트도 Smart Project Analyzer가 레포 전체를 스캔하여 `package.json`, `requirements.txt` 등의 마커 파일로부터 모든 서비스를 자동 감지합니다.

`orbitron.yaml`이 있으면 해당 설정이 **절대 권위**로 사용되고, Analyzer는 누락된 정보(포트, 프레임워크 등)만 보완합니다.

---

## 📚 에러 지식 데이터베이스 (Error Knowledge DB)

> ✨ **2026.03 신규**: 과거에 해결한 에러 패턴을 학습하여 같은 에러 재발 시 즉각 해결책을 제시합니다!

Orbitron은 AI가 분석한 에러와 그 해결책을 **에러 지식 DB(Error Knowledge Database)**에 자동 저장합니다.

### 작동 방식

1. **에러 발생** → AI가 분석하여 원인과 해결책 도출
2. **패턴 저장** → 에러 메시지의 핵심 패턴, 근본 원인, 해결 방법을 DB에 기록
3. **재발 시 즉시 해결** → 같은 패턴의 에러가 다시 발생하면 AI 분석 없이 **즉시 과거 해결책을 제안**
4. **성공 횟수 추적** → 같은 해결책으로 몇 번이나 성공했는지 카운트하여 신뢰도 표시

### 저장되는 정보

| 항목 | 설명 |
|------|------|
| **에러 패턴** | 에러 메시지의 핵심 키워드 (자동 추출) |
| **근본 원인** | 왜 이 에러가 발생했는지 상세 설명 |
| **해결 방법** | 구체적인 수정 방법 (코드 패치 포함 가능) |
| **성공 횟수** | 이 해결책이 과거에 몇 번 성공했는지 |
| **출처** | `auto_repair` (자동 수리), `chat_fix` (AI 채팅), `manual` (수동 기록) |

### 실전 예시

```
📚 에러 지식 DB 매칭 결과:
   패턴: "orbitron.yaml에 정의된 static 타입 서비스가 CF Pages에 배포되지 않음"
   근본 원인: deployer가 services 배열의 type:static 서비스를 무시하고 있었음
   해결책: cfPagesDeployer 서비스를 통한 자동 빌드/배포 파이프라인 추가
   성공 횟수: 1회
```

이처럼 Orbitron은 시간이 지날수록 더 많은 에러를 기억하고 더 빠르게 해결하는 **학습하는 배포 플랫폼**입니다!
