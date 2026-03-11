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
object-fit: contain; /* The generated images might be square, let's use cover or contain. Actually, cover with center is better for abstract backgrounds */
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
/* Grid Layouts */
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

/* Financial Table Styling */
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

/* Growth Chart Image */
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

/* Fund use bars */
.fund-bar-container {
margin-top: 16px;
}
.fund-bar-row {
display: flex;
align-items: center;
margin-bottom: 12px;
}
.fund-label {
width: 180px;
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
width: 50px;
text-align: right;
font-size: 14px;
color: #8b949e;
font-weight: 600;
}
</style>

<div class="ir-deck">

<div class="ir-hero">
<img src="/ir_tech_hero.png" alt="Orbitron Architecture" />
<div class="ir-hero-content">
<div class="ir-hero-title">Orbitron</div>
<div class="ir-hero-subtitle">Next-Gen Enterprise 배포 플랫폼 · 투자 제안서 (IR)</div>
</div>
</div>

<div class="ir-section">
<h2 class="ir-section-header">1. Executive Summary</h2>
<p style="font-size: 18px; color: #c9d1d9; line-height: 1.8;">
Orbitron은 Cloudflare 엔터프라이즈 네트워크와 결합된 차세대 B2B PaaS(Platform as a Service)입니다. 
기존 플랫폼(Vercel, Heroku) 대비 압도적인 <strong>보안 구조(Zero-Port)</strong>, 
<strong>AI 자동화 진단(RAG)</strong>, 그리고 <strong>3D 렌더링(Pixel Streaming)</strong> 호스팅 기능을 제공하여,
전 세계 엔터프라이즈의 인프라 구축 트렌드를 혁신합니다.
</p>
</div>

<div class="ir-section">
<h2 class="ir-section-header">2. Problem & Solution</h2>
<div class="ir-grid">
<div class="ir-card" style="border-top: 3px solid #ff5555;">
<h3 style="color: #ff5555;">⚠️ Market Problems</h3>
<p>
<strong>인프라 파편화:</strong> 기존 호스팅(Cafe24, Gabia)은 CI/CD 자동화가 불가하고, 최신 프레임워크 연동을 위해 개발자가 수동 셋업에 막대한 시간을 허비합니다.<br><br>
<strong>비품질 및 스케일링 한계:</strong> 트래픽 스파이크 시 기존 호스팅은 서버가 다운되며, 초기 스타트업이 우수한 퍼블릭 클라우드(IaaS)를 직접 통제/구축할 경우 전문 DevOps 인건비 및 막대한 트래픽 과금(Bill Shock), 복잡한 VPC 설정(보안)을 감당하기 어렵습니다.<br><br>
<strong>무거운 엔진의 배포 한계:</strong> Unreal Engine / Unity WebGL 등 특수 고성능 요구 환경을 지원하는 PaaS 전무.
</p>
</div>
<div class="ir-card" style="border-top: 3px solid #50fa7b;">
<h3 style="color: #50fa7b;">💡 Orbitron Solutions</h3>
<p>
<strong>Zero-Port 통합망:</strong> 인바운드 포트를 완전 차단하고, Cloudflare 100% 터널링 기반의 원클릭 Zero-Trust 환경 제공.<br><br>
<strong>AI 배포 진단:</strong> 에러 발생 시 Gemini/Claude Vison이 즉각 분석하여 텔레그램으로 알림/제어 제공.<br><br>
<strong>3D 특화 엔진 호스팅:</strong> Gzip 압축 링커 자동화 및 GPU 클러스터 매핑을 통한 최상급 게임 퍼블리싱 대응.
</p>
</div>
</div>
</div>

