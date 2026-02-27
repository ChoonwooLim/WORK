# 정적 사이트 (Static Sites)

정적 사이트 배포는 React, Vue, Svelte, Next.js(Static Export), 순수 HTML/CSS/JS 프론트엔드 프로젝트를 번개처럼 빠른 속도로 전 세계에 서비스하기 위한 최적의 방법입니다.

서버 사이드 렌더링(SSR)이나 데이터베이스 연결 로직 없이, 완성된 화면 파일만 제공하는 프로젝트는 굳이 무거운 서버(Web Service)를 쓸 필요가 없습니다.

---

## ⚡ 왜 Static Site 인가요?

*   **초고속 CDN (Content Delivery Network)**: 여러분의 사이트 파일(이미지, HTML)들이 전 세계 에지(Edge) 네트워크에 분산 복사되어 캐싱됩니다. 한국에서 접속하면 서울 서버에서, 미국에서 접속하면 LA 서버에서 파일이 꽂히므로 로딩 체감 속도가 차원이 다릅니다.
*   **0원 (무료)**: 서버 연산을 계속 돌려둘 필요가 없으므로 컴퓨트 비용이 전혀 발생하지 않습니다. 무료 티어에서도 100% 무제한 제공됩니다.
*   **DDOS 절대 방어**: 뒤에 서버가 없으므로, 트래픽 폭탄 공격이 와도 캐시망 차원에서 튕겨내 버리며 서버가 다운되지 않습니다.

---

## 자동 감지 프레임워크 목록

ZIP으로 압축해서 업로드하거나, GitHub를 연동할 때 아래의 프레임워크 구조가 발견되면 Orbitron이 알아서 "아! 정적 사이트구나!" 하고 빌드를 진행합니다.

*   `React` (Create React App)
*   `Vite` 기반의 모든 SPA 프로젝트
*   `Vue.js` & `Nuxt.js`
*   `Svelte` & `SvelteKit`
*   `Gatsby`
*   `Next.js` (단, `output: 'export'` 로 설정된 경우에만 완벽 호환)

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
