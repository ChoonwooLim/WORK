<style>
.patent-doc { font-family: 'Inter', 'Noto Sans KR', sans-serif; color: #e6edf3; max-width: 900px; margin: 0 auto; line-height: 1.9; }
.patent-header { text-align: center; padding: 40px 20px; margin-bottom: 40px; background: linear-gradient(135deg, rgba(189,147,249,0.08), rgba(88,166,255,0.08)); border-radius: 16px; border: 1px solid rgba(189,147,249,0.15); }
.patent-header h1 { font-size: 26px; margin: 0 0 8px; color: #e6edf3; }
.patent-header .sub { font-size: 14px; color: #8b949e; }
.patent-badge { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; margin: 4px 2px; }
.patent-section { margin-bottom: 48px; }
.patent-section h2 { font-size: 22px; font-weight: 700; color: #bd93f9; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid rgba(189,147,249,0.2); }
.patent-section h3 { font-size: 17px; font-weight: 600; color: #58a6ff; margin: 24px 0 12px; }
.patent-section h4 { font-size: 15px; font-weight: 600; color: #c9d1d9; margin: 16px 0 8px; }
.patent-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 20px; margin: 16px 0; }
.patent-box.highlight { border-color: rgba(189,147,249,0.3); background: rgba(189,147,249,0.04); }
.patent-box.claim { border-left: 4px solid #58a6ff; background: rgba(88,166,255,0.04); }
.patent-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 14px; }
.patent-table th { background: rgba(189,147,249,0.08); padding: 10px 14px; text-align: left; font-weight: 600; color: #c9d1d9; border-bottom: 2px solid rgba(189,147,249,0.2); }
.patent-table td { padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); color: #8b949e; }
.patent-table tr:hover td { background: rgba(255,255,255,0.02); }
.patent-flow { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.patent-flow-step { background: rgba(88,166,255,0.08); border: 1px solid rgba(88,166,255,0.2); border-radius: 8px; padding: 8px 14px; font-size: 13px; color: #58a6ff; font-weight: 600; }
.patent-flow-arrow { color: #484f58; font-size: 18px; }
.patent-diagram { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 24px; margin: 16px 0; font-family: monospace; font-size: 13px; color: #8b949e; line-height: 1.8; overflow-x: auto; }
</style>

<div class="patent-doc">

<div class="patent-header">
<div style="font-size: 14px; color: #bd93f9; font-weight: 600; margin-bottom: 8px;">대한민국 특허출원 예비 명세서</div>
<h1>Orbitron 핵심 기술 특허 출원서</h1>
<div class="sub">Preliminary Patent Application Specification (6건)</div>
<div style="margin-top: 16px;">
<span class="patent-badge" style="background: rgba(189,147,249,0.15); color: #bd93f9;">문서 버전 1.0</span>
<span class="patent-badge" style="background: rgba(80,250,123,0.15); color: #50fa7b;">작성일: 2026-04-03</span>
<span class="patent-badge" style="background: rgba(88,166,255,0.15); color: #58a6ff;">출원인: (주)오비트론</span>
</div>
</div>

<!-- Overview -->
<div class="patent-section">
<h2>출원 총괄표</h2>

<table class="patent-table">
<thead>
<tr><th>No.</th><th>발명의 명칭</th><th>분류</th><th>우선순위</th><th>출원 구분</th></tr>
</thead>
<tbody>
<tr>
<td style="color:#bd93f9; font-weight:700;">제1호</td>
<td style="color:#e6edf3;">인공지능 기반 소프트웨어 배포 오류 자동 분석 및 코드 수정 시스템</td>
<td>AI / DevOps</td>
<td><span class="patent-badge" style="background:rgba(248,81,73,0.15); color:#f85149;">최우선</span></td>
<td>발명특허</td>
</tr>
<tr>
<td style="color:#bd93f9; font-weight:700;">제2호</td>
<td style="color:#e6edf3;">GPU 슬롯 풀 기반 게임 스트리밍 세션 동적 할당 및 관리 방법</td>
<td>GPU / 게임</td>
<td><span class="patent-badge" style="background:rgba(248,81,73,0.15); color:#f85149;">최우선</span></td>
<td>발명특허</td>
</tr>
<tr>
<td style="color:#bd93f9; font-weight:700;">제3호</td>
<td style="color:#e6edf3;">소스 코드 구조 분석 기반 컨테이너 프로젝트 타입 자동 감지 및 빌드 파이프라인 자동 생성 방법</td>
<td>빌드 / 배포</td>
<td><span class="patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c;">높음</span></td>
<td>발명특허</td>
</tr>
<tr>
<td style="color:#bd93f9; font-weight:700;">제4호</td>
<td style="color:#e6edf3;">에러 패턴 유사도 매칭 기반 자가학습 지식베이스 시스템</td>
<td>AI / ML</td>
<td><span class="patent-badge" style="background:rgba(255,184,108,0.15); color:#ffb86c;">높음</span></td>
<td>발명특허</td>
</tr>
<tr>
<td style="color:#bd93f9; font-weight:700;">제5호</td>
<td style="color:#e6edf3;">제로포트 터널 기반 멀티테넌트 웹 애플리케이션 자동 배포 및 라우팅 방법</td>
<td>네트워크 / 보안</td>
<td><span class="patent-badge" style="background:rgba(88,166,255,0.15); color:#58a6ff;">보통</span></td>
<td>발명특허</td>
</tr>
<tr>
<td style="color:#bd93f9; font-weight:700;">제6호</td>
<td style="color:#e6edf3;">웹 기반 코드 에디터에서의 대규모 언어 모델 연동 인라인 코드 수정 시스템</td>
<td>AI / IDE</td>
<td><span class="patent-badge" style="background:rgba(248,81,73,0.15); color:#f85149;">최우선</span></td>
<td>발명특허</td>
</tr>
</tbody>
</table>
</div>

<!-- Patent 1 -->
<div class="patent-section">
<h2>제1호 발명 — AI 기반 배포 오류 자동 분석 및 코드 수정 시스템</h2>

<h3>1. 발명의 명칭</h3>
<div class="patent-box highlight">
<strong style="color:#e6edf3; font-size:16px;">인공지능 기반 소프트웨어 배포 오류 자동 분석 및 코드 수정 시스템과 그 방법</strong>
<p style="margin-top:8px; font-size:13px;">System and Method for Automatic Analysis and Code Correction of Software Deployment Errors Based on Artificial Intelligence</p>
</div>

<h3>2. 기술 분야</h3>
<p>본 발명은 소프트웨어 개발 및 배포(CI/CD) 분야에 관한 것으로, 특히 컨테이너 기반 배포 과정에서 발생하는 빌드 오류 및 런타임 오류를 대규모 언어 모델(LLM)을 활용하여 자동으로 분석하고, 에러 지식베이스와의 유사도 매칭을 통해 근본 원인을 진단하며, 코드 수정 패치를 자동 생성하여 적용하는 시스템 및 방법에 관한 것이다.</p>

<h3>3. 배경 기술 (종래 기술의 문제점)</h3>
<p>종래의 CI/CD 도구(Jenkins, GitHub Actions, GitLab CI 등)는 배포 과정에서 오류가 발생하면 오류 로그를 표시하는 것에 그치며, 오류의 근본 원인을 분석하거나 수정안을 제안하는 기능을 제공하지 않는다. 개발자는 로그를 수동으로 분석하고, 경험에 기반하여 해결책을 찾아야 하며, 이 과정에서 상당한 시간과 노력이 소요된다.</p>
<p>기존 AI 코드 어시스턴트(GitHub Copilot, Amazon CodeWhisperer 등)는 코드 작성 보조에 특화되어 있으며, 배포 파이프라인의 단계별 컨텍스트(빌드 환경, 런타임 설정, 컨테이너 구성 등)를 인식하지 못한다. 따라서 배포 오류에 대한 정확한 진단이 불가능하다.</p>

<h3>4. 발명이 해결하고자 하는 과제</h3>
<ul>
<li>배포 오류 로그에서 핵심 오류 정보를 자동으로 추출하고 구조화하는 기술</li>
<li>복수의 LLM을 활용한 폴백 라우팅 기반 오류 분석 기술</li>
<li>과거 해결 사례를 기반으로 한 RAG(Retrieval-Augmented Generation) 지식베이스 연동</li>
<li>분석 결과를 기반으로 실행 가능한 코드 수정 패치를 자동 생성하고 적용하는 기술</li>
</ul>

<h3>5. 발명의 구성 및 작용</h3>

<h4>5.1 시스템 구성도</h4>
<div class="patent-diagram">
┌─────────────────────────────────────────────────────────┐
│                    배포 파이프라인                          │
│  [Clone] → [Build] → [Container] → [Nginx] → [Tunnel]  │
└──────────┬──────────────────────────────────────────────┘
           │ 오류 발생 시
           ▼
┌──────────────────────┐
│  오류 로그 수집 모듈   │ ← 배포 로그 전체에서 오류 컨텍스트 자동 추출
│  (50줄 전후 추출)      │    ERROR, FATAL, Exception 패턴 감지
└──────────┬───────────┘
           ▼
┌──────────────────────┐     ┌─────────────────────────┐
│  에러 지식베이스(RAG)  │────▶│ 유사 오류 검색            │
│  (PostgreSQL 저장)    │     │ 텍스트 유사도 매칭         │
│                      │     │ success_count 가중 정렬   │
└──────────────────────┘     └──────────┬──────────────┘
                                        │
           ┌────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│          듀얼 LLM 분석 엔진           │
│                                      │
│  ┌──────────┐    ┌──────────────┐   │
│  │ Claude   │──▶│ 30초 타임아웃  │   │
│  │ (1차)    │    │  실패 시 ──▶  │   │
│  └──────────┘    └──────┬───────┘   │
│                         ▼            │
│                  ┌──────────┐       │
│                  │ Gemini   │       │
│                  │ (폴백)   │       │
│                  └──────────┘       │
└──────────┬───────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│        코드 패치 생성 모듈             │
│                                      │
│  입력: 오류 분석 + 소스 코드 (25파일)  │
│  출력: JSON 패치 배열                 │
│  { file, original, modified,         │
│    explanation }                     │
└──────────┬───────────────────────────┘
           ▼
┌──────────────────────┐     ┌─────────────────┐
│  패치 적용 모듈       │────▶│ 자동 재배포      │
│  (파일 수정 + 검증)   │     │ (배포 파이프라인)  │
└──────────┬───────────┘     └─────────────────┘
           ▼
┌──────────────────────┐
│  학습 피드백 모듈      │ ← 성공 시 knowledge DB에 저장
│  (success_count ++)   │    실패 시 패턴 갱신
└──────────────────────┘
</div>

<h4>5.2 핵심 처리 흐름</h4>
<div class="patent-flow">
<div class="patent-flow-step">오류 감지</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">로그 50줄 추출</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">RAG 유사 검색</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">LLM 분석 (듀얼)</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">JSON 패치 생성</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">파일 수정</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">재배포</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">학습 저장</div>
</div>

<h3>6. 특허청구범위 (Claims)</h3>

<div class="patent-box claim">
<h4>청구항 1 (독립항)</h4>
<p>소프트웨어 배포 시스템에서 발생하는 오류를 자동으로 분석하고 수정하는 방법에 있어서,<br>
(a) 배포 파이프라인의 실행 로그에서 오류 패턴(ERROR, FATAL, Exception, exit code)을 감지하고, 해당 오류 발생 지점 전후 소정의 줄 수(바람직하게는 50줄)를 자동으로 추출하는 단계;<br>
(b) 추출된 오류 로그를 에러 지식베이스에 저장된 과거 오류 사례와 텍스트 유사도 매칭을 수행하여, 성공 해결 횟수(success_count)로 가중 정렬된 유사 사례를 검색하는 단계;<br>
(c) 상기 오류 로그, 유사 사례 검색 결과, 및 프로젝트 소스 코드 컨텍스트를 제1 대규모 언어 모델(LLM)에 입력하여 오류의 근본 원인을 분석하되, 상기 제1 LLM의 응답이 소정 시간(바람직하게는 30초) 내에 수신되지 않는 경우 제2 LLM으로 자동 전환하는 듀얼 라우팅 단계;<br>
(d) 상기 LLM의 분석 결과를 기반으로, 수정이 필요한 파일의 경로, 원본 코드 조각, 수정된 코드 조각, 및 변경 사유를 포함하는 구조화된 패치 데이터를 자동 생성하는 단계;<br>
(e) 생성된 패치를 프로젝트 소스 파일에 자동 적용하고, 배포 파이프라인을 재실행하는 단계; 및<br>
(f) 상기 패치 적용 결과의 성공 여부를 에러 지식베이스에 피드백하여 지식베이스의 신뢰도를 갱신하는 자가학습 단계;를 포함하는 것을 특징으로 하는 인공지능 기반 소프트웨어 배포 오류 자동 분석 및 코드 수정 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 2 (종속항)</h4>
<p>제1항에 있어서, 상기 (c) 단계의 듀얼 라우팅은, 제1 LLM으로서 Anthropic Claude 모델을 사용하고, 제2 LLM으로서 Google Gemini 모델을 사용하며, 제1 LLM의 타임아웃, 오류 응답, 또는 서비스 불가 상태 시 자동으로 제2 LLM으로 폴백하되, 폴백 시 사용자에게 모델 전환 사실을 통지하는 것을 특징으로 하는 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 3 (종속항)</h4>
<p>제1항에 있어서, 상기 프로젝트 소스 코드 컨텍스트는, 프로젝트 디렉토리에서 우선순위 파일(Dockerfile, package.json, requirements.txt 등)을 먼저 수집하고, 이후 소스 디렉토리를 소정의 깊이(바람직하게는 4단계)까지 탐색하여 최대 25개의 소스 파일을 자동 수집하되, 각 파일은 최대 200줄로 절단하여 LLM의 컨텍스트 윈도우 제한 내에서 최대한의 정보를 제공하는 것을 특징으로 하는 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 4 (종속항)</h4>
<p>제1항에 있어서, 상기 (d) 단계의 구조화된 패치 데이터는 JSON 형식으로 생성되며, 각 패치는 대상 파일의 상대 경로(file), 수정 전 코드 텍스트(original), 수정 후 코드 텍스트(modified), 및 변경 사유(explanation) 필드를 포함하고, 상기 (e) 단계에서는 원본 코드 텍스트의 정확한 문자열 매칭을 통해 수정 위치를 특정하는 것을 특징으로 하는 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 5 (시스템 독립항)</h4>
<p>소프트웨어 배포 오류를 자동으로 분석하고 수정하는 시스템에 있어서,<br>
배포 파이프라인 실행 로그에서 오류 정보를 자동 추출하는 로그 수집 모듈;<br>
과거 오류 해결 사례를 저장하고 텍스트 유사도 기반으로 검색하는 에러 지식베이스 모듈;<br>
복수의 대규모 언어 모델 간 자동 폴백 라우팅을 수행하는 듀얼 LLM 분석 모듈;<br>
LLM 분석 결과를 기반으로 구조화된 코드 패치를 생성하는 패치 생성 모듈;<br>
생성된 패치를 소스 파일에 자동 적용하는 패치 적용 모듈; 및<br>
패치 결과를 에러 지식베이스에 피드백하는 자가학습 모듈;을 포함하는 것을 특징으로 하는 인공지능 기반 소프트웨어 배포 오류 자동 분석 및 코드 수정 시스템.</p>
</div>

<h3>7. 선행 기술 대비 진보성</h3>
<table class="patent-table">
<thead>
<tr><th>비교 항목</th><th>종래 기술 (Jenkins, GitHub Actions 등)</th><th>본 발명 (Orbitron)</th></tr>
</thead>
<tbody>
<tr><td>오류 분석</td><td>로그 표시만 제공</td><td style="color:#50fa7b;">LLM 기반 근본 원인 자동 진단</td></tr>
<tr><td>수정 제안</td><td>없음</td><td style="color:#50fa7b;">JSON 패치 자동 생성 + 적용</td></tr>
<tr><td>지식베이스</td><td>없음</td><td style="color:#50fa7b;">RAG 기반 유사 오류 검색 + 자가학습</td></tr>
<tr><td>LLM 안정성</td><td>해당 없음</td><td style="color:#50fa7b;">듀얼 LLM 폴백 라우팅</td></tr>
<tr><td>자동 복구</td><td>없음</td><td style="color:#50fa7b;">패치 적용 + 자동 재배포 + 피드백 루프</td></tr>
</tbody>
</table>
</div>

<!-- Patent 2 -->
<div class="patent-section">
<h2>제2호 발명 — GPU 슬롯 풀 기반 게임 스트리밍 세션 동적 할당 방법</h2>

<h3>1. 발명의 명칭</h3>
<div class="patent-box highlight">
<strong style="color:#e6edf3; font-size:16px;">GPU 슬롯 풀 기반 게임 스트리밍 세션 동적 할당 및 관리 방법과 그 시스템</strong>
<p style="margin-top:8px; font-size:13px;">Method and System for Dynamic Allocation and Management of Game Streaming Sessions Based on GPU Slot Pool</p>
</div>

<h3>2. 기술 분야</h3>
<p>본 발명은 클라우드 게임 스트리밍 분야에 관한 것으로, 특히 복수의 GPU 디바이스에 대해 슬롯 풀을 구성하고, 게임 스트리밍 세션 요청 시 가용 슬롯을 동적으로 할당하며, 좀비 컨테이너 자동 감지 및 제거, 세션 시간 제한을 통해 GPU 리소스를 공정하게 분배하는 방법에 관한 것이다.</p>

<h3>3. 배경 기술</h3>
<p>기존 클라우드 게임 서비스(AWS GameLift, NVIDIA GeForce NOW 등)는 전용 인프라에서 운영되며, 일반 PaaS와 통합되지 않는다. 또한 GPU 리소스의 동적 할당이 복잡하고, 개별 게임 엔진(Unreal, Unity) 특화 배포를 자동화하지 못한다.</p>

<h3>4. 발명의 구성</h3>
<div class="patent-diagram">
┌──────────────────────────────────────────┐
│             GPU 슬롯 풀 관리자            │
│                                          │
│  GPU 0: [슬롯0:포트8888] [슬롯2:포트8890] [슬롯4:포트8892] │
│  GPU 1: [슬롯1:포트8889] [슬롯3:포트8891] [슬롯5:포트8893] │
│                                          │
│  상태: idle / occupied / zombie           │
└──────────┬───────────────────────────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌────────┐  ┌──────────────┐
│ 세션   │  │ 좀비 컨테이너  │
│ 할당기 │  │ 감시자 (60초)  │
└────┬───┘  └──────┬───────┘
     │              │
     ▼              ▼
┌────────┐  ┌──────────────┐
│ Docker │  │ 자동 종료     │
│ 컨테이너│  │ (1시간 제한)  │
│ 생성   │  │              │
└────────┘  └──────────────┘
</div>

<h3>5. 특허청구범위</h3>
<div class="patent-box claim">
<h4>청구항 1 (독립항)</h4>
<p>복수의 GPU 디바이스를 이용한 게임 스트리밍 세션 관리 방법에 있어서,<br>
(a) 복수의 GPU 디바이스 각각에 대해 소정 개수의 슬롯을 할당하여 슬롯 풀을 구성하되, 각 슬롯은 고유한 네트워크 포트와 GPU 디바이스 인덱스를 매핑하는 단계;<br>
(b) 게임 스트리밍 세션 요청 수신 시, 상기 슬롯 풀에서 유휴(idle) 상태인 슬롯을 검색하여, GPU 디바이스 간 로드를 분산하도록 슬롯을 동적으로 할당하는 단계;<br>
(c) 할당된 슬롯의 GPU 디바이스 인덱스를 지정하여 Docker 컨테이너를 생성하고 게임 스트리밍을 시작하는 단계;<br>
(d) 소정의 주기(바람직하게는 60초)로 전체 슬롯을 순회하며, 컨테이너가 비정상 종료되었으나 슬롯이 점유 상태로 남아있는 좀비 상태를 감지하고 자동으로 정리하는 단계; 및<br>
(e) 각 세션에 대해 최대 허용 시간(바람직하게는 1시간)을 설정하고, 시간 초과 시 세션을 자동 종료하여 슬롯을 해제하는 단계;를 포함하는 것을 특징으로 하는 GPU 슬롯 풀 기반 게임 스트리밍 세션 동적 할당 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 2 (종속항)</h4>
<p>제1항에 있어서, 상기 (b) 단계의 로드 분산은, 복수의 GPU 디바이스에 슬롯을 교차 배치(interleave)하여, 인접한 슬롯 번호가 서로 다른 GPU 디바이스에 할당되도록 구성하는 것을 특징으로 하는 방법.</p>
</div>
</div>

<!-- Patent 3 -->
<div class="patent-section">
<h2>제3호 발명 — 컨테이너 프로젝트 타입 자동 감지 및 빌드 파이프라인 생성 방법</h2>

<h3>1. 발명의 명칭</h3>
<div class="patent-box highlight">
<strong style="color:#e6edf3; font-size:16px;">소스 코드 구조 분석 기반 컨테이너 프로젝트 타입 자동 감지 및 최적화된 빌드 파이프라인 자동 생성 방법</strong>
</div>

<h3>2. 발명의 구성</h3>
<div class="patent-flow">
<div class="patent-flow-step">소스 업로드</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">파일 구조 스캔</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">패턴 매칭</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">타입 결정</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">Dockerfile 생성</div><span class="patent-flow-arrow">→</span>
<div class="patent-flow-step">멀티스테이지 빌드</div>
</div>

<h4>감지 가능 프로젝트 타입 (10종+)</h4>
<table class="patent-table">
<thead><tr><th>타입</th><th>감지 패턴</th><th>자동 생성 결과</th></tr></thead>
<tbody>
<tr><td>Node.js</td><td>package.json 존재</td><td>Node Alpine + npm install + npm start</td></tr>
<tr><td>Next.js</td><td>next.config.js/mjs 존재</td><td>Node + next build + next start (standalone)</td></tr>
<tr><td>Python</td><td>requirements.txt 또는 pyproject.toml</td><td>Python Slim + pip install + gunicorn/uvicorn</td></tr>
<tr><td>정적 사이트</td><td>index.html만 존재 (서버 파일 없음)</td><td>Nginx Alpine + 정적 서빙</td></tr>
<tr><td>풀스택</td><td>frontend/ + backend/ 디렉토리</td><td>멀티스테이지 (빌드 + 서빙)</td></tr>
<tr><td>Docker Compose</td><td>docker-compose.yml 존재</td><td>compose pull + build + up</td></tr>
<tr><td>PostgreSQL</td><td>type: db_postgres</td><td>PostgreSQL 공식 이미지 + 볼륨</td></tr>
<tr><td>Redis</td><td>type: db_redis</td><td>Redis 공식 이미지 + 영속화</td></tr>
<tr><td>Pixel Streaming</td><td>type: pixel_streaming</td><td>GPU Docker + NVENC + 포트 매핑</td></tr>
<tr><td>Unity WebGL</td><td>type: unity_webgl</td><td>Nginx + gzip 압축 서빙</td></tr>
</tbody>
</table>

<h3>3. 특허청구범위</h3>
<div class="patent-box claim">
<h4>청구항 1 (독립항)</h4>
<p>소스 코드 기반의 컨테이너 프로젝트 자동 감지 및 빌드 방법에 있어서,<br>
(a) 프로젝트 소스 코드의 루트 디렉토리에서 패키지 관리자 파일(package.json, requirements.txt, pyproject.toml), 프레임워크 설정 파일(next.config.js, vite.config.js 등), 및 디렉토리 구조를 스캔하는 단계;<br>
(b) 스캔 결과를 소정의 우선순위 규칙에 따라 매칭하여, 10종 이상의 프로젝트 타입(Node.js, Next.js, Python, 정적 사이트, 풀스택, Docker Compose, PostgreSQL, Redis, Pixel Streaming, Unity WebGL) 중 하나로 자동 분류하는 단계;<br>
(c) 분류된 프로젝트 타입에 최적화된 멀티스테이지 Dockerfile을 자동 생성하되, 빌드 캐시 재활용을 위한 레이어 분리, 런타임 최소화를 위한 다단계 빌드, 프로젝트별 시작 명령어 자동 설정을 포함하는 단계; 및<br>
(d) 생성된 Dockerfile을 사용하여 컨테이너 이미지를 빌드하고 배포 파이프라인을 실행하는 단계;를 포함하는 것을 특징으로 하는 방법.</p>
</div>
</div>

<!-- Patent 4 -->
<div class="patent-section">
<h2>제4호 발명 — 에러 패턴 유사도 매칭 기반 자가학습 지식베이스</h2>

<h3>1. 발명의 명칭</h3>
<div class="patent-box highlight">
<strong style="color:#e6edf3; font-size:16px;">소프트웨어 오류 패턴의 텍스트 유사도 매칭 및 성공률 기반 자가학습 지식베이스 시스템</strong>
</div>

<h3>2. 발명의 구성</h3>
<div class="patent-diagram">
오류 발생 → [오류 메시지 추출] → [지식베이스 검색]
                                      │
                           ┌──────────┴──────────┐
                           │  유사 사례 존재?      │
                           ├── YES ──────────────┤
                           │  success_count 가중   │
                           │  정렬하여 상위 N개 반환 │
                           ├── NO ───────────────┤
                           │  LLM 분석 후         │
                           │  새 지식 항목 생성     │
                           └─────────────────────┘
                                      │
                              [해결 시도]
                                      │
                           ┌──────────┴──────────┐
                           │  성공?              │
                           ├── YES: success_count++ ──┤
                           ├── NO:  패턴 갱신/보완   ──┤
                           └─────────────────────────┘
</div>

<h3>3. 특허청구범위</h3>
<div class="patent-box claim">
<h4>청구항 1 (독립항)</h4>
<p>소프트웨어 오류 해결 지식을 자동으로 축적하고 활용하는 자가학습 시스템에 있어서,<br>
(a) 오류 패턴(error_pattern), 오류 메시지(error_message), 근본 원인(root_cause), 해결 방법(solution), 코드 패치(patches), 프로젝트 타입(project_type), 및 성공 횟수(success_count)를 포함하는 구조화된 지식 항목을 데이터베이스에 저장하는 지식 저장 모듈;<br>
(b) 새로운 오류 발생 시, 오류 메시지를 기존 지식 항목의 오류 패턴과 텍스트 유사도 매칭을 수행하여 유사 사례를 검색하되, 성공 횟수(success_count)를 가중치로 적용하여 신뢰도 높은 순으로 정렬하는 유사도 검색 모듈;<br>
(c) 검색된 유사 사례를 LLM의 프롬프트에 참조 정보로 주입하여 오류 분석의 정확도를 향상시키는 RAG(Retrieval-Augmented Generation) 모듈; 및<br>
(d) LLM의 분석 결과에 기반한 수정이 성공적으로 적용된 경우 해당 지식 항목의 성공 횟수를 증가시키고, 새로운 오류 패턴인 경우 자동으로 새 지식 항목을 생성하며, 실패한 경우 패턴을 갱신하는 자가학습 모듈;을 포함하는 것을 특징으로 하는 시스템.</p>
</div>
</div>

<!-- Patent 5 -->
<div class="patent-section">
<h2>제5호 발명 — 제로포트 터널 기반 멀티테넌트 자동 배포 방법</h2>

<h3>1. 발명의 명칭</h3>
<div class="patent-box highlight">
<strong style="color:#e6edf3; font-size:16px;">인바운드 포트 차단 환경에서의 터널 기반 멀티테넌트 웹 애플리케이션 자동 배포 및 라우팅 방법</strong>
</div>

<h3>2. 발명의 구성</h3>
<div class="patent-diagram">
[인터넷 사용자] → [Cloudflare Edge] → [Named Tunnel / Quick Tunnel]
                                              │
                                    ┌─────────┴─────────┐
                                    ▼                   ▼
                              [Nginx 리버스 프록시]  (포트 80, 내부만)
                                    │
                        ┌───────────┼───────────┐
                        ▼           ▼           ▼
                   [프로젝트A]  [프로젝트B]  [프로젝트C]
                   :3001       :3002       :3003
                   
서버 인바운드 포트: 전체 차단 (Zero-Port)
모든 트래픽: Cloudflare Tunnel 아웃바운드 연결을 통해서만 수신
</div>

<h3>3. 특허청구범위</h3>
<div class="patent-box claim">
<h4>청구항 1 (독립항)</h4>
<p>서버의 인바운드 포트를 완전히 차단한 제로포트 환경에서 멀티테넌트 웹 애플리케이션을 자동 배포하는 방법에 있어서,<br>
(a) 각 프로젝트에 대해 고유한 서브도메인을 할당하고, 서버에서 외부 터널 서비스(Cloudflare Tunnel)로의 아웃바운드 연결을 수립하여 상기 서브도메인에 대한 인바운드 트래픽을 수신하는 단계;<br>
(b) 인증서가 존재하는 경우 Named Tunnel을 생성하여 DNS CNAME 레코드를 자동 설정하고, 인증서가 없는 경우 Quick Tunnel로 자동 폴백하는 이중화 단계;<br>
(c) 서버 재시작 시, 데이터베이스에서 실행 상태의 프로젝트를 조회하고, 지수 백오프(exponential backoff) 재시도 전략으로 터널 연결을 자동 복구하는 단계; 및<br>
(d) 리버스 프록시가 서브도메인 기반으로 각 프로젝트의 컨테이너에 트래픽을 라우팅하되, WebSocket 업그레이드 및 대용량 버퍼를 자동 구성하는 단계;를 포함하는 것을 특징으로 하는 방법.</p>
</div>
</div>

<!-- Patent 6 -->
<div class="patent-section">
<h2>제6호 발명 — 웹 기반 코드 에디터의 LLM 연동 인라인 코드 수정 시스템</h2>

<h3>1. 발명의 명칭</h3>
<div class="patent-box highlight">
<strong style="color:#e6edf3; font-size:16px;">웹 기반 코드 에디터에서의 대규모 언어 모델 연동 인라인 코드 수정 및 다중 파일 리팩토링 시스템과 그 방법</strong>
<p style="margin-top:8px; font-size:13px;">System and Method for LLM-Integrated Inline Code Modification and Multi-File Refactoring in Web-Based Code Editors</p>
</div>

<h3>2. 기술 분야</h3>
<p>본 발명은 웹 기반 통합 개발 환경(IDE) 분야에 관한 것으로, 특히 브라우저에서 실행되는 코드 에디터(Monaco Editor 등)에서 사용자가 선택한 코드 영역에 대해 대규모 언어 모델(LLM)을 연동하여 인라인 수정, 설명, 버그 수정, 리팩토링을 수행하고, 수정 전후 비교(Diff) 뷰를 제공하며, 다중 파일에 대한 일괄 리팩토링을 선택적으로 적용하는 시스템 및 방법에 관한 것이다.</p>

<h3>3. 배경 기술</h3>
<p>기존 AI 코드 도구(GitHub Copilot, Cursor 등)는 로컬 데스크톱 IDE에서만 동작하며, 웹 기반 환경에서의 지원이 제한적이다. 특히 배포된 서버의 소스 코드를 웹 브라우저에서 직접 편집하면서 AI를 활용하는 시스템은 존재하지 않는다. 또한 기존 도구는 단일 파일 편집에 특화되어 있어, 프로젝트 전체를 분석한 다중 파일 리팩토링 기능이 부재하다.</p>

<h3>4. 발명의 구성</h3>
<div class="patent-diagram">
┌─────────────────────────────────────────────────────────────┐
│                   웹 브라우저 (클라이언트)                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Monaco Editor │  │ Diff Editor  │  │ AI 결과 패널      │  │
│  │              │  │ (원본↔수정안) │  │ (설명/패치/수락)  │  │
│  │ [선택 영역]   │  │              │  │                  │  │
│  │ [AI 데코레이션]│  │              │  │ [✅수락] [❌거부] │  │
│  └──────┬───────┘  └──────────────┘  └──────────────────┘  │
│         │                                                   │
│  ┌──────┴────────────────────────────────┐                 │
│  │         인라인 AI 프롬프트 바           │                 │
│  │  🤖 [코드를 어떻게 수정할까요?___] [실행] │                │
│  └──────┬────────────────────────────────┘                 │
└─────────┼───────────────────────────────────────────────────┘
          │ API 호출
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      서버 (백엔드)                           │
│                                                             │
│  ┌───────────────────┐     ┌─────────────────────────────┐ │
│  │ AI 편집 API        │     │ 소스 코드 컨텍스트 수집기    │ │
│  │ /source/ai-edit    │────▶│ (25개 파일, 우선순위 기반)   │ │
│  └───────┬───────────┘     └─────────────────────────────┘ │
│          │                                                  │
│  ┌───────┴───────────┐     ┌─────────────────────────────┐ │
│  │ 듀얼 LLM 라우터   │────▶│ 구조화 JSON 패치 생성기     │ │
│  │ Claude → Gemini   │     │ { file, original, modified } │ │
│  └───────────────────┘     └─────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 멀티파일 패치 적용 API (/source/ai-apply)            │   │
│  │ 선택된 패치만 일괄 적용 + 결과 보고                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
</div>

<h3>5. 특허청구범위</h3>

<div class="patent-box claim">
<h4>청구항 1 (독립항)</h4>
<p>웹 기반 코드 에디터에서 대규모 언어 모델을 연동하여 코드를 수정하는 방법에 있어서,<br>
(a) 웹 브라우저에서 실행되는 코드 에디터에서 사용자가 선택한 코드 영역의 텍스트, 선택 범위(시작/끝 줄번호), 파일 경로, 및 전체 파일 내용을 자동으로 추출하는 단계;<br>
(b) 사용자가 인라인 프롬프트 바 또는 컨텍스트 메뉴를 통해 AI 지시사항을 입력하는 단계;<br>
(c) 추출된 코드 영역, 전체 파일 내용, 및 사용자 지시사항을 서버 측의 대규모 언어 모델(LLM)에 전송하여, 수정된 코드(modified), 변경 설명(explanation), 및 변경 항목 목록(changes)을 포함하는 구조화된 JSON 응답을 수신하는 단계;<br>
(d) 수신된 수정안에 대해, 에디터 내 해당 코드 영역에 시각적 데코레이션(하이라이트, 글리프 마진 표시)을 적용하여 수정 대상임을 표시하는 단계;<br>
(e) 별도의 결과 패널에 원본 코드와 수정 코드를 비교 표시하고, 선택적으로 나란히 배치된 Diff 에디터를 통해 줄 단위 변경 사항을 시각화하는 단계; 및<br>
(f) 사용자가 수락 명령을 입력하면 에디터의 선택 영역을 수정된 코드로 대체하고, 거부 명령을 입력하면 데코레이션을 제거하고 원본을 유지하는 단계;를 포함하는 것을 특징으로 하는 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 2 (종속항 — 컨텍스트 메뉴 연동)</h4>
<p>제1항에 있어서, 상기 (b) 단계는, 코드 에디터의 우클릭 컨텍스트 메뉴에 AI 기능 항목(수정, 설명, 버그 수정, 리팩토링)을 동적으로 등록하고, 코드 선택 상태에 따라 메뉴 항목의 활성/비활성을 자동 제어하며, 키보드 단축키(Ctrl+I)를 통한 인라인 프롬프트 바 호출을 포함하는 것을 특징으로 하는 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 3 (종속항 — 멀티파일 리팩토링)</h4>
<p>제1항에 있어서, 상기 방법은 다중 파일에 대한 일괄 리팩토링 기능을 더 포함하되,<br>
(g) 프로젝트 소스 디렉토리에서 우선순위 파일을 포함한 최대 25개의 소스 파일을 자동 수집하여 LLM에 프로젝트 전체 컨텍스트를 제공하는 단계;<br>
(h) LLM이 다중 파일에 걸친 수정 패치 배열(각 패치는 파일 경로, 원본 코드, 수정 코드, 변경 사유를 포함)을 생성하는 단계;<br>
(i) 사용자 인터페이스에 파일별 패치를 체크박스와 함께 나열하여, 사용자가 선택적으로 적용할 패치를 결정하는 단계; 및<br>
(j) 선택된 패치만을 서버에 전송하여 해당 파일들에 일괄 적용하고, 적용 결과(성공/실패)를 파일별로 보고하는 단계;를 포함하는 것을 특징으로 하는 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 4 (종속항 — 듀얼 LLM)</h4>
<p>제1항에 있어서, 상기 (c) 단계에서 LLM 호출은, 제1 LLM(Claude)에 대한 요청이 소정 시간(45초) 내에 응답되지 않거나 오류가 발생한 경우, 자동으로 제2 LLM(Gemini)으로 폴백하는 듀얼 라우팅을 포함하는 것을 특징으로 하는 방법.</p>
</div>

<div class="patent-box claim">
<h4>청구항 5 (시스템 독립항)</h4>
<p>웹 기반 코드 에디터에서의 LLM 연동 코드 수정 시스템에 있어서,<br>
웹 브라우저에서 실행되며 코드 선택 영역 추출, AI 데코레이션 표시, Diff 에디터 전환, 수정 수락/거부 처리를 수행하는 클라이언트 모듈;<br>
선택된 코드와 프로젝트 컨텍스트를 수신하여 LLM에 전달하고 구조화된 JSON 패치를 생성하는 서버 측 AI 편집 모듈;<br>
복수의 LLM 간 자동 폴백 라우팅을 수행하는 듀얼 LLM 라우터 모듈;<br>
다중 파일에 대한 패치를 선택적으로 적용하는 멀티파일 패치 적용 모듈; 및<br>
인라인 프롬프트 바, 컨텍스트 메뉴, 키보드 단축키를 통해 AI 기능을 호출하는 사용자 인터페이스 모듈;을 포함하는 것을 특징으로 하는 시스템.</p>
</div>

<h3>6. 선행 기술 대비 진보성</h3>
<table class="patent-table">
<thead>
<tr><th>비교 항목</th><th>GitHub Copilot</th><th>Cursor</th><th>본 발명 (Orbitron AI Editor)</th></tr>
</thead>
<tbody>
<tr><td>실행 환경</td><td>데스크톱 IDE 전용</td><td>Electron 앱</td><td style="color:#50fa7b;">웹 브라우저 (서버 배포 코드 직접 편집)</td></tr>
<tr><td>인라인 수정</td><td>자동 완성 기반</td><td>Ctrl+K 인라인</td><td style="color:#50fa7b;">선택 영역 + 인라인 프롬프트 + 컨텍스트 메뉴</td></tr>
<tr><td>Diff 뷰</td><td>제한적</td><td>인라인만</td><td style="color:#50fa7b;">전용 DiffEditor + 결과 패널 이중 표시</td></tr>
<tr><td>멀티파일 편집</td><td>없음</td><td>Composer (별도)</td><td style="color:#50fa7b;">프로젝트 전체 분석 + 선택적 일괄 적용</td></tr>
<tr><td>배포 연동</td><td>없음</td><td>없음</td><td style="color:#50fa7b;">수정 후 즉시 재배포 가능</td></tr>
<tr><td>수락/거부</td><td>Tab/Esc</td><td>수락/거부</td><td style="color:#50fa7b;">수락/거부 + 데코레이션 + 결과 패널</td></tr>
<tr><td>듀얼 LLM</td><td>단일 모델</td><td>단일 모델</td><td style="color:#50fa7b;">Claude↔Gemini 자동 폴백</td></tr>
</tbody>
</table>
</div>

<!-- Filing Strategy -->
<div class="patent-section">
<h2>출원 전략 및 비용 산정</h2>

<h3>출원 일정</h3>
<table class="patent-table">
<thead>
<tr><th>단계</th><th>기간</th><th>대상</th><th>비용 (예상)</th></tr>
</thead>
<tbody>
<tr><td style="color:#bd93f9; font-weight:600;">1차 국내 출원</td><td>2026년 Q2~Q3</td><td>제1호, 제2호, 제6호 (최우선 3건)</td><td style="text-align:right;">₩10,500,000</td></tr>
<tr><td style="color:#58a6ff; font-weight:600;">2차 국내 출원</td><td>2026년 Q4</td><td>제3호, 제4호, 제5호 (3건)</td><td style="text-align:right;">₩10,500,000</td></tr>
<tr><td style="color:#50fa7b; font-weight:600;">PCT 국제출원</td><td>2027년 Q2</td><td>제1호, 제2호, 제6호 (핵심 3건)</td><td style="text-align:right;">₩15,000,000</td></tr>
<tr><td>심사청구</td><td>출원 후 3년 이내</td><td>전체 6건</td><td style="text-align:right;">₩6,000,000</td></tr>
<tr><td>상표 등록</td><td>2026년 Q2</td><td>"Orbitron" (제9류, 제42류)</td><td style="text-align:right;">₩500,000</td></tr>
<tr><td>프로그램 저작권</td><td>2026년 Q2</td><td>Orbitron 소스코드 전체</td><td style="text-align:right;">₩50,000</td></tr>
<tr style="background:rgba(189,147,249,0.05);"><td colspan="3" style="font-weight:700; color:#bd93f9;">총 IP 비용</td><td style="text-align:right; font-weight:700; color:#bd93f9;">₩42,550,000</td></tr>
</tbody>
</table>

<h3>출원 시 주의사항</h3>
<div class="patent-box">
<ul style="padding-left:20px; color:#c9d1d9;">
<li><strong>신규성 유지:</strong> 본 문서는 사내 기밀 문서로 관리하며, 출원 전 기술 내용의 외부 공개(논문, 블로그, 오픈소스 등)를 금지합니다.</li>
<li><strong>선행기술 조사:</strong> 변리사를 통한 정식 선행기술 조사(patent search)를 출원 전에 실시하여 청구범위를 최적화합니다.</li>
<li><strong>명세서 보완:</strong> 본 예비 출원서를 기반으로 변리사가 정식 명세서(상세한 설명, 도면, 요약서)를 작성합니다.</li>
<li><strong>우선일 확보:</strong> 가출원(임시출원) 제도를 활용하여 우선일을 조기 확보하고, 12개월 이내에 정식 출원으로 전환합니다.</li>
<li><strong>PCT 전략:</strong> 핵심 특허(제1, 2, 6호)에 대해 국내 출원일로부터 12개월 이내에 PCT 국제출원하여 미국, 일본, EU 진입 검토합니다.</li>
</ul>
</div>
</div>

<div style="text-align:center; padding:32px; margin-top:20px; border-top:1px solid rgba(255,255,255,0.05);">
<div style="font-size:12px; color:#484f58;">
본 문서는 (주)오비트론의 사내 기밀 문서입니다. 무단 복제 및 외부 유출을 금합니다.<br>
Orbitron Preliminary Patent Application Specification v1.0 · 2026-04-03 · Confidential
</div>
</div>

</div>