<div class="ir-section">
<h2 class="ir-section-header">3. Business Model & Pricing</h2>
<div class="ir-grid" style="grid-template-columns: repeat(4, 1fr);">
<div class="ir-card" style="padding: 16px;">
<h3 style="font-size:16px; color:#50fa7b;">Starter</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">무료<span style="font-size:12px; color:#8b949e;"> / 단위별산정</span></div>
<p style="font-size:13px;">개인 개발자 & 사이드 프로젝트<br>생태계 락인(Lock-in) 유도</p>
</div>
<div class="ir-card" style="padding: 16px; border-color: rgba(88, 166, 255, 0.4);">
<h3 style="font-size:16px; color:#58a6ff;">Pro</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">₩19,000<span style="font-size:12px; color:#8b949e;">/월</span></div>
<p style="font-size:13px;">소규모 팀 (최대 10명)<br>배포 자동화 & AI 에러 분석</p>
</div>
<div class="ir-card" style="padding: 16px; background: rgba(189, 147, 249, 0.1); border-color: rgba(189, 147, 249, 0.4);">
<h3 style="font-size:16px; color:#bd93f9;">Team</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">₩49,000<span style="font-size:12px; color:#8b949e;">/월</span></div>
<p style="font-size:13px;">성장하는 팀 (멤버 무제한)<br>GPU 스트리밍 우선 할당</p>
</div>
<div class="ir-card" style="padding: 16px;">
<h3 style="font-size:16px; color:#ffb86c;">Enterprise</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">맞춤 견적</div>
<p style="font-size:13px;">대규모 조직 / 게임사<br>전용 GPU 클러스터 특화망</p>
</div>
</div>

<div style="margin-top:24px; padding:24px; background: rgba(80, 250, 123, 0.03); border: 1px solid rgba(80, 250, 123, 0.2); border-radius:12px; border-left:4px solid #50fa7b;">
<h4 style="margin-top:0; color:#e6edf3; font-size:18px; margin-bottom:12px;">📈 핵심 비즈니스 로직: 글로벌 유니콘 PaaS의 "인프라 차익 + S/W 가치창출" 모델</h4>
<p style="font-size:14px; margin-bottom:24px; line-height:1.6; color:#c9d1d9;">
Orbitron은 Vercel, Heroku, Render 등 수조 원대 기업가치를 입증한 글로벌 유니콘 서비스들과 완벽히 동일한 <strong>[인프라 도매 임대 + S/W 자동화 소매 판매]</strong> 수익 공식을 따릅니다. 막대한 초기 자본이 묶이는 자체 IDC(데이터센터) 하드웨어를 전면 배제하고, 세계 1위 AWS 인프라(백엔드) 위에 당사만의 압도적인 <strong>"AI 자가치유 및 배포 파이프라인(UX/DX)"</strong> 기술을 얹어 폭발적인 부가가치를 창출합니다.
</p>

<div class="ir-grid" style="grid-template-columns: repeat(2, 1fr); gap:16px;">
<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#58a6ff; font-size:15px; display:flex; align-items:center; gap:6px;"><span>📦</span> 1. 규모의 경제 (도매가 구매와 소매가 판매)</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
단일 고객이 AWS를 쓸 때는 비싼 On-Demand(정가)를 내야 하지만, Orbitron은 전체 고객의 트래픽을 단일 풀(Pool)로 통합합니다. 이를 통해 AWS 리소스를 <strong>장기 계약(Reserved Instances) 및 볼륨 파트너십(EDP)으로 대량 선매입</strong>하여 기본 원가를 <strong>최대 70% 이상 선제적으로 절감</strong>한 뒤, 소매가로 재판매(Reselling)하여 기본 스프레드 마진을 취합니다.
</p>
</div>

<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#bd93f9; font-size:15px; display:flex; align-items:center; gap:6px;"><span>🧑‍💻</span> 2. 인건비 대체(S/W 프리미엄 가치 창출)</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
단순히 원가에 이윤을 붙이는 커머스 구조가 아닙니다. 기업이 자체 AWS를 다룰 때 파생되는 수백만 원 대의 전문 DevOps(서버 관리자) 인건비를 Orbitron의 <strong>"원클릭 자동화 & 메신저 연동 AI 제어"</strong>가 완전히 대체합니다. 고객은 월 49,000원으로 엔지니어 팀을 고용한 것과 같은 거대한 부가가치(DX)를 제공받으며, 당사는 이를 통해 순수 소프트웨어(SaaS)에 준하는 막대한 이익률을 남깁니다.
</p>
</div>

<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#ffb86c; font-size:15px; display:flex; align-items:center; gap:6px;"><span>🛡️</span> 3. 하드웨어 투자 리스크(CapEx) 원천 배제</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
베어메탈 서버를 직접 구매하면 초기에 수십억 원의 자본(CapEx)이 증발하고 감가상각 및 하드웨어 교체 리스크가 뒤따릅니다. Orbitron은 이 모든 리스크를 AWS에 전가하고 <strong>결제(매출)가 발생하여 트래픽이 늘어나는 만큼만 인프라를 유연하게 탄력 확장하는 철저한 OpEx(운영비) 지출 모델</strong>을 확립하여 재무적 생존력을 극대화했습니다.
</p>
</div>

