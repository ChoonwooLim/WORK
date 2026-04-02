# 정적 사이트 (Static Sites)

정적 사이트 배포는 React, Vue, Svelte, Next.js(Static Export), 순수 HTML/CSS/JS 프론트엔드 프로젝트를 번개처럼 빠른 속도로 전 세계에 서비스하기 위한 최적의 방법입니다.

서버 사이드 렌더링(SSR)이나 데이터베이스 연결 로직 없이, 완성된 화면 파일만 제공하는 프로젝트는 굳이 무거운 서버(Web Service)를 쓸 필요가 없습니다.

---

## ⚡ 왜 Static Site 인가요?

*   **초고속 CDN (Content Delivery Network)**: 여러분의 사이트 파일(이미지, HTML)들이 전 세계 에지(Edge) 네트워크에 분산 복사되어 캐싱됩니다. 한국에서 접속하면 서울 서버에서, 미국에서 접속하면 LA 서버에서 파일이 꽂히므로 로딩 체감 속도가 차원이 다릅니다.
*   **0원 (무료)**: 서버 연산을 계속 돌려둘 필요가 없으므로 컴퓨트 비용이 전혀 발생하지 않습니다. 무료 티어에서도 100% 무제한 제공됩니다.
*   **DDOS 절대 방어**: 뒤에 서버가 없으므로, 트래픽 폭탄 공격이 와도 캐시망 차원에서 튕겨내 버리며 서버가 다운되지 않습니다.

---

## 🚀 Cloudflare Pages 자동 배포

> ✨ **2026.03 신규**: `orbitron.yaml`에 `type: static`으로 정의된 서비스나, Smart Project Analyzer가 순수 프론트엔드로 감지한 앱은 **Cloudflare Pages에 자동으로 배포**됩니다!

### 자동 배포 흐름

1. **감지** — Orbitron이 프로젝트 내 프론트엔드 디렉토리를 자동으로 찾습니다
2. **CF Pages 프로젝트 생성** — Cloudflare Pages에 해당 이름의 프로젝트가 없으면 자동 생성
3. **빌드** — `npm install && npm run build` 실행 (커스텀 빌드 명령어 지원)
4. **배포** — `dist` 폴더를 Cloudflare Pages CDN에 업로드
5. **URL 발급** — `https://{서비스명}.pages.dev` 즉시 활성화

### 멀티 프론트엔드 자동 배포

하나의 레포에 프론트엔드 앱이 여러 개 있어도 전부 자동으로 각각 배포됩니다!

```yaml
# orbitron.yaml 예제 — 관리자 앱 + 직원 앱 동시 배포
services:
  - name: my-admin       # → https://my-admin.pages.dev
    type: static
    rootDir: apps/admin
    build:
      command: "npm install && npm run build"
    publish: ./dist

  - name: my-staff        # → https://my-staff.pages.dev  
    type: static
    rootDir: apps/staff-app
    build:
      command: "npm install && npm run build"
    publish: ./dist
    pwa: true
```

> `orbitron.yaml` 없이도 Smart Project Analyzer가 `package.json`에 React/Vue/Vite 의존성이 있는 디렉토리를 찾아 자동으로 `static` 타입으로 분류하고 CF Pages에 배포합니다.

---

## 자동 감지 프레임워크 목록

ZIP으로 압축해서 업로드하거나, GitHub를 연동할 때 아래의 프레임워크 구조가 발견되면 Orbitron이 알아서 "아! 정적 사이트구나!" 하고 빌드를 진행합니다.

| 프레임워크 | 감지 기준 | 기본 빌드 폴더 |
|-----------|-----------|---------------|
| React (CRA) | `react-scripts` in package.json | `build` |
| Vite + React | `@vitejs/plugin-react` in package.json | `dist` |
| Vite + Vue | `vite` + `vue` in package.json | `dist` |
| Vite + Svelte | `vite` + `svelte` in package.json | `dist` |
| Vue.js | `vue` in package.json | `dist` |
| Nuxt.js | `nuxt` in package.json | `.output/public` |
| Svelte / SvelteKit | `svelte` in package.json | `dist` |
| Angular | `@angular/core` in package.json | `dist` |
| Next.js (Static) | `next` + `output: 'export'` | `out` |
| 순수 HTML | `index.html` in root | (빌드 불필요) |

