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
<div class="ir-hero-subtitle">Next-Gen Enterprise Deployment Platform · Investor Relations (IR) Pitch Deck</div>
</div>
</div>

<div class="ir-section">
<h2 class="ir-section-header">1. Executive Summary</h2>
<p style="font-size: 18px; color: #c9d1d9; line-height: 1.8;">
Orbitron is a next-generation B2B PaaS (Platform as a Service) integrated with the Cloudflare Enterprise network.
Compared to legacy platforms (Vercel, Heroku), it provides an overwhelming <strong>Zero-Port security architecture</strong>,
<strong>AI Automated Diagnostics (RAG)</strong>, and <strong>3D rendering (Pixel Streaming)</strong> hosting capabilities,
innovating the infrastructure deployment trends of global enterprises.
</p>
</div>

<div class="ir-section">
<h2 class="ir-section-header">2. Problem & Solution</h2>
<div class="ir-grid">
<div class="ir-card" style="border-top: 3px solid #ff5555;">
<h3 style="color: #ff5555;">⚠️ Market Problems</h3>
<p>
<strong>Infrastructure Fragmentation:</strong> Legacy hosting (Cafe24, Gabia) lacks CI/CD automation, wasting massive developer hours on manual setups for modern framework integration.<br><br>
<strong>Quality & Scaling Limits:</strong> Legacy hosting servers crash during traffic spikes. If early-stage startups try to directly manage superior public clouds (IaaS), they face unaffordable specialized DevOps labor costs, massive traffic billing shock, and complex VPC security setups.<br><br>
<strong>Limits of Heavy Engine Deployment:</strong> Zero PaaS options currently supporting specialized high-performance environments like Unreal Engine / Unity WebGL.
</p>
</div>
<div class="ir-card" style="border-top: 3px solid #50fa7b;">
<h3 style="color: #50fa7b;">💡 Orbitron Solutions</h3>
<p>
<strong>Zero-Port Unified Network:</strong> Completely blocks inbound ports and provides a 1-click Zero-Trust environment built entirely on Cloudflare proxy tunneling.<br><br>
<strong>AI Deployment Diagnostics:</strong> Immediate Gemini/Claude Vision analysis on errors, providing alerts and remote control via Telegram.<br><br>
<strong>3D-Specialized Engine Hosting:</strong> Top-tier game publishing support through automated Gzip compression linking and GPU cluster mapping.
</p>
</div>
</div>
</div>

<div class="ir-section">
<h2 class="ir-section-header">3. Business Model & Pricing</h2>
<div class="ir-grid" style="grid-template-columns: repeat(4, 1fr);">
<div class="ir-card" style="padding: 16px;">
<h3 style="font-size:16px; color:#50fa7b;">Starter</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">Free<span style="font-size:12px; color:#8b949e;"> / metered</span></div>
<p style="font-size:13px;">Indie devs & side projects<br>Induces ecosystem lock-in</p>
</div>
<div class="ir-card" style="padding: 16px; border-color: rgba(88, 166, 255, 0.4);">
<h3 style="font-size:16px; color:#58a6ff;">Pro</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">₩19,000<span style="font-size:12px; color:#8b949e;">/mo</span></div>
<p style="font-size:13px;">Small teams (up to 10)<br>Auto deployment & AI diagnostics</p>
</div>
<div class="ir-card" style="padding: 16px; background: rgba(189, 147, 249, 0.1); border-color: rgba(189, 147, 249, 0.4);">
<h3 style="font-size:16px; color:#bd93f9;">Team</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">₩49,000<span style="font-size:12px; color:#8b949e;">/mo</span></div>
<p style="font-size:13px;">Growing teams (unlimited)<br>Priority GPU streaming allocation</p>
</div>
<div class="ir-card" style="padding: 16px;">
<h3 style="font-size:16px; color:#ffb86c;">Enterprise</h3>
<div style="font-size:24px; font-weight:800; color:#fff; margin-bottom:8px;">Custom</div>
<p style="font-size:13px;">Large orgs / Game studios<br>Dedicated GPU cluster networks</p>
</div>
</div>