<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#50fa7b; font-size:15px; display:flex; align-items:center; gap:6px;"><span>🌐</span> 4. Cloudflare 전진 배치를 통한 대역폭 비용 억제</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
AWS IaaS 계열의 최대 상업적 맹점은 악명 높은 "아웃바운드 트래픽 과금(Bill Shock)"입니다. 당사는 <strong>상대적으로 저렴하거나 무제한 정액제로 운영되는 Cloudflare 엔터프라이즈 글로벌 엣지(CDN)망을 AWS 앞단 방패로 구축</strong>했습니다. 대다수 정적/이미지 트래픽을 선단에서 무료 캐싱(Caching) 상쇄함으로써, 마진 감소의 최대 주적을 원천 차단합니다.
</p>
</div>
</div>
</div>
</div>

<div class="ir-section">
<h2 class="ir-section-header">4. 10-Year Financial Projections</h2>

<div class="ir-chart-container">
<img src="/ir_growth_chart_unicorn.png" alt="10 Year J-Curve Revenue Growth" />
</div>

<p style="font-size:13px; color:#8b949e; margin-top:6px;">글로벌 클라우드(AWS) 기반 엔터프라이즈 인프라 선도입 및 AI 자가치유 엔진 고도화</p>
<div class="ir-table-wrapper">
<table class="ir-table">
<thead>
<tr>
<th>(단위: 가입자 / $10K)</th>
<th>Year 1 (2026)</th>
<th>Year 2 (2027)</th>
<th>Year 3 (2028)</th>
<th>Year 5 (2030)</th>
<th>Year 7 (2032)</th>
<th>Year 10 (2035)</th>
</tr>
</thead>
<tbody>
<tr>
<td>활성 프로젝트(앱/게임) 수</td>
<td>1,500</td>
<td>12,000</td>
<td>45,000</td>
<td>180,000</td>
<td>650,000</td>
<td>2,000,000+</td>
</tr>
<tr class="highlight-row">
<td>ARR (연간 반복매출)</td>
<td>250</td>
<td>1,800</td>
<td>8,500</td>
<td>35,000</td>
<td>125,000</td>
<td>450,000</td>
</tr>
<tr class="metric-row">
<td>YoY Growth Rate</td>
<td>-</td>
<td>620%</td>
<td>372%</td>
<td>202%</td>
<td>89%</td>
<td>53%</td>
</tr>
<tr>
<td>COGS (AWS 인프라 & CDN)</td>
<td>150</td>
<td>800</td>
<td>2,900</td>
<td>9,100</td>
<td>26,200</td>
<td>67,500</td>
</tr>
<tr class="metric-row">
<td>Gross Margin (%)</td>
<td>40%</td>
<td>55%</td>
<td>66%</td>
<td>74%</td>
<td>79%</td>
<td>85%</td>
</tr>
<tr>
<td colspan="7" style="padding: 1px;"></td>
</tr>
<tr>
<td>Total OPEX (영업비용)</td>
<td>250</td>
<td>800</td>
<td>3,800</td>
<td>18,500</td>
<td>42,000</td>
<td>110,000</td>
</tr>
<tr class="highlight-row" style="color:#50fa7b;">
<td style="color:#50fa7b;">EBITDA (영업이익)</td>
<td>(150)</td>
<td>200</td>
<td>1,800</td>
<td>7,400</td>
<td>56,800</td>
<td>272,500</td>
</tr>
<tr class="metric-row">
<td>EBITDA Margin (%)</td>
<td>-60%</td>
<td>11%</td>
<td>21%</td>
<td>21%</td>
<td>45%</td>
<td>60%</td>
</tr>
</tbody>
</table>
</div>

<div style="margin-top:24px; background: rgba(255,255,255,0.02); padding:20px; border-radius:12px; border-left:4px solid #58a6ff;">
<h4 style="margin-top:0; color:#e6edf3; font-size:16px;">📈 투자 캐시플로우 및 J-Curve 역학</h4>
<p style="font-size:14px; margin-bottom:0;">
AI 기반 100% 무인화 기술을 통해 <strong>런칭 후 2년 차(2027년)에 초기 BEP(손익분기점)를 조기 달성</strong>하도록 효율성을 극대화한 구조입니다. <strong>2029년부터 중견/대기업 엔터프라이즈 유입이 본격화되며 파이프라인이 매크로 스케일로 폭발(Turnaround)</strong>합니다. 인프라 규모의 경제 작용 및 대량 선매입 특권(EDP)을 통해 <strong>2035년 매출총이익률은 84%, 영업이익률은 60%라는 압도적인 SaaS 최상위권에 도달</strong>합니다.
</p>
</div>