---

## 빌드 폴더 (Publish Directory) 설정

정적 사이트를 배포할 때 가장 중요한 것은 **빌드 결과물이 담긴 폴더의 이름**입니다.
React 코드를 짜고 나서 `npm run build` 를 실행하면 나오는 최종 배포판 폴더를 Orbitron 엔진이 가져가서 띄웁니다.

단, 프레임워크마다 이 폴더 이름이 다릅니다!
*   **React (CRA)**: `build`
*   **Vite, Vue, Svelte**: `dist`
*   **Next.js**: `out`

Orbitron 대시보드 설정 창의 **`Publish Directory`** 란에 본인의 프레임워크에 맞는 폴더 이름을 정확히 적어주셔야 404 에러가 나지 않습니다. (기본값은 `dist` 또는 `build`를 자동 탐색합니다)

---

## 단일 페이지 애플리케이션 (SPA) 라우팅 처리

React나 Vue처럼 클라이언트단에서 URL 주소를 바꾸는 SPA 프레임워크의 고질적 문제가 있습니다.
서브 페이지(예: `https://myapp.com/about`)로 들어간 상태에서 유저가 **새로고침(F5)**을 누르면, Nginx 서버는 진짜로 하드디스크에 `about.html` 이라는 파일이 있는지 찾으려고 하다가 `404 Not Found` 에러를 뱉습니다.

> ✅ **자동 라우팅 폴백(Fallback)**
> Orbitron은 `Static Site` 모드로 배포된 모든 프로젝트에 대해, 사용자가 요청한 주소에 파일이 없다면 **무조건 최상단의 `index.html` 파일을 대신 응답**하도록 똑똑하게 프록시 Nginx 규칙이 사전 세팅되어 있습니다. 따라서 별도의 Rewrite 규칙을 짤 필요 없이 React Router 등이 완벽하게 작동합니다!

---

## 📱 PWA (Progressive Web App) 지원

`orbitron.yaml`에서 `pwa: true`를 설정하면 서비스 워커 캐싱이 활성화되어 오프라인에서도 앱이 작동합니다.

```yaml
services:
  - name: my-pwa-app
    type: static
    rootDir: apps/mobile
    publish: ./dist
    pwa: true
```

> ⚠️ **서비스 워커 캐시 주의**: PWA가 활성화된 앱은 업데이트 시 사용자 브라우저의 서비스 워커 캐시에 이전 버전이 남아있을 수 있습니다. 이 경우 브라우저 DevTools의 Application → Service Workers에서 `Unregister`를 클릭하거나 `Clear site data`를 실행하면 됩니다.

---

## 🛠 정적 사이트 주요 트러블슈팅

### 1. 배포 성공 로그가 뜨는데 화면은 구버전인 경우
수동으로 작성한 커스텀 배포 훅이나 CI를 사용할 때, CLI 명령어에 브랜치를 명시하지 않으면 Cloudflare Pages가 임시 프리뷰(Preview) 환경에만 배포를 진행합니다.
*   **해결 방법**: 배포 명령어에 `--branch main` 파라미터를 강제 추가하여 실서버 도메인으로 덮어쓰기하도록 설정하세요.

### 2. 한글 커밋 메시지로 인한 배포 실패 (Code 8000111)
Wrangler는 GitHub의 마지막 커밋 메시지를 읽어 배포 내역으로 기록하는데, 리눅스 환경에서 한글 커밋을 읽을 때 UTF-8 문자열 변환 오류가 발생하는 알려진 버그가 있습니다.
*   **해결 방법**: 배포 명령어 뒤에 `--commit-message="Auto Deploy"`를 붙여 커밋 메시지 읽기를 스킵하도록 구성하세요.