<div style="margin-top:24px; padding:24px; background: rgba(80, 250, 123, 0.03); border: 1px solid rgba(80, 250, 123, 0.2); border-radius:12px; border-left:4px solid #50fa7b;">
<h4 style="margin-top:0; color:#e6edf3; font-size:18px; margin-bottom:12px;">📈 Core Business Logic: The Global Unicorn PaaS "Infrastructure Arbitrage + Software Value Creation" Model</h4>
<p style="font-size:14px; margin-bottom:24px; line-height:1.6; color:#c9d1d9;">
Orbitron perfectly mimics the <strong>[Wholesale Infrastructure Leasing + Retail S/W Automation Sales]</strong> revenue formula proven by multi-billion dollar startups like Vercel, Heroku, and Render. By completely ruling out proprietary IDC (Data Center) hardware that ties up massive initial capital, and instead layering our overwhelmingly superior <strong>"AI Self-healing & Deployment Pipeline (UX/DX)"</strong> tech atop the world's #1 AWS infrastructure (backend), we generate explosive added value.
</p>

<div class="ir-grid" style="grid-template-columns: repeat(2, 1fr); gap:16px;">
<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#58a6ff; font-size:15px; display:flex; align-items:center; gap:6px;"><span>📦</span> 1. Economies of Scale (Wholesale buying, Retail selling)</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
While a single customer must pay expensive On-Demand retail prices for AWS, Orbitron consolidates all client traffic into a single pool. By making large <strong>volume prepurchases via Reserved Instances and EDP partnerships</strong>, we preemptively cut base COGS by <strong>up to 70%</strong>, then resell at retail PaaS prices to capture a massive spread margin.
</p>
</div>

<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#bd93f9; font-size:15px; display:flex; align-items:center; gap:6px;"><span>🧑‍💻</span> 2. Replacing Labor Costs (S/W Premium Value Creation)</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
This isn't a simple commerce structure tacking profit onto cost. Orbitron's <strong>"1-Click Automation & Messenger AI Control"</strong> completely replaces the thousands of dollars in expert DevOps labor costs that arise from managing raw AWS directly. Customers receive the massive added value (DX) of essentially hiring an entire engineering team for ₩49,000/month, allowing us to retain immense profit margins comparable to pure software (SaaS) companies.
</p>
</div>

<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#ffb86c; font-size:15px; display:flex; align-items:center; gap:6px;"><span>🛡️</span> 3. Total Elimination of Hardware CapEx Risks</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
Purchasing bare-metal servers vaporizes millions in upfront capital (CapEx) and introduces hardware deprecation risks. Orbitron pushes all hardware risks onto AWS, establishing a <strong>strict OpEx (Operating Expense) model where infrastructure is elastically scaled solely in proportion to generated revenue (traffic volume)</strong>, maximizing financial survivability.
</p>
</div>

<div style="background:rgba(255,255,255,0.03); padding:18px; border-radius:8px;">
<h5 style="margin:0 0 10px 0; color:#50fa7b; font-size:15px; display:flex; align-items:center; gap:6px;"><span>🌐</span> 4. Suppressing Bandwidth Costs via Cloudflare Frontlines</h5>
<p style="font-size:13px; color:#8b949e; line-height:1.6; margin:0;">
The biggest commercial blind spot in AWS IaaS is the infamous "outbound traffic billing shock". We deployed the <strong>relatively inexpensive, often unmetered Cloudflare Enterprise Global Edge (CDN) network as a shield in front of AWS</strong>. By offsetting the vast majority of static/image traffic via frontline free caching, we eliminate the primary enemy of our profit margins.
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