<div style="margin-top:24px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top:24px;">
<h4 style="margin-top:0; color:#e6edf3; font-size:17px; margin-bottom:16px;">📝 Financial Modeling Methodology (수치 산정의 논리적 근거)</h4>
<div class="ir-grid" style="grid-template-columns: repeat(1, 1fr); gap:12px;">
<div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:8px;">
<strong style="color:#50fa7b;">1. ARR (매출) 산정:</strong> 1~3년 차는 무료 요금제(Starter)로 유입된 아마추어/스타트업 사용자가 점진적으로 유료(Pro/Team)로 전환되는 '제품 주도 성장(PLG)' 모델을 보수적으로 산출했습니다. 하지만 5년 차(2030) 기점으로는 게임사, 메타버스 구축사 등 대규모 VDI/PaaS 트래픽을 요구하는 <strong>Enterprise 커스텀 계약(건당 매출 규모 100배 확충)</strong>이 가속화되면서 기하급수적 성장 곡선(J-Curve)을 그리게 됩니다.
</div>
<div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:8px;">
<strong style="color:#ffb86c;">2. COGS (매출원가) 방어 논리:</strong> 극초기에는 AWS 자원을 온디맨드로 소량 차입하느라 매출원가율이 60%로 높게(마진 40%) 시작됩니다. 하지만 유저 풀이 거대해지는 3년 차 이후부터는 글로벌 Cloudflare CDN의 최상위 티어 정액제 구간으로 진입해 아웃바운드 대역폭 비용이 소멸하고, AWS 장기 예약 인스턴스(Reserved Instances) 72% 할인 혜택이 적용되어 10년 차 기준 <strong>매출원가가 15% 수준까지 기형적으로 압축</strong>되는 마진 확보 로직이 작동합니다.
</div>
<div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:8px;">
<strong style="color:#bd93f9;">3. OPEX (영업비용) 할당 및 절감 원칙 (The AI-Native Advantage):</strong>
<strong>① 매몰 비용(Sunk Cost) Zero:</strong> 현재 Orbitron의 상용화 직전(V1.0) 런칭까지 소요된 자체 R&D 인건비는 <strong>사실상 '0원'</strong>에 수렴합니다. 이는 창업자 1인과 최상위 AI 에이전트(1-Man AI Pair Programming)의 결합만으로 엔터프라이즈급 인프라를 구축해낸 <strong>"AI-Native DNA"</strong> 덕분입니다.
<strong>② 초기 고정비 억제:</strong> 1~3년 차의 극초기 OPEX를 30% 이하로 통제한 이유 역시 이러한 AI DNA에 있습니다. 수십 명의 CS 엔지니어가 필요한 티켓 응대, 서버 에러 분석을 백엔드 AI가 자동 수행(AI 자가치유 파이프라인)하므로 <strong>초기 인건비 확장을 강제로 억압</strong>하여 2년 차 흑자전환을 가속합니다.
<strong>③ 비선형적 스케일업:</strong> 4년 차 이후 글로벌 시장을 점령할 때는 매출의 20~30%를 B2B 마케팅(S&M)과 극소수의 하이엔드 SRE 인재 포섭에 쏟아붓습니다. 과거처럼 머릿수(Headcount)를 늘리는 선형적 팽창이 아니라, <strong>AI로 코어 개발비를 방어하고 확보된 잉여 자금을 시장 장악(GTM)에 올인</strong>하여 $4.5B 매출 규모에 최단기로 도달하는 폭발적 영업비용 펌핑을 계획했습니다.
</div>
</div>
</div>
</div>

