<style>
/* Premium IR Deck Styles Embedded */
.ir-deck {
font-family: 'Inter', sans-serif;
color: #e6edf3;
max-width: 1000px;
margin: 0 auto;
line-height: 1.6;
}
.ir-hero {
position: relative;
border-radius: 16px;
overflow: hidden;
margin-bottom: 48px;
box-shadow: 0 20px 40px rgba(0,0,0,0.5);
border: 1px solid rgba(255,255,255,0.1);
}
.ir-hero img {
width: 100%;
height: 400px;
object-fit: cover;
object-position: center;
display: block;
filter: brightness(0.7);
transition: filter 0.5s ease;
}
.ir-hero:hover img {
filter: brightness(0.9);
}
.ir-hero-content {
position: absolute;
bottom: 0;
left: 0;
width: 100%;
padding: 40px;
background: linear-gradient(to top, rgba(5,8,15,0.95), transparent);
}
.ir-hero-title {
font-size: 42px;
font-weight: 800;
margin-bottom: 8px;
background: linear-gradient(90deg, #58a6ff, #bd93f9);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
letter-spacing: -1px;
}
.ir-hero-subtitle {
font-size: 20px;
color: #b1bac4;
font-weight: 500;
}
.ir-section {
margin-bottom: 56px;
}
.ir-section-header {
font-size: 28px;
font-weight: 700;
margin-bottom: 24px;
border-bottom: 1px solid rgba(255,255,255,0.1);
padding-bottom: 12px;
display: inline-block;
}
.ir-grid {
display: grid;
grid-template-columns: 1fr 1fr;
gap: 24px;
}
.ir-card {
background: rgba(255, 255, 255, 0.03);
border: 1px solid rgba(255, 255, 255, 0.08);
border-radius: 12px;
padding: 24px;
backdrop-filter: blur(10px);
transition: transform 0.3s ease, box-shadow 0.3s ease;
}
.ir-card:hover {
transform: translateY(-5px);
box-shadow: 0 10px 30px rgba(88, 166, 255, 0.1);
border-color: rgba(88, 166, 255, 0.3);
}
.ir-card h3 {
font-size: 20px;
color: #58a6ff;
margin-top: 0;
margin-bottom: 12px;
display: flex;
align-items: center;
gap: 8px;
}
.ir-card p {
font-size: 15px;
color: #8b949e;
margin: 0;
}
.ir-table-wrapper {
overflow-x: auto;
background: rgba(15, 23, 42, 0.5);
border-radius: 12px;
border: 1px solid rgba(255,255,255,0.1);
padding: 20px;
margin-top: 24px;
}
.ir-table {
width: 100%;
border-collapse: collapse;
font-size: 14px;
text-align: right;
}
.ir-table th, .ir-table td {
padding: 12px 16px;
border-bottom: 1px solid rgba(255,255,255,0.05);
}
.ir-table th {
color: #8b949e;
font-weight: 600;
text-transform: uppercase;
font-size: 12px;
letter-spacing: 0.5px;
}
.ir-table td:first-child, .ir-table th:first-child {
text-align: left;
font-weight: 600;
color: #c9d1d9;
}
.ir-table .highlight-row td {
background: rgba(88, 166, 255, 0.05);
color: #58a6ff;
font-weight: 700;
border-bottom: 1px solid rgba(88, 166, 255, 0.2);
}
.ir-table .metric-row td {
color: #bd93f9;
font-size: 13px;
}
.ir-table .green-row td {
background: rgba(80, 250, 123, 0.05);
color: #50fa7b;
font-weight: 700;
}
.ir-chart-container {
margin: 40px 0;
border-radius: 12px;
overflow: hidden;
border: 1px solid rgba(255,255,255,0.1);
box-shadow: 0 15px 35px rgba(0,0,0,0.6);
}
.ir-chart-container img {
width: 100%;
display: block;
object-fit: cover;
}
.fund-bar-container {
margin-top: 16px;
}
.fund-bar-row {
display: flex;
align-items: center;
margin-bottom: 12px;
}
.fund-label {
width: 240px;
font-size: 14px;
font-weight: 600;
color: #c9d1d9;
}
.fund-bar-bg {
flex-grow: 1;
height: 12px;
background: rgba(255,255,255,0.05);
border-radius: 6px;
overflow: hidden;
}
.fund-bar-fill {
height: 100%;
border-radius: 6px;
}
.fund-percent {
width: 80px;
text-align: right;
font-size: 14px;
color: #8b949e;
font-weight: 600;
}
.ir-patent-card {
background: rgba(189, 147, 249, 0.04);
border: 1px solid rgba(189, 147, 249, 0.15);
border-radius: 12px;
padding: 20px;
margin-bottom: 16px;
}
.ir-patent-card h4 {
margin: 0 0 8px 0;
color: #bd93f9;
font-size: 15px;
}
.ir-patent-card p {
margin: 0;
font-size: 13px;
color: #8b949e;
line-height: 1.7;
}
.ir-patent-badge {
display: inline-block;
padding: 2px 10px;
border-radius: 12px;
font-size: 11px;
font-weight: 700;
margin-right: 6px;
}
.ir-org-node {
background: rgba(255,255,255,0.03);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 10px;
padding: 16px;
text-align: center;
}
.ir-org-node h4 {
margin: 0 0 4px 0;
font-size: 14px;
color: #e6edf3;
}
.ir-org-node p {
margin: 0;
font-size: 12px;
color: #8b949e;
}
.ir-stat-grid {
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: 16px;
margin: 24px 0;
}
.ir-stat-box {
background: rgba(255,255,255,0.03);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 12px;
padding: 20px;
text-align: center;
}
.ir-stat-box .stat-num {
font-size: 32px;
font-weight: 800;
background: linear-gradient(135deg, #58a6ff, #bd93f9);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
}
.ir-stat-box .stat-label {
font-size: 13px;
color: #8b949e;
margin-top: 4px;
}
</style>

<div class="ir-deck">

<div class="ir-hero">
<img src="/ir_tech_hero.png" alt="Orbitron Architecture" />
<div class="ir-hero-content">
<div class="ir-hero-title">Orbitron</div>
<div class="ir-hero-subtitle">AI-Native 클라우드 배포 플랫폼 · 투자 제안서 (IR Deck v2.0)</div>
</div>
</div>

<!-- Key Metrics -->
<div class="ir-stat-grid">
<div class="ir-stat-box">
<div class="stat-num">10+</div>
<div class="stat-label">지원 프로젝트 타입</div>
</div>
<div class="ir-stat-box">
<div class="stat-num">192GB</div>
<div class="stat-label">GPU VRAM 스펙</div>
</div>
<div class="ir-stat-box">
<div class="stat-num">5억</div>
<div class="stat-label">초기 투자금 (KRW)</div>
</div>
<div class="ir-stat-box">
<div class="stat-num">18개월</div>
<div class="stat-label">BEP 달성 목표</div>
</div>
</div>

<!-- 1. Executive Summary -->
<div class="ir-section">
<h2 class="ir-section-header">1. Executive Summary</h2>
<p style="font-size: 18px; color: #c9d1d9; line-height: 1.8;">
<strong>Orbitron</strong>은 GitHub 연동 원클릭 배포, AI 자동 오류 진단/수정, Unreal Engine/Unity 게임 스트리밍,
Docker 네이티브 컨테이너 관리를 <strong>단일 플랫폼에 통합한 차세대 PaaS(Platform as a Service)</strong>입니다.
</p>
<p style="font-size: 15px; color: #8b949e; line-height: 1.8; margin-top: 16px;">
기존 PaaS(Vercel, Railway, Render)는 웹앱 배포만 지원하며, AI 오류 분석이나 게임 스트리밍은 제공하지 않습니다.
Orbitron은 이 세 가지를 결합한 <strong>통합 플랫폼</strong>으로서, 개인 개발자부터 게임 스튜디오, 교육기관까지
폭넓은 고객군에 서비스합니다.
</p>

<div style="margin-top: 24px; background: rgba(80,250,123,0.04); border: 1px solid rgba(80,250,123,0.2); border-radius: 12px; padding: 24px;">
<h4 style="margin-top:0; color:#50fa7b; font-size:16px; margin-bottom:16px;">핵심 투자 포인트</h4>
<div class="ir-grid" style="grid-template-columns: repeat(2, 1fr); gap: 12px;">
<div style="display:flex; gap:10px; align-items:flex-start;">
<span style="font-size:20px;">✅</span>
<div>
<strong style="color:#e6edf3; font-size:14px;">제품 완성도</strong>
<p style="font-size:13px; color:#8b949e; margin:4px 0 0;">MVP가 아닌 풀스택 프로덕트 — 6단계 배포 파이프라인, AI 오류분석, 웹 IDE, 콘솔, 모니터링이 이미 구현 완료</p>
</div>
</div>
<div style="display:flex; gap:10px; align-items:flex-start;">
<span style="font-size:20px;">✅</span>
<div>
<strong style="color:#e6edf3; font-size:14px;">블루오션 Wedge — GPU 게임 스트리밍</strong>
<p style="font-size:13px; color:#8b949e; margin:4px 0 0;">UE5 Pixel Streaming + Unity WebGL 원클릭 배포는 기존 PaaS(Vercel, Render 등)가 진입하지 못하는 블루오션. AI 코드 에디터(특허)와 결합하여 3중 방어벽 구축</p>
</div>
</div>
<div style="display:flex; gap:10px; align-items:flex-start;">
<span style="font-size:20px;">✅</span>
<div>
<strong style="color:#e6edf3; font-size:14px;">특허 출원 가능 기술</strong>
<p style="font-size:13px; color:#8b949e; margin:4px 0 0;">AI 오류분석, GPU 슬롯 할당, Docker 자동감지, RAG 지식베이스, 제로포트 터널, AI 인라인 에디터 — 6건 핵심 기술 특허 출원</p>
</div>
</div>
<div style="display:flex; gap:10px; align-items:flex-start;">
<span style="font-size:20px;">✅</span>
<div>
<strong style="color:#e6edf3; font-size:14px;">자본 효율성</strong>
<p style="font-size:13px; color:#8b949e; margin:4px 0 0;">1인 + AI 개발 체제로 수억원의 R&D 비용을 절감한 상태에서 상용화 단계 진입</p>
</div>
</div>
</div>
</div>
</div>

<!-- 2. Product Deep-Dive -->
<div class="ir-section">
<h2 class="ir-section-header">2. 제품 기술 상세 분석</h2>

<p style="font-size: 15px; color: #c9d1d9; margin-bottom: 24px;">
Orbitron은 현재 <strong>프로덕션 레벨의 완성된 플랫폼</strong>입니다. 아래는 실제 구현 완료된 핵심 기술과 상용 서비스로서의 경쟁력 분석입니다.
</p>

<div class="ir-grid" style="grid-template-columns: 1fr; gap: 20px;">

<div class="ir-card" style="border-left: 4px solid #58a6ff;">
<h3 style="color: #58a6ff;">⚡ 배포 자동화 엔진</h3>
<p style="margin-bottom: 12px;">
GitHub URL 또는 ZIP 업로드만으로 6단계 자동 파이프라인(Clone → Build → Container → Nginx → Tunnel → Done)이 실행됩니다.
</p>
<div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px;">
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">자동 프로젝트 감지</strong>
<p style="font-size:12px; margin:4px 0 0;">Node.js, Python, Next.js, 정적 사이트, 풀스택, Docker Compose, PostgreSQL, Redis 등 10종+ 자동 감지 & Dockerfile 자동 생성</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">무중단 배포</strong>
<p style="font-size:12px; margin:4px 0 0;">Blue-Green 배포 전략으로 서비스 중단 없이 업데이트. GitHub Webhook 연동으로 push 시 자동 배포</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">멀티스테이지 캐시 빌드</strong>
<p style="font-size:12px; margin:4px 0 0;">Docker 레이어 캐싱으로 반복 빌드 시 2~3배 속도 향상. 60분 타임아웃 + 안전장치</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">제로 설정 HTTPS</strong>
<p style="font-size:12px; margin:4px 0 0;">Cloudflare Tunnel 자동 생성으로 SSL 인증서 발급 불필요. 커스텀 도메인 CNAME 자동 설정</p>
</div>
</div>
</div>

<div class="ir-card" style="border-left: 4px solid #bd93f9;">
<h3 style="color: #bd93f9;">🧠 AI 오류 분석 & 자동 수정 엔진</h3>
<p style="margin-bottom: 12px;">
빌드/런타임 오류 발생 시 <strong>Claude Sonnet(1차) → Gemini Flash(폴백)</strong> 듀얼 LLM 라우팅으로 즉시 분석합니다.
</p>
<div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px;">
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">RAG 지식베이스</strong>
<p style="font-size:12px; margin:4px 0 0;">에러 패턴 DB + 유사도 매칭으로 과거 해결 사례를 실시간 참조. success_count 기반 자가 학습</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">자동 코드 패치 제안</strong>
<p style="font-size:12px; margin:4px 0 0;">에러 로그 50줄 자동 추출 → 근본 원인 분석 → 코드 수정 패치 JSON 자동 생성</p>
</div>
</div>
<div style="margin-top:12px; padding:12px; background:rgba(189,147,249,0.08); border-radius:8px;">
<strong style="color:#bd93f9; font-size:13px;">💡 경쟁사 대비 차별점:</strong>
<span style="font-size:13px; color:#8b949e;">Vercel, Render, Heroku 등 기존 PaaS는 에러 로그만 표시합니다. Orbitron은 <strong style="color:#e6edf3;">원인 분석 + 코드 수정안까지 자동 생성</strong>하는 유일한 플랫폼입니다.</span>
</div>
</div>

<div class="ir-card" style="border-left: 4px solid #50fa7b;">
<h3 style="color: #50fa7b;">🎮 게임 스트리밍 & GPU 컴퓨팅</h3>
<p style="margin-bottom: 12px;">
Unreal Engine 5 Pixel Streaming과 Unity WebGL 배포를 원클릭으로 지원합니다. GPU 슬롯 기반 동적 할당 시스템으로
다수의 게임 세션을 동시 관리합니다.
</p>
<div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:12px; margin-top:12px;">
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; text-align:center;">
<div style="font-size:24px; font-weight:800; color:#50fa7b;">30+</div>
<div style="font-size:12px; color:#8b949e;">동시 세션 (192GB GPU)</div>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; text-align:center;">
<div style="font-size:24px; font-weight:800; color:#50fa7b;">60초</div>
<div style="font-size:12px; color:#8b949e;">좀비 컨테이너 자동 정리</div>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; text-align:center;">
<div style="font-size:24px; font-weight:800; color:#50fa7b;">1시간</div>
<div style="font-size:12px; color:#8b949e;">세션 자동 종료 (공정 배분)</div>
</div>
</div>
<div style="margin-top:12px; padding:12px; background:rgba(80,250,123,0.08); border-radius:8px;">
<strong style="color:#50fa7b; font-size:13px;">💡 시장 유일성:</strong>
<span style="font-size:13px; color:#8b949e;">웹앱 배포와 게임 스트리밍을 <strong style="color:#e6edf3;">단일 플랫폼에서 통합</strong>하는 서비스는 현재 직접적인 경쟁 제품이 확인되지 않습니다.</span>
</div>
</div>

<div class="ir-card" style="border-left: 4px solid #ffb86c;">
<h3 style="color: #ffb86c;">🖥 올인원 개발자 대시보드</h3>
<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-top:12px;">
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">Monaco 웹 IDE</strong>
<p style="font-size:12px; margin:4px 0 0;">VS Code와 동일한 에디터 엔진으로 배포된 소스코드 직접 편집</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">컨테이너 콘솔</strong>
<p style="font-size:12px; margin:4px 0 0;">컨테이너 내부에서 실시간 명령 실행 (디버깅, 마이그레이션)</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">환경변수 관리</strong>
<p style="font-size:12px; margin:4px 0 0;">AES-256-GCM 암호화 저장, Bulk Import, 재배포 알림</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">AI 어시스턴트</strong>
<p style="font-size:12px; margin:4px 0 0;">프로젝트 컨텍스트 인지 LLM 채팅 (코드 질문, 디버깅 가이드)</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">멀티서비스 오케스트레이션</strong>
<p style="font-size:12px; margin:4px 0 0;">프로젝트 그룹 내 DB→Backend→Frontend 의존성 순서 자동 배포, DATABASE_URL 자동 주입, 그룹 전체 배포/중지</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">이슈 보드</strong>
<p style="font-size:12px; margin:4px 0 0;">버그/기능개선/오류 추적, 프로젝트별 이슈 관리 시스템 내장</p>
</div>
</div>
</div>

<div class="ir-card" style="border-left: 4px solid #ff79c6;">
<h3 style="color: #ff79c6;">🤖 AI 코드 에디터 (신규)</h3>
<p style="margin-bottom: 12px;">
Monaco Editor 기반 웹 IDE에 LLM을 직접 연동한 <strong>인라인 AI 코드 수정 시스템</strong>입니다.
배포된 서버의 소스 코드를 브라우저에서 직접 열고, AI로 수정/설명/리팩토링할 수 있습니다.
</p>
<div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px;">
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">인라인 AI 수정 (Ctrl+I)</strong>
<p style="font-size:12px; margin:4px 0 0;">코드 선택 → AI 지시 → 수정안 생성 → 수락/거부 워크플로우. 컨텍스트 메뉴 + 키보드 단축키 지원</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">Diff 에디터 비교 뷰</strong>
<p style="font-size:12px; margin:4px 0 0;">Monaco DiffEditor로 원본↔수정안 나란히 비교. 줄 단위 변경 사항 시각화</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">멀티파일 리팩토링</strong>
<p style="font-size:12px; margin:4px 0 0;">프로젝트 전체 분석 → 여러 파일 수정안 생성 → 체크박스로 선택적 일괄 적용</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">듀얼 LLM 폴백</strong>
<p style="font-size:12px; margin:4px 0 0;">Claude(1차) → Gemini(폴백) 자동 전환. 45초 타임아웃 기반 안정성 확보</p>
</div>
</div>
<div style="margin-top:12px; padding:12px; background:rgba(255,121,198,0.08); border-radius:8px;">
<strong style="color:#ff79c6; font-size:13px;">💡 경쟁사 대비 차별점:</strong>
<span style="font-size:13px; color:#8b949e;">GitHub Copilot과 Cursor는 데스크톱 IDE 전용입니다. <strong style="color:#e6edf3;">웹 브라우저에서 배포된 서버 코드를 AI로 직접 편집</strong>하는 통합 워크플로우는 현재 경쟁 제품이 확인되지 않습니다. (특허 제6호 출원 예정)</span>
</div>
</div>

</div>
</div>

<!-- 2.5. Enterprise Trust: Hybrid AI + Human -->
<div class="ir-section">
<h2 class="ir-section-header">엔터프라이즈 신뢰 장치: AI + 사람 하이브리드</h2>

<p style="font-size:15px; color:#c9d1d9; line-height:1.8; margin-bottom:20px;">
월 수백만 원을 지불하는 B2B 기업 고객은 "AI가 다 고친다"는 약속만으로는 안심하지 않습니다.
장애 발생 시 <strong>전담 엔지니어가 에스컬레이션 대응</strong>하는 체계가 필수입니다.
Orbitron은 AI 자동 대응(1차)과 전문 인력 대응(2차)의 <strong>하이브리드 운영 체제</strong>를 구축합니다.
</p>

<div class="ir-grid" style="grid-template-columns: 1fr 1fr; gap:20px;">
<div class="ir-card" style="border-top:3px solid #50fa7b;">
<h3 style="color:#50fa7b;">🤖 AI 자동 대응 (1차 방어선)</h3>
<p>
<strong>24/7 무인 운영:</strong> 배포 오류 AI 분석 + 코드 패치 자동 생성, 에러 지식베이스 자가학습(RAG),
좀비 컨테이너 자동 정리(60초 주기), GPU 세션 로드밸런싱.<br>
<strong>컨테이너 격리 보호:</strong> 배포 시 관련 프로젝트(DB 등) 컨테이너를 자동 보호하는 안전 장치 내장.<br><br>
<strong>효과:</strong> 일반적인 CS/SRE 인건비 대비 약 70% 절감. 반복적인 장애의 80%를 사람 개입 없이 자동 해결.
</p>
</div>
<div class="ir-card" style="border-top:3px solid #58a6ff;">
<h3 style="color:#58a6ff;">👤 전문 인력 대응 (2차 신뢰 장치)</h3>
<p>
<strong>Phase 1 (설립 즉시):</strong> DevOps/SRE 시니어 1명 채용 — 인프라 장애 에스컬레이션, 보안 감사, 고가용성 설계<br>
<strong>Phase 2 (7개월~):</strong> CS/기술지원 1명 추가 — 엔터프라이즈 온보딩, 마이그레이션 지원, VIP 고객 전담<br>
<strong>예비비 ₩2,500만:</strong> 예상 외 장애 대응 인력 긴급 충원 버퍼<br>
<strong>Enterprise SLA:</strong> 전담 지원 + 감사 로그 + 99.9% 가용성 보장 계약
</p>
</div>
</div>
</div>

<!-- 3. Market & Competition -->
<div class="ir-section">
<h2 class="ir-section-header">3. 시장 분석 & 경쟁 포지셔닝</h2>

<div style="margin-bottom:24px; padding:24px; background:rgba(88,166,255,0.04); border:1px solid rgba(88,166,255,0.15); border-radius:12px;">
<h4 style="margin-top:0; color:#58a6ff; font-size:16px;">📊 TAM/SAM/SOM 분석</h4>
<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-top:16px;">
<div style="text-align:center; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="font-size:28px; font-weight:800; color:#58a6ff;">₩42.6조</div>
<div style="font-size:12px; color:#8b949e; margin-top:4px;"><strong>TAM</strong> — 글로벌 PaaS 시장 (2026)</div>
<div style="font-size:11px; color:#666; margin-top:2px;">Gartner 추정 CAGR 22%</div>
</div>
<div style="text-align:center; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="font-size:28px; font-weight:800; color:#bd93f9;">₩3.15조</div>
<div style="font-size:12px; color:#8b949e; margin-top:4px;"><strong>SAM</strong> — 개발자 중심 PaaS (인디~SMB)</div>
<div style="font-size:11px; color:#666; margin-top:2px;">Vercel, Railway, Render 경쟁 영역</div>
</div>
<div style="text-align:center; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="font-size:28px; font-weight:800; color:#50fa7b;">₩1,275억</div>
<div style="font-size:12px; color:#8b949e; margin-top:4px;"><strong>SOM</strong> — AI+게임 통합 PaaS 니치</div>
<div style="font-size:11px; color:#666; margin-top:2px;">3년 내 점유 가능 시장</div>
</div>
</div>
</div>

<h3 style="color: #58a6ff; font-size: 18px; margin-bottom: 16px;">경쟁사 기능 비교표</h3>
<div class="ir-table-wrapper">
<table class="ir-table" style="text-align: center;">
<thead>
<tr>
<th style="text-align:left;">기능</th>
<th style="color:#50fa7b;">Orbitron</th>
<th>Vercel</th>
<th>Railway</th>
<th>Render</th>
<th>Heroku</th>
<th>Coolify</th>
</tr>
</thead>
<tbody>
<tr>
<td>Docker 네이티브 (완전 제어)</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>❌</td><td>제한적</td><td>제한적</td><td>❌</td><td>✅</td>
</tr>
<tr>
<td>AI 오류 분석 + 자동 수정</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td>
</tr>
<tr>
<td>게임 스트리밍 (UE5/Unity)</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td>
</tr>
<tr>
<td>웹 IDE (소스 에디터)</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>❌</td><td>❌</td><td>Shell만</td><td>❌</td><td>❌</td>
</tr>
<tr>
<td>Docker Compose 지원</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td><td>✅</td>
</tr>
<tr>
<td>멀티서비스 그룹 배포 (오케스트레이션)</td>
<td style="color:#50fa7b; font-weight:700;">✅ (의존성 순서)</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td>
</tr>
<tr>
<td>GPU 컴퓨팅</td>
<td style="color:#50fa7b; font-weight:700;">✅ 192GB</td><td>❌</td><td>❌</td><td>❌</td><td>유료</td><td>❌</td>
</tr>
<tr>
<td>컨테이너 내부 콘솔</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>❌</td><td>❌</td><td>✅</td><td>✅</td><td>❌</td>
</tr>
<tr>
<td>AI 프로젝트 어시스턴트</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>v0 (별도)</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td>
</tr>
<tr>
<td>에러 지식베이스 자가학습</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td>
</tr>
<tr>
<td>AI 인라인 코드 에디터</td>
<td style="color:#50fa7b; font-weight:700;">✅ (웹 IDE)</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td>
</tr>
<tr>
<td>멀티파일 AI 리팩토링</td>
<td style="color:#50fa7b; font-weight:700;">✅</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td><td>❌</td>
</tr>
<tr class="highlight-row">
<td style="text-align:left;">고유 기능 수</td>
<td style="color:#50fa7b; font-weight:800;">12/12</td><td>1/12</td><td>0/12</td><td>1/12</td><td>1/12</td><td>2/12</td>
</tr>
</tbody>
</table>
</div>
</div>

<!-- 4. Patent Strategy -->
<div class="ir-section">
<h2 class="ir-section-header">4. 지식재산권(IP) & 특허 전략</h2>

<p style="font-size: 15px; color: #c9d1d9; margin-bottom: 24px; line-height: 1.8;">
Orbitron의 핵심 기술은 <strong>소프트웨어 발명</strong>으로서 대한민국 특허법 및 PCT 국제출원 체계를 통해 보호 가능합니다.
아래 6건의 핵심 기술에 대해 특허 출원을 추진하며, 이를 통해 기술 경쟁 우위를 법적으로 확보합니다.
</p>

<div style="margin-bottom:24px; background:rgba(189,147,249,0.04); border:1px solid rgba(189,147,249,0.15); border-radius:12px; padding:20px;">
<h4 style="margin:0 0 12px 0; color:#bd93f9; font-size:16px;">📋 특허 출원 로드맵 요약</h4>
<div class="ir-table-wrapper" style="padding:12px; margin-top:12px;">
<table class="ir-table" style="font-size:13px;">
<thead>
<tr>
<th style="text-align:left;">No.</th>
<th style="text-align:left;">발명 명칭</th>
<th>출원 유형</th>
<th>예상 비용</th>
<th>출원 시점</th>
<th>상태</th>
</tr>
</thead>
<tbody>
<tr>
<td style="text-align:left;">1</td>
<td style="text-align:left;">AI 기반 배포 오류 자동 분석 및 수정 시스템</td>
<td>특허 (발명)</td>
<td>₩3,500,000</td>
<td>Phase 1</td>
<td><span class="ir-patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff;">준비 중</span></td>
</tr>
<tr>
<td style="text-align:left;">2</td>
<td style="text-align:left;">GPU 슬롯 동적 할당 기반 게임 스트리밍 관리 방법</td>
<td>특허 (발명)</td>
<td>₩3,500,000</td>
<td>Phase 1</td>
<td><span class="ir-patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff;">준비 중</span></td>
</tr>
<tr>
<td style="text-align:left;">3</td>
<td style="text-align:left;">컨테이너 프로젝트 타입 자동 감지 및 빌드 파이프라인 생성 방법</td>
<td>특허 (발명)</td>
<td>₩3,500,000</td>
<td>Phase 1</td>
<td><span class="ir-patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff;">준비 중</span></td>
</tr>
<tr>
<td style="text-align:left;">4</td>
<td style="text-align:left;">RAG 기반 에러 지식베이스 자가학습 시스템</td>
<td>특허 (발명)</td>
<td>₩3,500,000</td>
<td>Phase 2</td>
<td><span class="ir-patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c;">예정</span></td>
</tr>
<tr>
<td style="text-align:left;">5</td>
<td style="text-align:left;">제로포트 터널 기반 멀티테넌트 배포 자동화 방법</td>
<td>특허 (발명)</td>
<td>₩3,500,000</td>
<td>Phase 2</td>
<td><span class="ir-patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c;">예정</span></td>
</tr>
<tr>
<td style="text-align:left;">6</td>
<td style="text-align:left;">웹 기반 코드 에디터 LLM 연동 인라인 코드 수정 시스템</td>
<td>특허 (발명)</td>
<td>₩3,500,000</td>
<td>Phase 1</td>
<td><span class="ir-patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff;">준비 중</span></td>
</tr>
<tr class="highlight-row">
<td style="text-align:left;" colspan="3">합계 (국내 6건)</td>
<td>₩21,000,000</td>
<td colspan="2">PCT 국제출원 추가 시 건당 ₩5,000,000</td>
</tr>
</tbody>
</table>
</div>
</div>

<div class="ir-patent-card">
<h4>📌 특허 1: AI 기반 배포 오류 자동 분석 및 수정 시스템</h4>
<p>
<span class="ir-patent-badge" style="background:rgba(80,250,123,0.15); color:#50fa7b;">핵심 특허</span>
<span class="ir-patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff;">AI/ML 분류</span><br><br>
<strong style="color:#c9d1d9;">발명 내용:</strong> 소프트웨어 빌드/배포 과정에서 발생하는 오류 로그를 자동 수집하고,
듀얼 LLM(Claude + Gemini) 라우팅 시스템을 통해 오류를 분석한 뒤, 에러 지식베이스(RAG)와의
유사도 매칭을 거쳐 근본 원인을 진단하고 코드 수정 패치를 자동 생성하는 방법 및 시스템.<br><br>
<strong style="color:#c9d1d9;">청구 범위:</strong> (1) 에러 로그 50줄 자동 추출 방법 (2) 듀얼 LLM 폴백 라우팅 (3) RAG 패턴 매칭 + success_count 가중 학습
(4) JSON 형식 코드 패치 자동 생성 (5) 지식베이스 성공률 기반 자가 강화 학습<br><br>
<strong style="color:#c9d1d9;">선행기술 대비 진보성:</strong> 기존 CI/CD 도구(Jenkins, GitHub Actions)는 오류를 '표시'만 하며, 분석/수정 기능이 없음.
기존 AI 코드 도구(GitHub Copilot)는 배포 파이프라인 컨텍스트를 인식하지 못함. Orbitron은 배포 단계별 컨텍스트 +
프로젝트 코드 + 에러 히스토리를 통합하여 분석하는 유일한 시스템.
</p>
</div>

<div class="ir-patent-card">
<h4>📌 특허 2: GPU 슬롯 동적 할당 기반 게임 스트리밍 관리 방법</h4>
<p>
<span class="ir-patent-badge" style="background:rgba(80,250,123,0.15); color:#50fa7b;">핵심 특허</span>
<span class="ir-patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c;">GPU/게임 분류</span><br><br>
<strong style="color:#c9d1d9;">발명 내용:</strong> 다수의 GPU 디바이스에 대해 슬롯 풀(pool)을 구성하고,
게임 세션 요청 시 가용 슬롯을 동적으로 할당하며, 좀비 컨테이너 자동 감지(60초 주기)/정리 및
세션 시간 제한(1시간)을 통해 공정한 GPU 리소스 분배를 달성하는 방법.<br><br>
<strong style="color:#c9d1d9;">청구 범위:</strong> (1) GPU 디바이스 인덱스 기반 슬롯 풀 관리 (2) 세션별 포트 동적 매핑
(3) 좀비 컨테이너 주기적 감지/제거 (4) 최대 세션 시간 자동 종료 (5) GPU 간 로드밸런싱 알고리즘
</p>
</div>

<div class="ir-patent-card">
<h4>📌 특허 3: 컨테이너 프로젝트 타입 자동 감지 및 빌드 파이프라인 생성 방법</h4>
<p>
<span class="ir-patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff;">빌드/배포 분류</span><br><br>
<strong style="color:#c9d1d9;">발명 내용:</strong> 소스 코드의 파일 구조, 패키지 매니저 파일(package.json, requirements.txt 등),
프레임워크 설정 파일을 분석하여 10종 이상의 프로젝트 타입(Node, Python, Next.js, 정적, 풀스택, Compose,
PostgreSQL, Redis, Pixel Streaming, Unity WebGL)을 자동 감지하고, 각 타입에 최적화된
멀티스테이지 Dockerfile과 빌드 파이프라인을 자동 생성하는 방법.<br><br>
<strong style="color:#c9d1d9;">선행기술 대비 진보성:</strong> Heroku의 Buildpack은 제한된 언어만 지원하며 Docker 네이티브가 아님.
Railway/Render의 자동 감지는 웹앱 3~4종에 한정. Orbitron은 데이터베이스, 게임 엔진까지 포함한 10종+ 감지.
</p>
</div>

<div class="ir-patent-card">
<h4>📌 특허 4: RAG 기반 에러 지식베이스 자가학습 시스템</h4>
<p>
<span class="ir-patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c;">Phase 2 예정</span><br><br>
<strong style="color:#c9d1d9;">발명 내용:</strong> 배포 오류 해결 결과를 에러 패턴, 근본 원인, 솔루션, 코드 패치와 함께 자동 저장하고,
새로운 오류 발생 시 텍스트 유사도 기반으로 기존 해결 사례를 검색(RAG)하여 LLM 분석의 정확도를 높이며,
성공/실패 카운트를 추적하여 지식베이스의 신뢰도를 자가 강화하는 시스템.
</p>
</div>

<div class="ir-patent-card">
<h4>📌 특허 5: 제로포트 터널 기반 멀티테넌트 배포 자동화 방법</h4>
<p>
<span class="ir-patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c;">Phase 2 예정</span><br><br>
<strong style="color:#c9d1d9;">발명 내용:</strong> 서버의 인바운드 포트를 완전 차단(Zero-Port)한 상태에서
Cloudflare Tunnel을 통해 멀티테넌트 방식으로 다수의 프로젝트를 서브도메인 기반으로 자동 라우팅하고,
Named Tunnel / Quick Tunnel 이중화 및 systemd 서비스 연동을 통해 장애 시 자동 복구되는 배포 방법.
</p>
</div>

<div class="ir-patent-card">
<h4>📌 특허 6: 웹 기반 코드 에디터 LLM 연동 인라인 코드 수정 시스템</h4>
<p>
<span class="ir-patent-badge" style="background:rgba(80,250,123,0.15); color:#50fa7b;">핵심 특허</span>
<span class="ir-patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff;">AI/IDE 분류</span><br><br>
<strong style="color:#c9d1d9;">발명 내용:</strong> 웹 브라우저에서 실행되는 코드 에디터(Monaco Editor)에서 사용자가 선택한 코드 영역에 대해
대규모 언어 모델(LLM)을 연동하여 인라인 수정, 코드 설명, 버그 수정, 리팩토링을 수행하고,
수정 전후 Diff 에디터를 통해 비교하며, 수락/거부 인터페이스로 적용하는 시스템.
프로젝트 전체 소스를 분석한 멀티파일 일괄 리팩토링과 선택적 패치 적용을 포함.<br><br>
<strong style="color:#c9d1d9;">청구 범위:</strong> (1) 코드 선택 영역 + 전체 파일 컨텍스트 자동 추출 (2) 인라인 프롬프트 바 및 컨텍스트 메뉴 AI 연동
(3) 구조화된 JSON 패치 생성 (4) Monaco 인라인 데코레이션 + DiffEditor 비교 뷰
(5) 멀티파일 패치 체크박스 선택 적용 (6) 듀얼 LLM 폴백 라우팅<br><br>
<strong style="color:#c9d1d9;">선행기술 대비 진보성:</strong> GitHub Copilot, Cursor 등은 데스크톱 IDE 전용이며 웹 브라우저 기반 배포 서버 코드 직접 편집 + AI 수정은 존재하지 않음.
멀티파일 일괄 리팩토링의 선택적 체크박스 적용 방식도 기존 도구에 없는 고유 기능.
</p>
</div>

<div style="margin-top:24px; background:rgba(255,255,255,0.02); padding:20px; border-radius:12px; border-left:4px solid #bd93f9;">
<h4 style="margin-top:0; color:#bd93f9; font-size:15px;">🔒 추가 IP 보호 전략</h4>
<ul style="font-size:13px; color:#8b949e; line-height:1.8; padding-left:20px;">
<li><strong>상표 등록:</strong> "Orbitron" 브랜드명 국내 상표출원 (제9류: 소프트웨어, 제42류: SaaS/클라우드 서비스) — 예상 비용 ₩500,000</li>
<li><strong>저작권 등록:</strong> Orbitron 소스코드 전체에 대한 프로그램 저작권 등록 (한국저작권위원회) — 예상 비용 ₩50,000</li>
<li><strong>디자인 등록:</strong> 대시보드 UI/UX 디자인 의장 등록 — 예상 비용 ₩300,000</li>
<li><strong>영업비밀 관리:</strong> 배포 최적화 알고리즘, AI 프롬프트 엔지니어링, 에러 지식베이스 데이터는 영업비밀로 별도 관리</li>
<li><strong>PCT 국제출원:</strong> 핵심 특허 1~3번에 대해 미국/일본/EU PCT 출원 검토 (Phase 2, 건당 ₩5,000,000)</li>
</ul>
<div style="margin-top:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">📊 총 IP 비용 산정:</strong>
<span style="font-size:13px; color:#8b949e;">국내 특허 6건(₩21M) + 상표(₩0.5M) + 저작권(₩0.05M) + 디자인(₩0.3M) + PCT 3건(₩15M) = <strong style="color:#58a6ff;">총 ₩36,850,000 (약 3,685만원)</strong></span>
</div>
</div>
</div>

<!-- 5. Company Establishment & Organization -->
<div class="ir-section">
<h2 class="ir-section-header">5. 법인 설립 & 조직 구성</h2>

<h3 style="color: #58a6ff; font-size: 18px; margin-bottom: 16px;">5.1 법인 설립 계획</h3>
<div class="ir-table-wrapper">
<table class="ir-table" style="text-align: left;">
<thead>
<tr><th>항목</th><th>내용</th><th style="text-align:right;">비용</th></tr>
</thead>
<tbody>
<tr><td>법인 형태</td><td>주식회사 (기술 스타트업 / 벤처기업 인증 추진)</td><td style="text-align:right;">—</td></tr>
<tr><td>자본금</td><td>5억원 (보통주 10,000주, 액면가 50,000원)</td><td style="text-align:right;">₩500,000,000</td></tr>
<tr><td>법인 설립 등기</td><td>등록면허세 + 교육세 + 법무사 수수료</td><td style="text-align:right;">₩3,500,000</td></tr>
<tr><td>사업자 등록</td><td>업태: 정보통신업 / 종목: 소프트웨어 개발 및 공급, 클라우드 서비스</td><td style="text-align:right;">무료</td></tr>
<tr><td>벤처기업 인증</td><td>기술보증기금 또는 벤처캐피탈 투자 확인 방식</td><td style="text-align:right;">₩500,000</td></tr>
<tr><td>4대보험 사업장 가입</td><td>국민연금, 건강보험, 고용보험, 산재보험</td><td style="text-align:right;">무료</td></tr>
<tr><td>기업 부설 연구소 설립</td><td>한국산업기술진흥협회(KOITA) 인정 — 세제혜택, 병역특례 가능</td><td style="text-align:right;">₩1,000,000</td></tr>
<tr class="highlight-row"><td colspan="2">법인 설립 총 비용</td><td style="text-align:right;">₩5,000,000</td></tr>
</tbody>
</table>
</div>

<h3 style="color: #58a6ff; font-size: 18px; margin: 24px 0 16px;">5.2 조직 구성 (3단계 확장)</h3>

<div style="margin-bottom:24px;">
<h4 style="color:#50fa7b; margin-bottom:12px;">Phase 1: 설립 초기 (Month 1~6) — 7명</h4>
<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px;">
<div class="ir-org-node" style="border-top:3px solid #50fa7b; grid-column: 1 / -1;">
<h4>CEO / CTO (대표이사 겸 기술총괄)</h4>
<p>창업자 · 제품 아키텍처 · 사업 전략</p>
</div>
<div class="ir-org-node">
<h4>백엔드 개발자</h4>
<p>시니어 1명<br>배포 엔진 · API · 인프라</p>
</div>
<div class="ir-org-node">
<h4>프론트엔드 개발자</h4>
<p>미드레벨 1명<br>대시보드 UI/UX · 반응형</p>
</div>
<div class="ir-org-node">
<h4>AI/ML 엔지니어</h4>
<p>시니어 1명<br>오류 분석 고도화 · RAG · GPU</p>
</div>
<div class="ir-org-node">
<h4>DevOps/SRE</h4>
<p>시니어 1명<br>클라우드 인프라 · 모니터링 · 보안</p>
</div>
<div class="ir-org-node">
<h4>사업개발/마케팅</h4>
<p>1명<br>GTM · 콘텐츠 · 커뮤니티</p>
</div>
<div class="ir-org-node">
<h4>경영지원</h4>
<p>1명<br>재무 · 인사 · 법무</p>
</div>
</div>
</div>

<div style="margin-bottom:24px;">
<h4 style="color:#58a6ff; margin-bottom:12px;">Phase 2: 성장기 (Month 7~18) — 12명 (+5명)</h4>
<div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:10px;">
<div class="ir-org-node" style="border-top:2px solid #58a6ff;">
<h4 style="font-size:13px;">+백엔드 1명</h4>
<p>게임/GPU 서비스 전담</p>
</div>
<div class="ir-org-node" style="border-top:2px solid #58a6ff;">
<h4 style="font-size:13px;">+프론트 1명</h4>
<p>랜딩/마케팅 사이트</p>
</div>
<div class="ir-org-node" style="border-top:2px solid #58a6ff;">
<h4 style="font-size:13px;">+CS/기술지원 1명</h4>
<p>고객 응대 · 온보딩</p>
</div>
<div class="ir-org-node" style="border-top:2px solid #58a6ff;">
<h4 style="font-size:13px;">+마케팅 1명</h4>
<p>퍼포먼스 · B2B 세일즈</p>
</div>
<div class="ir-org-node" style="border-top:2px solid #58a6ff;">
<h4 style="font-size:13px;">+QA/테스터 1명</h4>
<p>자동화 테스트 · 보안감사</p>
</div>
</div>
</div>

<div>
<h4 style="color:#bd93f9; margin-bottom:12px;">Phase 3: 확장기 (Month 19~36) — 20명 (+8명)</h4>
<p style="font-size:13px; color:#8b949e; line-height:1.6;">
CTO 분리 채용, 엔터프라이즈 세일즈 2명, 글로벌 CS 2명, 백엔드/인프라 2명, 법무/컴플라이언스 1명, 디자이너 1명 추가
</p>
</div>

<h3 style="color: #58a6ff; font-size: 18px; margin: 24px 0 16px;">5.3 인건비 상세 산정 (월간)</h3>
<div class="ir-table-wrapper">
<table class="ir-table">
<thead>
<tr><th style="text-align:left;">직책</th><th>인원</th><th>개인 월급 (세전)</th><th>4대보험 사업자분</th><th>월 소계</th></tr>
</thead>
<tbody>
<tr><td>CEO/CTO (대표)</td><td>1</td><td>₩5,000,000</td><td>₩500,000</td><td>₩5,500,000</td></tr>
<tr><td>시니어 개발자 (백엔드, AI, DevOps)</td><td>3</td><td>₩5,500,000</td><td>₩550,000</td><td>₩18,150,000</td></tr>
<tr><td>미드레벨 개발자 (프론트)</td><td>1</td><td>₩4,500,000</td><td>₩450,000</td><td>₩4,950,000</td></tr>
<tr><td>사업개발/마케팅</td><td>1</td><td>₩4,000,000</td><td>₩400,000</td><td>₩4,400,000</td></tr>
<tr><td>경영지원</td><td>1</td><td>₩3,500,000</td><td>₩350,000</td><td>₩3,850,000</td></tr>
<tr class="highlight-row"><td colspan="2">Phase 1 합계 (7명)</td><td colspan="2"></td><td>₩36,850,000/월</td></tr>
<tr class="metric-row"><td colspan="4">연간 인건비 (보너스 포함, 13개월 기준)</td><td>₩479,050,000/년</td></tr>
</tbody>
</table>
</div>
</div>

<!-- 6. Business Model & Pricing -->
<div class="ir-section">
<h2 class="ir-section-header">6. 비즈니스 모델 & 가격 정책</h2>

<h3 style="color: #58a6ff; font-size: 18px; margin-bottom: 16px;">6.1 수익 구조</h3>
<div style="margin-bottom:24px; padding:24px; background: rgba(80, 250, 123, 0.03); border: 1px solid rgba(80, 250, 123, 0.2); border-radius:12px; border-left:4px solid #50fa7b;">
<h4 style="margin-top:0; color:#e6edf3; font-size:16px; margin-bottom:16px;">📈 이중 수익 모델: SaaS 구독 + 종량제 Add-on</h4>
<div class="ir-grid" style="grid-template-columns: repeat(2, 1fr); gap:16px;">
<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#58a6ff; font-size:15px;">📦 1. SaaS 구독 매출 (예상 비중 65%)</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
월간 구독료 기반 반복 매출(MRR). Free 플랜으로 유입 → 기능 제한으로 유료 전환 유도(PLG 모델).
프로젝트 수, 빌드 시간, 스토리지, 팀원 수로 티어별 차등화. <strong>예상 유료 전환율: 3~5%</strong>
</p>
</div>
<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#bd93f9; font-size:15px;">⚡ 2. 종량제 Add-on 매출 (예상 비중 35%)</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
GPU 게임 스트리밍 시간당 과금, AI 이미지 생성 건당 과금, 추가 스토리지/대역폭, 관리형 DB 인스턴스.
사용자가 성장할수록 <strong>Add-on 매출이 비례 증가하는 구조</strong>.
</p>
</div>
</div>
</div>

<h3 style="color: #58a6ff; font-size: 18px; margin-bottom: 16px;">6.2 가격 정책</h3>
<div class="ir-grid" style="grid-template-columns: repeat(5, 1fr); gap: 12px;">
<div class="ir-card" style="padding: 16px;">
<h3 style="font-size:15px; color:#50fa7b;">Free</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">₩0</div>
<p style="font-size:12px;">프로젝트 1개<br>빌드 100분/월<br>500MB 스토리지<br>커뮤니티 지원</p>
</div>
<div class="ir-card" style="padding: 16px; border-color: rgba(88, 166, 255, 0.4);">
<h3 style="font-size:15px; color:#58a6ff;">Starter</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">₩15,000<span style="font-size:12px; color:#8b949e;">/월</span></div>
<p style="font-size:12px;">프로젝트 5개<br>빌드 1,000분/월<br>5GB · 커스텀 도메인<br>AI 분석 20회/월</p>
</div>
<div class="ir-card" style="padding: 16px; background: rgba(189, 147, 249, 0.1); border-color: rgba(189, 147, 249, 0.4);">
<h3 style="font-size:15px; color:#bd93f9;">Pro</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">₩49,000<span style="font-size:12px; color:#8b949e;">/월</span></div>
<p style="font-size:12px;">프로젝트 20개<br>무제한 빌드<br>25GB · 팀 3명<br>AI 무제한 · 자동배포</p>
</div>
<div class="ir-card" style="padding: 16px; border-color: rgba(255, 184, 108, 0.4);">
<h3 style="font-size:15px; color:#ffb86c;">Team</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">₩129,000<span style="font-size:12px; color:#8b949e;">/월</span></div>
<p style="font-size:12px;">프로젝트 50개<br>무제한 빌드<br>100GB · 팀 10명<br>DB 호스팅 · 우선 빌드</p>
</div>
<div class="ir-card" style="padding: 16px;">
<h3 style="font-size:15px; color:#ff5555;">Enterprise</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">맞춤견적</div>
<p style="font-size:12px;">무제한 전체<br>전용 인프라<br>SSO · 감사로그<br>SLA 보장 · 전담 지원</p>
</div>
</div>

<h3 style="color: #58a6ff; font-size: 18px; margin: 24px 0 16px;">6.3 Add-on 종량제</h3>
<div class="ir-table-wrapper">
<table class="ir-table">
<thead>
<tr><th style="text-align:left;">서비스</th><th>단가</th><th>예상 원가</th><th>마진율</th><th>비고</th></tr>
</thead>
<tbody>
<tr><td>GPU 게임 스트리밍</td><td>₩3,500/시간</td><td>₩1,200/시간</td><td style="color:#50fa7b;">66%</td><td>UE5 Pixel Streaming 세션</td></tr>
<tr><td>AI 이미지 생성</td><td>₩70/장</td><td>₩15/장</td><td style="color:#50fa7b;">79%</td><td>Flux.1-schnell 기반</td></tr>
<tr><td>추가 스토리지</td><td>₩200/GB/월</td><td>₩30/GB/월</td><td style="color:#50fa7b;">85%</td><td>NVMe SSD</td></tr>
<tr><td>추가 대역폭</td><td>₩130/GB</td><td>₩10/GB</td><td style="color:#50fa7b;">92%</td><td>Cloudflare CDN 경유</td></tr>
<tr><td>관리형 PostgreSQL</td><td>₩9,000~/월</td><td>₩2,000~/월</td><td style="color:#50fa7b;">78%</td><td>256MB~4GB 인스턴스</td></tr>
<tr><td>관리형 Redis</td><td>₩7,000~/월</td><td>₩1,500~/월</td><td style="color:#50fa7b;">79%</td><td>캐시 인스턴스</td></tr>
</tbody>
</table>
</div>
</div>

<!-- 7. Fund Allocation -->
<div class="ir-section">
<h2 class="ir-section-header">7. 5억원 투자금 집행 계획</h2>

<p style="font-size: 15px; color: #c9d1d9; margin-bottom: 24px; line-height: 1.8;">
초기 투자금 <strong>5억원(₩500,000,000)</strong>을 24개월에 걸쳐 효율적으로 집행합니다.
이미 제품이 완성된 상태이므로 R&D보다 <strong>인재 확보, 인프라 구축, 시장 진출</strong>에 집중 투자합니다.
</p>

<h3 style="color: #ffb86c; font-size: 18px; margin-bottom: 16px;">📊 자금 배분 총괄</h3>
<div class="fund-bar-container" style="margin-bottom: 32px;">
<div class="fund-bar-row">
<div class="fund-label">인건비 (7~12명, 18개월)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 48%; background: linear-gradient(90deg, #58a6ff, #3b82f6);"></div></div>
<div class="fund-percent">₩240M (48%)</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">GPU 클라우드 인프라</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 20%; background: linear-gradient(90deg, #bd93f9, #9333ea);"></div></div>
<div class="fund-percent">₩100M (20%)</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">마케팅 & GTM</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 14%; background: linear-gradient(90deg, #50fa7b, #10b981);"></div></div>
<div class="fund-percent">₩70M (14%)</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">사무실 & 운영비</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 8%; background: linear-gradient(90deg, #ffb86c, #f59e0b);"></div></div>
<div class="fund-percent">₩40M (8%)</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">IP (특허/상표/인증)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 5%; background: linear-gradient(90deg, #ff79c6, #ec4899);"></div></div>
<div class="fund-percent">₩25M (5%)</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">예비비 (긴급/기회 대응)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 5%; background: linear-gradient(90deg, #8b949e, #6b7280);"></div></div>
<div class="fund-percent">₩25M (5%)</div>
</div>
</div>

<h3 style="color: #ffb86c; font-size: 18px; margin-bottom: 16px;">📋 상세 집행 계획</h3>
<div class="ir-table-wrapper">
<table class="ir-table" style="font-size:13px;">
<thead>
<tr><th style="text-align:left;">항목</th><th style="text-align:left;">세부 내역</th><th>금액</th><th>비고</th></tr>
</thead>
<tbody>
<tr><td colspan="4" style="text-align:left; color:#58a6ff; font-weight:700; background:rgba(88,166,255,0.05);">인건비 — ₩240,000,000 (48%)</td></tr>
<tr><td>Phase 1 인건비 (7명×6개월)</td><td style="text-align:left;">CEO/CTO, 시니어 3, 미드 1, 사업개발 1, 경영지원 1</td><td>₩221,100,000</td><td>월 ₩36.85M × 6개월</td></tr>
<tr><td>채용 비용</td><td style="text-align:left;">채용 플랫폼, 면접 비용, 온보딩</td><td>₩10,000,000</td><td>원티드/로켓펀치</td></tr>
<tr><td>인건비 버퍼</td><td style="text-align:left;">급여 인상, 성과급, 추가 인력</td><td>₩8,900,000</td><td>예비</td></tr>

<tr><td colspan="4" style="text-align:left; color:#bd93f9; font-weight:700; background:rgba(189,147,249,0.05);">GPU 클라우드 인프라 — ₩100,000,000 (20%)</td></tr>
<tr><td>Vultr MI300X (192GB)</td><td style="text-align:left;">시간당 ₩2,775 × 16h/일 × 18개월</td><td>₩65,000,000</td><td>종량제 → 예약 전환</td></tr>
<tr><td>스토리지 & 백업</td><td style="text-align:left;">NVMe SSD 500GB + S3 호환 오브젝트 스토리지</td><td>₩10,000,000</td><td>18개월</td></tr>
<tr><td>AI API 비용</td><td style="text-align:left;">Anthropic Claude + Google Gemini API</td><td>₩15,000,000</td><td>18개월, 사용량 증가 고려</td></tr>
<tr><td>Cloudflare + 도메인</td><td style="text-align:left;">Pro/Business 플랜, 도메인 관리</td><td>₩5,000,000</td><td>18개월</td></tr>
<tr><td>모니터링 도구</td><td style="text-align:left;">Prometheus + Grafana + Sentry</td><td>₩5,000,000</td><td>18개월</td></tr>

<tr><td colspan="4" style="text-align:left; color:#50fa7b; font-weight:700; background:rgba(80,250,123,0.05);">마케팅 & GTM — ₩70,000,000 (14%)</td></tr>
<tr><td>디지털 마케팅</td><td style="text-align:left;">Google Ads, GitHub Sponsors, DEV.to, 개발자 커뮤니티</td><td>₩25,000,000</td><td>CPA 최적화</td></tr>
<tr><td>콘텐츠 마케팅</td><td style="text-align:left;">기술 블로그, YouTube 데모 시리즈, 튜토리얼</td><td>₩10,000,000</td><td>SEO + 브랜딩</td></tr>
<tr><td>Product Hunt / HN 런칭</td><td style="text-align:left;">런칭 캠페인, 초기 사용자 확보</td><td>₩5,000,000</td><td>PR 대행 포함</td></tr>
<tr><td>개발자 행사 / 해커톤</td><td style="text-align:left;">AWS Summit, NDC, 대학 해커톤 스폰서십</td><td>₩15,000,000</td><td>B2B 리드 확보</td></tr>
<tr><td>B2B 세일즈</td><td style="text-align:left;">게임사 / 에이전시 / 교육기관 직접 영업</td><td>₩15,000,000</td><td>세일즈 도구 + 출장</td></tr>

<tr><td colspan="4" style="text-align:left; color:#ffb86c; font-weight:700; background:rgba(255,184,108,0.05);">사무실 & 운영비 — ₩40,000,000 (8%)</td></tr>
<tr><td>사무실 임대</td><td style="text-align:left;">판교/강남 공유오피스 10~15인석 (보증금 포함)</td><td>₩22,000,000</td><td>월 ₩1.2M × 18개월 + 보증금</td></tr>
<tr><td>장비 구매</td><td style="text-align:left;">개발용 노트북/모니터 7세트, 서버 테스트 장비</td><td>₩10,000,000</td><td>1인당 ₩1.4M</td></tr>
<tr><td>SaaS 구독</td><td style="text-align:left;">Slack, Notion, GitHub Org, Figma, Linear</td><td>₩5,000,000</td><td>18개월</td></tr>
<tr><td>법률/회계 자문</td><td style="text-align:left;">세무사 기장료, 법무 자문, 노무사</td><td>₩3,000,000</td><td>18개월</td></tr>

<tr><td colspan="4" style="text-align:left; color:#ff79c6; font-weight:700; background:rgba(255,121,198,0.05);">IP (특허/상표/인증) — ₩25,000,000 (5%)</td></tr>
<tr><td>국내 특허 6건</td><td style="text-align:left;">발명 특허 출원 + 심사청구 (변리사 대리)</td><td>₩21,000,000</td><td>건당 ₩3.5M</td></tr>
<tr><td>상표/디자인/저작권</td><td style="text-align:left;">상표 2건(국내+마드리드), 프로그램 저작권, UI 디자인</td><td>₩2,500,000</td><td>—</td></tr>
<tr><td>보안 인증</td><td style="text-align:left;">ISMS-P 예비 컨설팅, SOC2 Type 1 준비</td><td>₩5,000,000</td><td>엔터프라이즈 영업 필수</td></tr>

<tr><td colspan="4" style="text-align:left; color:#8b949e; font-weight:700; background:rgba(139,148,158,0.05);">예비비 — ₩25,000,000 (5%)</td></tr>
<tr><td>긴급 대응 / 기회 투자</td><td style="text-align:left;">서버 장애 대응, 예상 외 인력 충원, 전략적 파트너십</td><td>₩25,000,000</td><td>—</td></tr>

<tr class="highlight-row"><td colspan="2" style="font-size:15px;">투자금 집행 총계</td><td style="font-size:15px;">₩500,000,000</td><td></td></tr>
</tbody>
</table>
</div>
</div>

<!-- 8. Financial Projections -->
<div class="ir-section">
<h2 class="ir-section-header">8. 재무 예측 (36개월)</h2>

<p style="font-size:14px; color:#8b949e; margin-bottom:24px; line-height:1.8;">
아래 예측은 <strong>보수적 기본(Base) 시나리오</strong>입니다. Free→Paid 전환율 3.5%, ARPU ₩38,000(Starter 50%, Pro 35%, Team 12%, Add-on 포함),
연간 이탈률(Churn) 5%/월을 적용했습니다.
</p>

<div class="ir-table-wrapper">
<table class="ir-table">
<thead>
<tr>
<th style="text-align:left;">(단위: 천원 / 명)</th>
<th>6개월차</th>
<th>12개월차</th>
<th>18개월차</th>
<th>24개월차</th>
<th>36개월차</th>
</tr>
</thead>
<tbody>
<tr>
<td>Free 사용자 (누적)</td>
<td>400</td><td>1,500</td><td>3,500</td><td>7,000</td><td>18,000</td>
</tr>
<tr>
<td>유료 사용자 (월간 활성)</td>
<td>14</td><td>53</td><td>123</td><td>245</td><td>630</td>
</tr>
<tr class="highlight-row">
<td>MRR (월간반복매출)</td>
<td>532</td><td>2,014</td><td>4,674</td><td>9,310</td><td>23,940</td>
</tr>
<tr class="highlight-row">
<td>ARR (연간반복매출)</td>
<td>6,384</td><td>24,168</td><td>56,088</td><td>111,720</td><td>287,280</td>
</tr>
<tr>
<td>Add-on 매출 (월간)</td>
<td>150</td><td>600</td><td>1,500</td><td>3,200</td><td>9,500</td>
</tr>
<tr style="border-top:2px solid rgba(255,255,255,0.1);">
<td>총 월 매출</td>
<td>682</td><td>2,614</td><td>6,174</td><td>12,510</td><td>33,440</td>
</tr>
<tr><td colspan="6" style="padding:4px;"></td></tr>
<tr>
<td>인프라 비용 (월)</td>
<td>4,500</td><td>6,000</td><td>8,500</td><td>12,000</td><td>22,000</td>
</tr>
<tr>
<td>인건비 (월)</td>
<td>36,850</td><td>36,850</td><td>50,000</td><td>55,000</td><td>72,000</td>
</tr>
<tr>
<td>마케팅 (월)</td>
<td>3,500</td><td>4,000</td><td>5,000</td><td>6,000</td><td>8,000</td>
</tr>
<tr>
<td>운영비 (월)</td>
<td>2,200</td><td>2,200</td><td>2,800</td><td>3,000</td><td>4,000</td>
</tr>
<tr>
<td>총 월 비용</td>
<td>47,050</td><td>49,050</td><td>66,300</td><td>76,000</td><td>106,000</td>
</tr>
<tr><td colspan="6" style="padding:4px;"></td></tr>
<tr class="green-row">
<td>월 순이익</td>
<td>(46,368)</td><td>(46,436)</td><td>(60,126)</td><td>(63,490)</td><td>(72,560)</td>
</tr>
<tr class="metric-row">
<td>누적 현금 잔액</td>
<td>₩310M</td><td>₩138M</td><td>—</td><td>—</td><td>—</td>
</tr>
</tbody>
</table>
</div>

<div style="margin-top:24px; padding:24px; background:rgba(255,184,108,0.05); border:1px solid rgba(255,184,108,0.2); border-radius:12px;">
<h4 style="margin-top:0; color:#ffb86c; font-size:16px;">⚠️ 현실적 시나리오 분석</h4>
<p style="font-size:14px; color:#c9d1d9; line-height:1.8; margin-bottom:16px;">
5억원 투자금으로 18~20개월간 운영이 가능합니다. 이 기간 내에 아래 마일스톤 중 하나를 달성해야 합니다:
</p>
<div class="ir-grid" style="grid-template-columns: repeat(3, 1fr); gap:12px;">
<div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; border-top:3px solid #50fa7b;">
<h5 style="color:#50fa7b; margin:0 0 8px 0; font-size:14px;">시나리오 A: 자생</h5>
<p style="font-size:12px; color:#8b949e; line-height:1.6; margin:0;">
18개월 내 MRR ₩50M+ 달성 시 추가 투자 없이 자생 가능.
필요 유료 유저: <strong>~1,300명</strong><br>
달성 확률: <span style="color:#ffb86c;">15~25%</span>
</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; border-top:3px solid #58a6ff;">
<h5 style="color:#58a6ff; margin:0 0 8px 0; font-size:14px;">시나리오 B: 시리즈 A</h5>
<p style="font-size:12px; color:#8b949e; line-height:1.6; margin:0;">
12~18개월에 MRR ₩5~10M + 유료 130~260명 달성 시 시리즈 A(20~50억) 유치.
<strong>가장 현실적 경로</strong><br>
달성 확률: <span style="color:#50fa7b;">50~65%</span>
</p>
</div>
<div style="background:rgba(0,0,0,0.2); padding:16px; border-radius:8px; border-top:3px solid #bd93f9;">
<h5 style="color:#bd93f9; margin:0 0 8px 0; font-size:14px;">시나리오 C: 전략적 제휴</h5>
<p style="font-size:12px; color:#8b949e; line-height:1.6; margin:0;">
게임사/클라우드 업체와 B2B 파트너십 → 안정 수익 확보.
대상: 넷마블, 크래프톤, NHN Cloud 등<br>
달성 확률: <span style="color:#ffb86c;">20~35%</span>
</p>
</div>
</div>
</div>

<div style="margin-top:24px; background:rgba(80,250,123,0.04); border:1px solid rgba(80,250,123,0.15); border-radius:12px; padding:20px;">
<h4 style="margin-top:0; color:#50fa7b; font-size:16px;">📈 낙관적 시나리오 (3년)</h4>
<p style="font-size:14px; color:#c9d1d9; line-height:1.8; margin-bottom:12px;">
Product Hunt Top 5 + Hacker News 프론트페이지 달성, 또는 게임사 B2B 계약 확보 시:
</p>
<div class="ir-grid" style="grid-template-columns: repeat(4, 1fr); gap:12px;">
<div style="text-align:center; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="font-size:24px; font-weight:800; color:#50fa7b;">₩4.01억</div>
<div style="font-size:12px; color:#8b949e;">3년차 ARR</div>
</div>
<div style="text-align:center; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="font-size:24px; font-weight:800; color:#50fa7b;">880명</div>
<div style="font-size:12px; color:#8b949e;">유료 사용자</div>
</div>
<div style="text-align:center; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="font-size:24px; font-weight:800; color:#50fa7b;">68%</div>
<div style="font-size:12px; color:#8b949e;">매출총이익률</div>
</div>
<div style="text-align:center; padding:16px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="font-size:24px; font-weight:800; color:#50fa7b;">₩100~200억</div>
<div style="font-size:12px; color:#8b949e;">기업가치 (시리즈 A)</div>
</div>
</div>
</div>
</div>

<!-- 9. Execution Roadmap -->
<div class="ir-section">
<h2 class="ir-section-header">9. 실행 로드맵</h2>

<div class="ir-grid" style="grid-template-columns: repeat(3, 1fr); gap: 16px;">
<div class="ir-card" style="padding: 20px; border-top: 4px solid #58a6ff;">
<h4 style="color: #58a6ff; font-size: 16px; margin-top: 0;">Phase 1: 상용화 기반 구축</h4>
<div style="font-size:12px; color:#8b949e; margin-bottom:12px;">Month 1~6 · 투자금 ₩280M 집행</div>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.8;">
<li style="color:#e6edf3;">법인 설립 + 벤처기업 인증</li>
<li style="color:#e6edf3;">핵심 인력 7명 채용</li>
<li style="color:#e6edf3;">Vultr MI300X 인프라 이전</li>
<li style="color:#e6edf3;">Stripe/Toss 결제 시스템 연동</li>
<li>Free/Starter/Pro 과금 시스템 구현</li>
<li>OAuth 로그인 (GitHub, Google)</li>
<li>특허 3건 출원</li>
<li>기업부설연구소 설립</li>
<li style="color:#e6edf3;">Product Hunt + HN 런칭</li>
<li>모니터링 (Prometheus + Grafana)</li>
</ul>
</div>

<div class="ir-card" style="padding: 20px; border-top: 4px solid #50fa7b;">
<h4 style="color: #50fa7b; font-size: 16px; margin-top: 0;">Phase 2: 시장 확장</h4>
<div style="font-size:12px; color:#8b949e; margin-bottom:12px;">Month 7~18 · 투자금 ₩195M 집행</div>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.8;">
<li style="color:#e6edf3;">Team/Enterprise 플랜 출시</li>
<li style="color:#e6edf3;">팀 기능 (초대, RBAC, 공유 프로젝트)</li>
<li>공개 REST API + CLI 도구 출시</li>
<li style="color:#e6edf3;">B2B 게임사/에이전시 영업 시작</li>
<li>GPU 스트리밍 종량제 과금</li>
<li>AI 이미지 생성 API 공개</li>
<li>마켓플레이스 (원클릭 템플릿)</li>
<li>특허 2건 추가 + PCT 출원</li>
<li style="color:#e6edf3;">시리즈 A 투자 유치</li>
<li>ISMS-P / SOC2 인증 진행</li>
</ul>
</div>

<div class="ir-card" style="padding: 20px; border-top: 4px solid #bd93f9;">
<h4 style="color: #bd93f9; font-size: 16px; margin-top: 0;">Phase 3: 스케일업</h4>
<div style="font-size:12px; color:#8b949e; margin-bottom:12px;">Month 19~36 · 시리즈 A 자금</div>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.8;">
<li style="color:#e6edf3;">Kubernetes 전환 (무한 스케일링)</li>
<li style="color:#e6edf3;">멀티 리전 배포 (Asia, US, EU)</li>
<li>Enterprise SSO/SAML + 감사 로그</li>
<li>GitHub App 마켓플레이스 등록</li>
<li style="color:#e6edf3;">조직 20명 확장</li>
<li>글로벌 CS 체계 구축 (영어/일본어)</li>
<li>전략적 파트너십 (클라우드 벤더)</li>
<li>자체 GPU 클러스터 검토</li>
</ul>
</div>
</div>
</div>

<!-- 10. Investment Ask -->
<div class="ir-section">
<h2 class="ir-section-header">10. 투자 요청</h2>

<div style="text-align:center; padding:40px; background:linear-gradient(135deg, rgba(88,166,255,0.08), rgba(189,147,249,0.08)); border-radius:16px; border:1px solid rgba(88,166,255,0.2);">
<div style="font-size:16px; color:#8b949e; margin-bottom:8px;">Pre-Seed / Seed Round</div>
<div style="font-size:48px; font-weight:800; background:linear-gradient(90deg, #58a6ff, #bd93f9); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin-bottom:8px;">₩500,000,000</div>
<div style="font-size:14px; color:#c9d1d9; margin-bottom:24px;">5억원 · 지분율 10~15% (Pre-money Valuation ₩33~45억) · 상세 지분구조 아래 참조</div>

<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; max-width:700px; margin:0 auto;">
<div style="padding:16px; background:rgba(0,0,0,0.3); border-radius:8px;">
<div style="font-size:20px; font-weight:700; color:#58a6ff;">18개월</div>
<div style="font-size:12px; color:#8b949e;">운영 Runway</div>
</div>
<div style="padding:16px; background:rgba(0,0,0,0.3); border-radius:8px;">
<div style="font-size:20px; font-weight:700; color:#50fa7b;">MRR ₩5M+</div>
<div style="font-size:12px; color:#8b949e;">12개월 목표</div>
</div>
<div style="padding:16px; background:rgba(0,0,0,0.3); border-radius:8px;">
<div style="font-size:20px; font-weight:700; color:#bd93f9;">시리즈 A</div>
<div style="font-size:12px; color:#8b949e;">12~18개월 내 유치</div>
</div>
</div>
</div>

<div style="margin-top:32px; background:rgba(255,255,255,0.02); padding:24px; border-radius:12px; border-left:4px solid #50fa7b;">
<h4 style="margin-top:0; color:#50fa7b; font-size:16px;">투자자에게 드리는 약속</h4>
<div class="ir-grid" style="grid-template-columns: 1fr 1fr; gap:16px; margin-top:12px;">
<div>
<p style="font-size:14px; color:#c9d1d9; line-height:1.8; margin:0;">
<strong>1. 검증된 제품:</strong> MVP가 아닙니다. 이미 실제 프로젝트를 배포 운영 중인 완성된 플랫폼입니다.<br>
<strong>2. 방어 가능한 기술:</strong> 특허 6건 출원으로 핵심 기술을 법적 보호합니다.<br>
<strong>3. 자본 효율성:</strong> AI 활용 개발로 수억원의 R&D 비용을 이미 절감했습니다.
</p>
</div>
<div>
<p style="font-size:14px; color:#c9d1d9; line-height:1.8; margin:0;">
<strong>4. 명확한 Exit 경로:</strong> PaaS 시장은 M&A가 활발합니다 (Heroku→Salesforce ₩3,180억, Vercel ₩5.25조).<br>
<strong>5. 차별화된 포지셔닝:</strong> AI 오류수정 + AI 코드에디터 + 게임 스트리밍 + Docker 통합 PaaS는 직접 경쟁 제품이 확인되지 않습니다.<br>
<strong>6. 투명한 운영:</strong> 월간 투자자 리포트 + 분기 이사회로 투명하게 경영합니다.
</p>
</div>
</div>
</div>
</div>

<!-- 11. Equity Structure -->
<div class="ir-section">
<h2 class="ir-section-header">11. 지분 구조 & Cap Table</h2>

<h3 style="color: #58a6ff; font-size: 18px; margin-bottom: 16px;">11.1 설립 시 지분 구조 (Seed 투자 후)</h3>

<p style="font-size:14px; color:#c9d1d9; line-height:1.8; margin-bottom:20px;">
총 발행주식 10,000주(액면가 ₩50,000) 기준으로 설계합니다. Seed 투자자에게 신주 발행(유상증자)으로
지분을 배분하며, 스톡옵션 풀은 <strong>전체 지분의 10%</strong>를 초기부터 확보하여 핵심 인재 유인에 활용합니다.
</p>

<!-- Pie Chart Visual -->
<div style="display:flex; gap:40px; align-items:center; margin-bottom:32px;">
<div style="position:relative; width:260px; height:260px; flex-shrink:0;">
<svg viewBox="0 0 200 200" style="width:260px; height:260px; transform:rotate(-90deg);">
<!-- Founder: 60% -->
<circle cx="100" cy="100" r="80" fill="none" stroke="#58a6ff" stroke-width="36"
stroke-dasharray="301.6 502.65" stroke-dashoffset="0" opacity="0.9"/>
<!-- Investor: 15% -->
<circle cx="100" cy="100" r="80" fill="none" stroke="#50fa7b" stroke-width="36"
stroke-dasharray="75.4 502.65" stroke-dashoffset="-301.6" opacity="0.9"/>
<!-- Co-founder/CTO: 10% -->
<circle cx="100" cy="100" r="80" fill="none" stroke="#bd93f9" stroke-width="36"
stroke-dasharray="50.27 502.65" stroke-dashoffset="-377" opacity="0.9"/>
<!-- ESOP Pool: 10% -->
<circle cx="100" cy="100" r="80" fill="none" stroke="#ffb86c" stroke-width="36"
stroke-dasharray="50.27 502.65" stroke-dashoffset="-427.27" opacity="0.9"/>
<!-- Advisor: 5% -->
<circle cx="100" cy="100" r="80" fill="none" stroke="#ff79c6" stroke-width="36"
stroke-dasharray="25.13 502.65" stroke-dashoffset="-477.54" opacity="0.9"/>
</svg>
<div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%) rotate(0deg); text-align:center;">
<div style="font-size:22px; font-weight:800; color:#e6edf3;">10,000주</div>
<div style="font-size:11px; color:#8b949e;">총 발행주식</div>
</div>
</div>

<div style="flex:1;">
<div style="display:grid; gap:12px;">
<div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="width:16px; height:16px; border-radius:4px; background:#58a6ff; flex-shrink:0;"></div>
<div style="flex:1;">
<div style="font-size:14px; font-weight:700; color:#58a6ff;">창업자 (대표이사)</div>
<div style="font-size:12px; color:#8b949e;">제품 개발, 기술 아키텍처, 사업 전략 총괄</div>
</div>
<div style="text-align:right;">
<div style="font-size:18px; font-weight:800; color:#58a6ff;">60%</div>
<div style="font-size:11px; color:#8b949e;">6,000주</div>
</div>
</div>

<div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="width:16px; height:16px; border-radius:4px; background:#50fa7b; flex-shrink:0;"></div>
<div style="flex:1;">
<div style="font-size:14px; font-weight:700; color:#50fa7b;">Seed 투자자</div>
<div style="font-size:12px; color:#8b949e;">5억원 투자 · Pre-money ₩33.3억 기준</div>
</div>
<div style="text-align:right;">
<div style="font-size:18px; font-weight:800; color:#50fa7b;">15%</div>
<div style="font-size:11px; color:#8b949e;">1,500주</div>
</div>
</div>

<div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="width:16px; height:16px; border-radius:4px; background:#bd93f9; flex-shrink:0;"></div>
<div style="flex:1;">
<div style="font-size:14px; font-weight:700; color:#bd93f9;">공동창업자 / CTO</div>
<div style="font-size:12px; color:#8b949e;">4년 베스팅 · 1년 클리프</div>
</div>
<div style="text-align:right;">
<div style="font-size:18px; font-weight:800; color:#bd93f9;">10%</div>
<div style="font-size:11px; color:#8b949e;">1,000주</div>
</div>
</div>

<div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="width:16px; height:16px; border-radius:4px; background:#ffb86c; flex-shrink:0;"></div>
<div style="flex:1;">
<div style="font-size:14px; font-weight:700; color:#ffb86c;">스톡옵션 풀 (ESOP)</div>
<div style="font-size:12px; color:#8b949e;">핵심 직원 보상 · 4년 베스팅</div>
</div>
<div style="text-align:right;">
<div style="font-size:18px; font-weight:800; color:#ffb86c;">10%</div>
<div style="font-size:11px; color:#8b949e;">1,000주</div>
</div>
</div>

<div style="display:flex; align-items:center; gap:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<div style="width:16px; height:16px; border-radius:4px; background:#ff79c6; flex-shrink:0;"></div>
<div style="flex:1;">
<div style="font-size:14px; font-weight:700; color:#ff79c6;">어드바이저</div>
<div style="font-size:12px; color:#8b949e;">산업 전문가 · 투자 네트워크 · 기술 자문</div>
</div>
<div style="text-align:right;">
<div style="font-size:18px; font-weight:800; color:#ff79c6;">5%</div>
<div style="font-size:11px; color:#8b949e;">500주</div>
</div>
</div>
</div>
</div>
</div>

<h3 style="color: #58a6ff; font-size: 18px; margin: 32px 0 16px;">11.2 투자 라운드별 지분 희석 시뮬레이션</h3>

<div class="ir-table-wrapper">
<table class="ir-table" style="font-size:13px;">
<thead>
<tr>
<th style="text-align:left;">라운드</th>
<th>시점</th>
<th>투자금</th>
<th>Pre-money</th>
<th>Post-money</th>
<th>신규 지분</th>
<th style="text-align:left;">창업자 지분</th>
<th style="text-align:left;">Seed 투자자 지분</th>
</tr>
</thead>
<tbody>
<tr style="background:rgba(80,250,123,0.05);">
<td style="color:#50fa7b; font-weight:700;">Seed (현재)</td>
<td>2026.Q2</td>
<td>₩5억</td>
<td>₩33.3억</td>
<td>₩38.3억</td>
<td>15.0%</td>
<td style="font-weight:700; color:#58a6ff;">60.0%</td>
<td style="font-weight:700; color:#50fa7b;">15.0%</td>
</tr>
<tr>
<td style="color:#58a6ff; font-weight:700;">시리즈 A</td>
<td>2027.Q4</td>
<td>₩30억</td>
<td>₩150억</td>
<td>₩180억</td>
<td>16.7%</td>
<td style="color:#58a6ff;">50.0%</td>
<td style="color:#50fa7b;">12.5%</td>
</tr>
<tr>
<td style="color:#bd93f9; font-weight:700;">시리즈 B</td>
<td>2029.Q2</td>
<td>₩100억</td>
<td>₩600억</td>
<td>₩700억</td>
<td>14.3%</td>
<td style="color:#58a6ff;">42.9%</td>
<td style="color:#50fa7b;">10.7%</td>
</tr>
<tr class="highlight-row">
<td>IPO / Exit</td>
<td>2031~</td>
<td>—</td>
<td>—</td>
<td style="font-weight:700;">₩1,500~3,000억</td>
<td>공모 20~30%</td>
<td style="font-weight:700;">30~35%</td>
<td style="font-weight:700;">7~9%</td>
</tr>
</tbody>
</table>
</div>

<div style="margin-top:20px; padding:20px; background:rgba(80,250,123,0.04); border:1px solid rgba(80,250,123,0.15); border-radius:12px;">
<h4 style="margin-top:0; color:#50fa7b; font-size:15px;">💰 Seed 투자자 수익 시뮬레이션</h4>
<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:12px; margin-top:12px;">
<div style="padding:16px; background:rgba(0,0,0,0.2); border-radius:8px; text-align:center;">
<div style="font-size:12px; color:#8b949e; margin-bottom:4px;">시리즈 A 시점 (18개월)</div>
<div style="font-size:22px; font-weight:800; color:#50fa7b;">₩22.5억</div>
<div style="font-size:12px; color:#8b949e;">12.5% × ₩180억 = <strong style="color:#50fa7b;">4.5배</strong></div>
</div>
<div style="padding:16px; background:rgba(0,0,0,0.2); border-radius:8px; text-align:center;">
<div style="font-size:12px; color:#8b949e; margin-bottom:4px;">시리즈 B 시점 (3년)</div>
<div style="font-size:22px; font-weight:800; color:#50fa7b;">₩75억</div>
<div style="font-size:12px; color:#8b949e;">10.7% × ₩700억 = <strong style="color:#50fa7b;">15배</strong></div>
</div>
<div style="padding:16px; background:rgba(0,0,0,0.2); border-radius:8px; text-align:center;">
<div style="font-size:12px; color:#8b949e; margin-bottom:4px;">IPO/Exit (5년)</div>
<div style="font-size:22px; font-weight:800; color:#50fa7b;">₩150~270억</div>
<div style="font-size:12px; color:#8b949e;">~9% × ₩1,500~3,000억 = <strong style="color:#50fa7b;">30~54배</strong></div>
</div>
</div>
</div>

<h3 style="color: #58a6ff; font-size: 18px; margin: 32px 0 16px;">11.3 주요 투자 조건 (Term Sheet 개요)</h3>

<div class="ir-table-wrapper">
<table class="ir-table" style="text-align: left; font-size:13px;">
<thead>
<tr><th>조항</th><th>내용</th><th>비고</th></tr>
</thead>
<tbody>
<tr><td style="color:#58a6ff;">투자 형태</td><td>상환전환우선주 (RCPS)</td><td>국내 VC 표준 구조</td></tr>
<tr><td style="color:#58a6ff;">전환 비율</td><td>보통주 1:1 전환</td><td>IPO 시 자동 전환</td></tr>
<tr><td style="color:#58a6ff;">우선 배당</td><td>연 1% 비누적 우선배당</td><td>표준 조건</td></tr>
<tr><td style="color:#58a6ff;">잔여재산 분배</td><td>투자원금 + 연 8% 복리 우선 분배 후 잔여 보통주 안분</td><td>1x 청산 우선권</td></tr>
<tr><td style="color:#58a6ff;">희석방지 조항</td><td>Weighted Average (가중평균) 방식</td><td>다운라운드 보호</td></tr>
<tr><td style="color:#58a6ff;">이사회 구성</td><td>대표 2석 + 투자자 1석 (총 3석)</td><td>경영 참여권</td></tr>
<tr><td style="color:#58a6ff;">동반매도권 (Tag-Along)</td><td>대표 지분 매각 시 투자자 동반 매도 권리</td><td>소수주주 보호</td></tr>
<tr><td style="color:#58a6ff;">동반매도청구권 (Drag-Along)</td><td>전체 지분 67% 이상 동의 시 전원 매각 강제</td><td>Exit 보장</td></tr>
<tr><td style="color:#58a6ff;">우선매수권</td><td>후속 라운드 참여 우선권 (Pro-rata)</td><td>지분 유지 기회</td></tr>
<tr><td style="color:#58a6ff;">정보제공 의무</td><td>월간 경영보고 + 분기 재무제표 + 연간 감사보고서</td><td>투명 경영</td></tr>
<tr><td style="color:#58a6ff;">Lock-up</td><td>창업자 2년 보호예수, 투자자 1년 보호예수</td><td>IPO 시 적용</td></tr>
</tbody>
</table>
</div>

<h3 style="color: #58a6ff; font-size: 18px; margin: 32px 0 16px;">11.4 스톡옵션(ESOP) 배분 계획</h3>

<div style="padding:20px; background:rgba(255,184,108,0.04); border:1px solid rgba(255,184,108,0.15); border-radius:12px;">
<p style="font-size:14px; color:#c9d1d9; line-height:1.8; margin-top:0;">
전체 지분의 <strong>10% (1,000주)</strong>를 스톡옵션 풀로 확보합니다. 핵심 인재의 장기 동기부여와 이탈 방지를 위해
<strong>4년 베스팅 + 1년 클리프</strong> 구조를 적용합니다.
</p>
<div class="ir-table-wrapper" style="margin-top:12px; padding:12px;">
<table class="ir-table" style="font-size:13px;">
<thead>
<tr><th style="text-align:left;">대상</th><th>배분 비율</th><th>주식 수</th><th>행사가</th><th>베스팅</th></tr>
</thead>
<tbody>
<tr><td>시니어 개발자 (백엔드/AI/DevOps)</td><td>4.0%</td><td>400주 (3명 분할)</td><td>₩50,000</td><td>4년, 1년 클리프</td></tr>
<tr><td>미드레벨 개발자 (프론트)</td><td>1.5%</td><td>150주</td><td>₩50,000</td><td>4년, 1년 클리프</td></tr>
<tr><td>사업개발/마케팅</td><td>1.5%</td><td>150주</td><td>₩50,000</td><td>4년, 1년 클리프</td></tr>
<tr><td>Phase 2 채용 인력 예비분</td><td>2.0%</td><td>200주</td><td>시가 기준</td><td>4년, 1년 클리프</td></tr>
<tr><td>성과 보상 풀 (예비)</td><td>1.0%</td><td>100주</td><td>시가 기준</td><td>이사회 결정</td></tr>
<tr class="highlight-row"><td>합계</td><td>10.0%</td><td>1,000주</td><td colspan="2"></td></tr>
</tbody>
</table>
</div>
<div style="margin-top:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<strong style="color:#ffb86c; font-size:13px;">💡 ESOP 가치 시뮬레이션:</strong>
<span style="font-size:13px; color:#8b949e;">시리즈 A 기준 1주 가치 ₩180만원 → 시니어 개발자 개인 보유 약 133주 × ₩180만원 = <strong style="color:#50fa7b;">약 2.4억원</strong>.
IPO 시 1주 ₩1,500만~3,000만원 예상 → 개인 최대 <strong style="color:#50fa7b;">약 20~40억원</strong>.</span>
</div>
</div>
</div>

<!-- 12. Exit Strategy -->
<div class="ir-section">
<h2 class="ir-section-header">12. Exit 전략</h2>

<p style="font-size:15px; color:#c9d1d9; line-height:1.8; margin-bottom:24px;">
투자자에게 <strong>3가지 Exit 경로</strong>를 제공합니다. PaaS/DevTool 시장은 M&A와 IPO 모두 활발한 영역이며,
글로벌 대형 인수 사례가 풍부하여 Exit 가시성이 높습니다.
</p>

<!-- Exit Route 1: M&A -->
<div style="margin-bottom:24px; padding:24px; background:rgba(88,166,255,0.04); border:1px solid rgba(88,166,255,0.15); border-radius:12px; border-left:4px solid #58a6ff;">
<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
<div>
<h3 style="margin:0; color:#58a6ff; font-size:18px;">Exit 경로 1: 전략적 M&A (인수합병)</h3>
<span class="ir-patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff; margin-top:8px;">목표 시점: 3~5년차</span>
<span class="ir-patent-badge" style="background:rgba(80,250,123,0.15); color:#50fa7b;">달성 확률: 40~55%</span>
</div>
<div style="text-align:right;">
<div style="font-size:28px; font-weight:800; color:#58a6ff;">₩500~2,000억</div>
<div style="font-size:12px; color:#8b949e;">예상 인수 가격</div>
</div>
</div>

<p style="font-size:14px; color:#c9d1d9; line-height:1.8; margin-bottom:16px;">
PaaS/DevTool 분야는 대형 플랫폼 기업의 <strong>"Build vs. Buy"</strong> 전략에서 인수(Buy)가 일반적인 영역입니다.
Orbitron의 AI 오류 분석 + 게임 스트리밍 + Docker 통합 기술은 기존 클라우드 벤더의 제품 포트폴리오에
즉시 통합 가능한 높은 시너지를 제공합니다.
</p>

<h4 style="color:#58a6ff; font-size:15px; margin-bottom:12px;">잠재적 인수자 (Strategic Acquirers)</h4>
<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; margin-bottom:16px;">
<div style="padding:14px; background:rgba(0,0,0,0.2); border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">글로벌 클라우드 벤더</strong>
<p style="font-size:12px; color:#8b949e; margin:4px 0 0; line-height:1.6;">
<strong>AWS</strong> — PaaS 제품 보강 (Elastic Beanstalk 대체)<br>
<strong>Microsoft/Azure</strong> — GitHub 생태계 확장, Azure DevOps 통합<br>
<strong>Google Cloud</strong> — Cloud Run/App Engine 강화<br>
<strong>Cloudflare</strong> — Workers/Pages 확장, 이미 터널 파트너
</p>
</div>
<div style="padding:14px; background:rgba(0,0,0,0.2); border-radius:8px;">
<strong style="color:#e6edf3; font-size:13px;">국내 대기업 / 게임사</strong>
<p style="font-size:12px; color:#8b949e; margin:4px 0 0; line-height:1.6;">
<strong>NHN Cloud</strong> — 게임 호스팅 + PaaS 통합<br>
<strong>카카오/네이버 클라우드</strong> — 개발자 생태계 확대<br>
<strong>크래프톤/넷마블</strong> — 게임 스트리밍 기술 내재화<br>
<strong>삼성SDS/LG CNS</strong> — 엔터프라이즈 PaaS 진출
</p>
</div>
</div>

<h4 style="color:#58a6ff; font-size:15px; margin-bottom:12px;">글로벌 M&A 선례 (Comparable Transactions)</h4>
<div class="ir-table-wrapper" style="padding:12px; margin-top:8px;">
<table class="ir-table" style="font-size:12px;">
<thead>
<tr><th style="text-align:left;">인수 대상</th><th style="text-align:left;">인수자</th><th>인수가</th><th>인수 시점</th><th>매출 멀티플</th><th>비고</th></tr>
</thead>
<tbody>
<tr><td>Heroku</td><td style="text-align:left;">Salesforce</td><td>₩3,180억</td><td>2010</td><td>~30x ARR</td><td>PaaS 대표 인수</td></tr>
<tr><td>GitHub</td><td style="text-align:left;">Microsoft</td><td>₩11.3조</td><td>2018</td><td>~25x ARR</td><td>개발자 생태계</td></tr>
<tr><td>Netlify</td><td style="text-align:left;">—</td><td>₩3조 (밸류)</td><td>2021</td><td>~40x ARR</td><td>시리즈 D 기업가치</td></tr>
<tr><td>Docker Inc.</td><td style="text-align:left;">—</td><td>₩7,500억+ (밸류)</td><td>2022</td><td>~20x ARR</td><td>컨테이너 플랫폼</td></tr>
<tr><td>Vercel</td><td style="text-align:left;">—</td><td>₩5.25조 (밸류)</td><td>2024</td><td>~35x ARR</td><td>시리즈 E</td></tr>
<tr><td>Wiz</td><td style="text-align:left;">Google</td><td>₩48조</td><td>2025</td><td>~50x ARR</td><td>클라우드 보안</td></tr>
</tbody>
</table>
</div>
<div style="margin-top:12px; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<strong style="color:#58a6ff; font-size:13px;">📊 Orbitron M&A 밸류에이션 추정:</strong>
<span style="font-size:13px; color:#8b949e;">3년차 ARR ₩2.87억 × 20~35배 멀티플 = <strong style="color:#50fa7b;">₩57~100억</strong>.
5년차 ARR ₩50억+ 달성 시 = <strong style="color:#50fa7b;">₩500~1,750억</strong> (AI + 게임 프리미엄 적용).</span>
</div>
</div>

<!-- Exit Route 2: IPO -->
<div style="margin-bottom:24px; padding:24px; background:rgba(189,147,249,0.04); border:1px solid rgba(189,147,249,0.15); border-radius:12px; border-left:4px solid #bd93f9;">
<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
<div>
<h3 style="margin:0; color:#bd93f9; font-size:18px;">Exit 경로 2: 코스닥 IPO (기업공개)</h3>
<span class="ir-patent-badge" style="background:rgba(189,147,249,0.15); color:#bd93f9; margin-top:8px;">목표 시점: 5~7년차</span>
<span class="ir-patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c;">달성 확률: 25~40%</span>
</div>
<div style="text-align:right;">
<div style="font-size:28px; font-weight:800; color:#bd93f9;">₩1,500~3,000억</div>
<div style="font-size:12px; color:#8b949e;">예상 시가총액</div>
</div>
</div>

<h4 style="color:#bd93f9; font-size:15px; margin-bottom:12px;">코스닥 상장 요건 충족 분석</h4>
<div class="ir-table-wrapper" style="padding:12px; margin-top:8px;">
<table class="ir-table" style="font-size:13px; text-align:left;">
<thead>
<tr><th>상장 요건 (기술특례)</th><th>기준</th><th>Orbitron 충족 가능성</th><th>비고</th></tr>
</thead>
<tbody>
<tr>
<td style="color:#bd93f9;">상장 트랙</td>
<td>기술특례 상장 (기술성 평가)</td>
<td style="color:#50fa7b; font-weight:700;">✅ 적합</td>
<td>AI + 클라우드 + 게임 기술 보유</td>
</tr>
<tr>
<td style="color:#bd93f9;">기술성 평가</td>
<td>전문 평가기관 A 또는 BBB 이상</td>
<td style="color:#50fa7b; font-weight:700;">✅ 가능</td>
<td>특허 6건 + 차별화 기술 → A등급 목표</td>
</tr>
<tr>
<td style="color:#bd93f9;">자기자본</td>
<td>₩10억 이상 (기술특례 면제 가능)</td>
<td style="color:#50fa7b; font-weight:700;">✅ 충족</td>
<td>시리즈 A 후 자기자본 ₩30억+</td>
</tr>
<tr>
<td style="color:#bd93f9;">매출</td>
<td>기술특례 시 매출 요건 면제</td>
<td style="color:#50fa7b; font-weight:700;">✅ 면제</td>
<td>기술성 평가로 대체</td>
</tr>
<tr>
<td style="color:#bd93f9;">영업이익</td>
<td>기술특례 시 적자 허용</td>
<td style="color:#50fa7b; font-weight:700;">✅ 면제</td>
<td>성장 단계 적자 허용</td>
</tr>
<tr>
<td style="color:#bd93f9;">설립 연수</td>
<td>3년 이상 (기술특례 면제 가능)</td>
<td style="color:#ffb86c; font-weight:700;">⚠️ 5~7년차 달성</td>
<td>5년차 이후 상장 추진</td>
</tr>
<tr>
<td style="color:#bd93f9;">지배구조</td>
<td>사외이사, 감사위원회 등</td>
<td style="color:#58a6ff;">📋 Phase 3 구축</td>
<td>시리즈 B 전후 구성</td>
</tr>
<tr>
<td style="color:#bd93f9;">주관사</td>
<td>상장 주관 증권사 선정</td>
<td style="color:#58a6ff;">📋 4~5년차</td>
<td>한국투자/미래에셋/NH 등</td>
</tr>
</tbody>
</table>
</div>

<h4 style="color:#bd93f9; font-size:15px; margin:20px 0 12px;">코스닥 기술특례 상장 로드맵</h4>
<div style="position:relative; padding-left:28px; margin:16px 0;">
<div style="position:absolute; left:10px; top:0; bottom:0; width:2px; background:rgba(189,147,249,0.3);"></div>

<div style="position:relative; margin-bottom:20px;">
<div style="position:absolute; left:-23px; top:2px; width:10px; height:10px; background:#bd93f9; border-radius:50%;"></div>
<div style="padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<strong style="color:#bd93f9; font-size:13px;">Year 3 (2029) — 사전 준비</strong>
<p style="font-size:12px; color:#8b949e; margin:4px 0 0; line-height:1.6;">회계 감사 체계 구축 (Big 4 회계법인), 사외이사/감사위원회 구성, 내부통제시스템 도입, ESG 정책 수립</p>
</div>
</div>
<div style="position:relative; margin-bottom:20px;">
<div style="position:absolute; left:-23px; top:2px; width:10px; height:10px; background:#bd93f9; border-radius:50%;"></div>
<div style="padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<strong style="color:#bd93f9; font-size:13px;">Year 4 (2030) — 기술성 평가 & 주관사 선정</strong>
<p style="font-size:12px; color:#8b949e; margin:4px 0 0; line-height:1.6;">기술보증기금 또는 나이스평가정보 기술성 평가(A등급 목표), 상장 주관 증권사 선정, 상장 예비심사 준비</p>
</div>
</div>
<div style="position:relative; margin-bottom:20px;">
<div style="position:absolute; left:-23px; top:2px; width:10px; height:10px; background:#bd93f9; border-radius:50%;"></div>
<div style="padding:12px; background:rgba(0,0,0,0.2); border-radius:8px;">
<strong style="color:#bd93f9; font-size:13px;">Year 5 (2031) — 상장 예비심사 & IPO</strong>
<p style="font-size:12px; color:#8b949e; margin:4px 0 0; line-height:1.6;">한국거래소 상장 예비심사 청구 (3~6개월 소요), 증권신고서 제출, 공모가 결정 (수요예측), 코스닥 상장</p>
</div>
</div>
</div>

<div style="padding:16px; background:rgba(189,147,249,0.08); border-radius:8px; margin-top:16px;">
<strong style="color:#bd93f9; font-size:13px;">📊 IPO 밸류에이션 시뮬레이션:</strong>
<p style="font-size:13px; color:#8b949e; margin:6px 0 0; line-height:1.8;">
5년차 ARR ₩50억 가정 시, 코스닥 SaaS 기업 평균 PSR(매출 대비 시가총액) <strong>15~30배</strong> 적용:<br>
<strong style="color:#e6edf3;">보수적:</strong> ₩50억 × 15 = <strong style="color:#bd93f9;">시가총액 ₩750억</strong> (Seed 투자자 ₩67억, <strong style="color:#50fa7b;">13.5배 수익</strong>)<br>
<strong style="color:#e6edf3;">기본:</strong> ₩50억 × 22 = <strong style="color:#bd93f9;">시가총액 ₩1,100억</strong> (Seed 투자자 ₩99억, <strong style="color:#50fa7b;">19.8배 수익</strong>)<br>
<strong style="color:#e6edf3;">낙관적:</strong> ₩50억 × 30 = <strong style="color:#bd93f9;">시가총액 ₩1,500억</strong> (Seed 투자자 ₩135억, <strong style="color:#50fa7b;">27배 수익</strong>)
</p>
</div>

<h4 style="color:#bd93f9; font-size:15px; margin:24px 0 12px;">코스닥 상장 국내 유사 기업 벤치마크</h4>
<div class="ir-table-wrapper" style="padding:12px; margin-top:8px;">
<table class="ir-table" style="font-size:12px;">
<thead>
<tr><th style="text-align:left;">기업</th><th>상장 시점</th><th>상장 시 매출</th><th>상장 시 시총</th><th>PSR</th><th>특기사항</th></tr>
</thead>
<tbody>
<tr><td>카페24</td><td>2018</td><td>₩1,200억</td><td>₩8,000억</td><td>6.7x</td><td>이커머스 PaaS</td></tr>
<tr><td>가비아</td><td>2005</td><td>₩300억</td><td>₩2,000억</td><td>6.7x</td><td>호스팅/클라우드</td></tr>
<tr><td>더존비즈온</td><td>2000</td><td>₩500억</td><td>₩12,000억</td><td>24x</td><td>클라우드 ERP SaaS</td></tr>
<tr><td>알서포트</td><td>2015</td><td>₩200억</td><td>₩3,000억</td><td>15x</td><td>원격제어 SaaS</td></tr>
<tr><td>스패로우</td><td>2023</td><td>₩150억</td><td>₩2,500억</td><td>16.7x</td><td>SW 보안 (삼성SDS 인수)</td></tr>
<tr><td>마인즈랩</td><td>2022</td><td>₩80억</td><td>₩4,000억</td><td>50x</td><td>AI 기술특례 상장</td></tr>
<tr class="highlight-row"><td>Orbitron (목표)</td><td>2031</td><td>₩50억+</td><td>₩750~1,500억</td><td>15~30x</td><td>AI+PaaS 기술특례</td></tr>
</tbody>
</table>
</div>
</div>

<!-- Exit Route 3: Secondary Sale -->
<div style="margin-bottom:24px; padding:24px; background:rgba(255,184,108,0.04); border:1px solid rgba(255,184,108,0.15); border-radius:12px; border-left:4px solid #ffb86c;">
<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px;">
<div>
<h3 style="margin:0; color:#ffb86c; font-size:18px;">Exit 경로 3: 세컨더리 매각 (Secondary Sale)</h3>
<span class="ir-patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c; margin-top:8px;">수시 가능</span>
<span class="ir-patent-badge" style="background:rgba(80,250,123,0.15); color:#50fa7b;">유동성 보완</span>
</div>
</div>
<p style="font-size:14px; color:#c9d1d9; line-height:1.8; margin:0;">
IPO나 M&A 이전에도 후속 투자 라운드(시리즈 A/B) 시 기존 투자자가 보유 지분의 일부를
신규 투자자에게 매각하는 <strong>세컨더리 거래</strong>로 조기 유동화가 가능합니다.
</p>
<ul style="font-size:13px; color:#8b949e; line-height:1.8; padding-left:20px; margin-bottom:0;">
<li><strong>시리즈 A 세컨더리:</strong> Seed 지분의 20~30% 매각 → 투자원금 회수 + 잔여 지분으로 업사이드 유지</li>
<li><strong>시리즈 B 세컨더리:</strong> 추가 매각으로 확정 수익 실현, 나머지는 IPO까지 홀드</li>
<li><strong>PE(사모펀드) 인수:</strong> 시리즈 B 이후 PE 펀드의 구주 인수 제안 가능</li>
</ul>
</div>

<!-- Exit Summary -->
<div style="padding:24px; background:linear-gradient(135deg, rgba(88,166,255,0.06), rgba(80,250,123,0.06)); border:1px solid rgba(88,166,255,0.15); border-radius:12px;">
<h4 style="margin-top:0; color:#e6edf3; font-size:16px; margin-bottom:16px;">📋 Exit 전략 종합 요약</h4>
<div class="ir-table-wrapper" style="padding:12px; margin-top:8px;">
<table class="ir-table" style="font-size:13px;">
<thead>
<tr>
<th style="text-align:left;">Exit 경로</th>
<th>예상 시점</th>
<th>예상 수익률</th>
<th>Seed 투자자 회수금</th>
<th>달성 확률</th>
<th>리스크</th>
</tr>
</thead>
<tbody>
<tr>
<td style="color:#58a6ff; font-weight:700;">M&A (전략적 인수)</td>
<td>3~5년차</td>
<td style="color:#50fa7b; font-weight:700;">10~35배</td>
<td style="color:#50fa7b; font-weight:700;">₩50~175억</td>
<td>40~55%</td>
<td style="color:#ffb86c;">인수자 의향에 의존</td>
</tr>
<tr>
<td style="color:#bd93f9; font-weight:700;">코스닥 IPO</td>
<td>5~7년차</td>
<td style="color:#50fa7b; font-weight:700;">14~27배</td>
<td style="color:#50fa7b; font-weight:700;">₩67~135억</td>
<td>25~40%</td>
<td style="color:#ffb86c;">시장 상황, 심사 리스크</td>
</tr>
<tr>
<td style="color:#ffb86c; font-weight:700;">세컨더리 매각</td>
<td>2~4년차</td>
<td style="color:#50fa7b; font-weight:700;">3~10배 (부분)</td>
<td style="color:#50fa7b; font-weight:700;">₩15~50억 (부분)</td>
<td>60~70%</td>
<td style="color:#50fa7b;">상대적 저위험</td>
</tr>
<tr class="highlight-row">
<td colspan="2">가중 기대 수익</td>
<td style="font-weight:700; color:#50fa7b;">12~22배</td>
<td style="font-weight:700; color:#50fa7b;">₩60~110억</td>
<td colspan="2">투자금 대비 IRR 55~80%</td>
</tr>
</tbody>
</table>
</div>
</div>
</div>

<div style="text-align:center; padding:32px; margin-top:40px; border-top:1px solid rgba(255,255,255,0.05);">
<div style="font-size:36px; margin-bottom:8px;">🪐</div>
<div style="font-size:20px; font-weight:700; color:#e6edf3; margin-bottom:4px;">Orbitron</div>
<div style="font-size:14px; color:#8b949e; margin-bottom:16px;">"프로젝트를 궤도에 올리세요"</div>
<div style="font-size:12px; color:#666;">
IR Deck v2.2 · 2026년 4월 · Confidential<br>
Contact: admintop@orbitron.io
</div>
</div>

</div>