<p style="font-size:13px; color:#8b949e; margin-top:6px;">Advance adoption of Global Cloud (AWS) enterprise infrastructure and advanced AI self-healing engines</p>
<div class="ir-table-wrapper">
<table class="ir-table">
<thead>
<tr>
<th>(Units: Subscribers / $10K USD)</th>
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
<td>Active Projects (Apps/Games)</td>
<td>1,500</td>
<td>12,000</td>
<td>45,000</td>
<td>180,000</td>
<td>650,000</td>
<td>2,000,000+</td>
</tr>
<tr class="highlight-row">
<td>ARR (Annual Recurring Revenue)</td>
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
<td>COGS (AWS Infra & CDN)</td>
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
<td>Total OPEX (Operating Expenses)</td>
<td>250</td>
<td>800</td>
<td>3,800</td>
<td>18,500</td>
<td>42,000</td>
<td>110,000</td>
</tr>
<tr class="highlight-row" style="color:#50fa7b;">
<td style="color:#50fa7b;">EBITDA</td>
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
<h4 style="margin-top:0; color:#e6edf3; font-size:16px;">📈 Investment Cash Flow and J-Curve Dynamics</h4>
<p style="font-size:14px; margin-bottom:0;">
Through 100% unmanned operations powered by AI, the framework maximizes efficiency to <strong>achieve an early BEP (Break-Even Point) in Year 2 (2027) post-launch</strong>. <strong>From 2029, influxes from mid-to-large enterprises will explode the pipeline on a macro scale (Turnaround)</strong>. Driven by infrastructure economies of scale and EDP purchase privileges, <strong>the gross margin will reach an overwhelming SaaS-record 84% by 2035, with a 60% operating margin</strong>.
</p>
</div>

<div style="margin-top:24px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top:24px;">
<h4 style="margin-top:0; color:#e6edf3; font-size:17px; margin-bottom:16px;">📝 Financial Modeling Methodology</h4>
<div class="ir-grid" style="grid-template-columns: repeat(1, 1fr); gap:12px;">
<div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:8px;">
<strong style="color:#50fa7b;">1. ARR (Revenue) Estimation:</strong> Years 1-3 were conservatively calculated using a Product-Led Growth (PLG) model where amateurs/startups entering via the Free (Starter) plan gradually convert to paid plans (Pro/Team). However, hitting Year 5 (2030), <strong>Enterprise custom contracts (generating 100x revenue volume per contract)</strong> for massive VDI/PaaS traffic from game publishers and metaverse agencies will accelerate, tracing an exponential J-Curve.
</div>
<div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:8px;">
<strong style="color:#ffb86c;">2. COGS (Cost of Goods Sold) Defense Logic:</strong> In the very beginning, borrowing small amounts of on-demand AWS resources sets the COGS ratio high at 60% (40% margin). But from Year 3 onward as the user pool enlarges, we enter top-tier Cloudflare CDN flat-rate zones eliminating outbound bandwidth shocks, while 72% discounts from AWS Reserve Instances take effect, enacting a margin defense mechanism that <strong>bizarrely compresses COGS to just 15%</strong> by Year 10.
</div>
<div style="background:rgba(255,255,255,0.02); padding:16px; border-radius:8px;">
<strong style="color:#bd93f9;">3. OPEX Allocation & Reduction Principles (The AI-Native Advantage):</strong>
<strong>① Zero Sunk Costs:</strong> The proprietary R&D labor costs leading up to Orbitron's imminent commercial launch (V1.0) virtually converge to <strong>"Zero Dollars"</strong>. This is thanks to our <strong>"AI-Native DNA"</strong>, where enterprise-grade infrastructure was forged purely via a 1-Man Founder and top-tier AI Agent Pair Programming.
<strong>② Inhibiting Initial Fixed Costs:</strong> The reason we stifled extreme early OPEX under 30% in Years 1-3 is also due to this AI DNA. Because our backend AI automatically handles ticket resolutions and server error diagnostics that usually require dozens of CS engineers (AI Self-Healing pipelines), we <strong>forcibly suppress initial payroll inflation</strong> to rapidly achieve profitability in Year 2.
<strong>③ Non-linear Scale-up:</strong> When conquering the global market from Year 4, we will blast 20~30% of total revenue straight into B2B marketing (S&M) and poaching an elite minority of High-End SRE talent. Instead of linearly swelling headcount as in the past, we plan an explosive OPEX pumping strategy: <strong>defending core dev costs with AI, and going all-in on market capture (GTM) with the surplus capital</strong>, reaching a $4.5B revenue valuation in record time.
</div>
</div>
</div>
</div>