<div class="ir-section">
<h2 class="ir-section-header">5. 상용화 로드맵 및 세부 자금 집행 계획 ($1.5M Seed)</h2>
<p style="font-size: 14px; margin-bottom: 24px; color: #c9d1d9; line-height: 1.6;">
Orbitron은 "1-Man AI Pair Programming" 체제를 구축함으로써 <strong>초기 R&D 인건비와 서버 하드웨어(CapEx) 구축 비용을 사실상 0원 수준으로 극단적 최소화</strong>했습니다. 
보통의 PaaS 스타트업들이 인건비에 쏟아붓는 수십억 원의 매몰 비용을 우리는 <strong>100% 'AWS 인프라 대량 선매입(원가 압축)'과 '글로벌 B2B 마케팅(GTM)'</strong>에만 집중 포화하여 압도적인 자본 효율성과 폭발적인 초기 성장을 증명합니다.
</p>

<h3 style="color: #58a6ff; font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid rgba(88,166,255,0.3); padding-bottom: 8px;">📊 Use of Funds (기형적 자금 배분 비율: 인건비 제로화)</h3>
<div class="fund-bar-container" style="margin-bottom: 32px;">
<div class="fund-bar-row">
<div class="fund-label">AWS 대규모 선도입(EDP) 및 CDN ($600K)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 40%; background: linear-gradient(90deg, #bd93f9, #9333ea);"></div></div>
<div class="fund-percent">40%</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">글로벌 GTM 및 B2B 마케팅 ($450K)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 30%; background: linear-gradient(90deg, #50fa7b, #10b981);"></div></div>
<div class="fund-percent">30%</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">결제망 통합 및 글로벌 보안 인증 ($300K)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 20%; background: linear-gradient(90deg, #ffb86c, #f59e0b);"></div></div>
<div class="fund-percent">20%</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">AI 에이전트 운용 및 코어 인프라 ($150K)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 10%; background: linear-gradient(90deg, #58a6ff, #3b82f6);"></div></div>
<div class="fund-percent">10%</div>
</div>
</div>

<h3 style="color: #ffb86c; font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,184,108,0.3); padding-bottom: 8px;">🚀 유료 서비스(Commercialization) 전환 상세 집행 계획</h3>
<div class="ir-grid" style="grid-template-columns: repeat(3, 1fr); gap: 16px;">
<div class="ir-card" style="padding: 16px; background: rgba(255,255,255,0.02);">
<h4 style="color: #ffb86c; font-size: 15px; margin-top: 0;">Phase 1: 결제망 및 컴플라이언스 (M1~M3) - <span style="color:#8b949e;">$300K 배정</span></h4>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.6;">
<li>글로벌/국내 결제(Stripe/Toss) 자동 빌링 아키텍처 및 미터링 대시보드 구축 ($150K)</li>
<li>엔터프라이즈 유치를 위한 ISMS, SOC2 Type 2 글로벌 보안 인증 선자문 및 실사 ($100K)</li>
<li>글로벌 이용약관 및 SLA(서비스 수준 계약) 법무법인 컴플라이언스 셋업 ($50K)</li>
</ul>
</div>

<div class="ir-card" style="padding: 16px; background: rgba(255,255,255,0.02);">
<h4 style="color: #bd93f9; font-size: 15px; margin-top: 0;">Phase 2: 인프라 원가 락인 및 코어 (M4~M6) - <span style="color:#8b949e;">$750K 배정</span></h4>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.6;">
<li>매출원가(COGS) 15% 진입을 위한 AWS EDP(예약 인스턴스) 대규모 선금형 계약 ($500K)</li>
<li>대용량 캐싱 및 DDoS 방어를 위한 Cloudflare Enterprise 무제한 전용망 구축 ($100K)</li>
<li>지속적 자가치유 파이프라인 유지를 위한 AI 에이전트 다각화 및 초거대 API 운용비 ($150K)</li>
</ul>
</div>

<div class="ir-card" style="padding: 16px; background: rgba(255,255,255,0.02);">
<h4 style="color: #50fa7b; font-size: 15px; margin-top: 0;">Phase 3: 집중 스케일업 및 GTM (M7~M12) - <span style="color:#8b949e;">$450K 배정</span></h4>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.6;">
<li>게임사, 금융권 등 VDI/PaaS 트래픽 보유 기업 타겟 B2B 퍼포먼스 마케팅 ($250K)</li>
<li>VIP 고객 전담 Customer Success (CS) 및 마이그레이션 기술 지원 에이전시 런칭 ($150K)</li>
<li>개발자 생태계 확장을 위한 글로벌 해커톤 스폰서십 및 컨퍼런스 주최 ($50K)</li>
</ul>
</div>
</div>
</div>

</div>