<div class="ir-section">
<h2 class="ir-section-header">5. Commercialization Roadmap & Seed Fund Allocation ($1.5M Seed)</h2>
<p style="font-size: 14px; margin-bottom: 24px; color: #c9d1d9; line-height: 1.6;">
By establishing the "1-Man AI Pair Programming" system, Orbitron has <strong>minimized initial R&D labor costs and server hardware (CapEx) setup costs to near zero</strong>. 
The millions in sunk costs that ordinary PaaS startups throw into payroll, we will focus 100% on a concentrated bombardment of <strong>"Wholesale AWS Infra Purchases (Cost Compress)" and "Global B2B Marketing (GTM)"</strong>, proving overwhelming capital efficiency and explosive early growth.
</p>

<h3 style="color: #58a6ff; font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid rgba(88,166,255,0.3); padding-bottom: 8px;">📊 Use of Funds (Asymmetric Capital Allocation: Zero Headcount Inflation)</h3>
<div class="fund-bar-container" style="margin-bottom: 32px;">
<div class="fund-bar-row">
<div class="fund-label">Massive AWS EDP & CDNs ($600K)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 40%; background: linear-gradient(90deg, #bd93f9, #9333ea);"></div></div>
<div class="fund-percent">40%</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">Global GTM & B2B Marketing ($450K)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 30%; background: linear-gradient(90deg, #50fa7b, #10b981);"></div></div>
<div class="fund-percent">30%</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">Payment Networks & Global Security Certs ($300K)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 20%; background: linear-gradient(90deg, #ffb86c, #f59e0b);"></div></div>
<div class="fund-percent">20%</div>
</div>
<div class="fund-bar-row">
<div class="fund-label">AI Agent Ops & Core Infrastructure ($150K)</div>
<div class="fund-bar-bg"><div class="fund-bar-fill" style="width: 10%; background: linear-gradient(90deg, #58a6ff, #3b82f6);"></div></div>
<div class="fund-percent">10%</div>
</div>
</div>

<h3 style="color: #ffb86c; font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid rgba(255,184,108,0.3); padding-bottom: 8px;">🚀 Commercialization Phase Execution Plan</h3>
<div class="ir-grid" style="grid-template-columns: repeat(3, 1fr); gap: 16px;">
<div class="ir-card" style="padding: 16px; background: rgba(255,255,255,0.02);">
<h4 style="color: #ffb86c; font-size: 15px; margin-top: 0;">Phase 1: Payment Networks & Compliance (M1~M3) - <span style="color:#8b949e;">$300K Allocated</span></h4>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.6;">
<li>Global/Domestic automated Stripe/Toss billing architecture and metering dashboard setup ($150K)</li>
<li>Pre-consultation and due diligence for ISMS, SOC2 Type 2 global security certifications targeting enterprise clients ($100K)</li>
<li>Global Terms of Service and SLA (Service Level Agreement) law firm compliance setup ($50K)</li>
</ul>
</div>

<div class="ir-card" style="padding: 16px; background: rgba(255,255,255,0.02);">
<h4 style="color: #bd93f9; font-size: 15px; margin-top: 0;">Phase 2: COGS Lock-in & Core (M4~M6) - <span style="color:#8b949e;">$750K Allocated</span></h4>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.6;">
<li>Massive AWS EDP prepay contracts targeting a 15% COGS reduction milestone ($500K)</li>
<li>Building unlimited dedicated Cloudflare Enterprise networks for massive caching and DDoS protection ($100K)</li>
<li>AI agent diversification and mega-API operational costs for sustaining the continuous self-healing pipeline ($150K)</li>
</ul>
</div>

<div class="ir-card" style="padding: 16px; background: rgba(255,255,255,0.02);">
<h4 style="color: #50fa7b; font-size: 15px; margin-top: 0;">Phase 3: Hyper Scale-up & GTM (M7~M12) - <span style="color:#8b949e;">$450K Allocated</span></h4>
<ul style="font-size: 13px; padding-left: 16px; color: #8b949e; line-height: 1.6;">
<li>B2B performance marketing targeting organizations with VDI/PaaS traffic like Game Studios and Financial Sectors ($250K)</li>
<li>Customer Success (CS) and migration technical support agency launches catering to VIP accounts ($150K)</li>
<li>Global hackathon sponsorships and hosting conferences to expand developer ecosystems ($50K)</li>
</ul>
</div>
</div>
</div>

</div>
