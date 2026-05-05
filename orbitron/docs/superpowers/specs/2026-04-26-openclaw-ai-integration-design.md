# Orbitron AI → OpenClaw 전환 설계

> **작성**: 2026-04-26
> **상태**: ✅ **구현 완료** (2026-04-26)
> **추가 확장**: 2026-04-26 (이미지/파일 업로드, 에이전트 선택 UI)
> **범위**: Orbitron 대시보드의 모든 AI 기능을 Anthropic/Gemini API 직접 호출에서 OpenClaw 게이트웨이 WebSocket RPC로 교체

## 구현 결과 요약

| 항목 | 상태 |
|------|------|
| `services/openclawClient.js` 생성 (WebSocket RPC) | ✅ |
| `services/aiAnalyzer.js` OpenClaw 전환 | ✅ |
| `services/aiAutoRepair.js` OpenClaw 전환 | ✅ |
| `routes/source.js` 코드 에디터 AI OpenClaw 전환 | ✅ |
| `routes/projects.js` 채팅 + 설정 엔드포인트 | ✅ |
| 프론트엔드 에이전트 선택 UI (설정 페이지 + 채팅 페이지) | ✅ |
| OpenClaw 토큰 입력 + 연결 테스트 | ✅ |
| `.env` OpenClaw 환경변수, Anthropic/Gemini 키 제거 | ✅ |
| Anthropic/Gemini SDK 제거 | ✅ |
| **추가**: 이미지/파일 업로드 (📎 버튼, 미리보기, multipart) | ✅ |
| **추가**: 세션 캐싱 (대화 컨텍스트 유지) | ✅ |
| **추가**: 프로토콜 적응 (challenge-response, sessions.create+send) | ✅ |

기본 에이전트: `claude-max`. 게이트웨이 URL: `wss://openclaw.twinverse.org`. 25개 에이전트 감지.

---

## 1. 목표

- Orbitron의 모든 AI 기능(채팅, 오류 분석, 코드 편집, 자동 수리)을 OpenClaw 게이트웨이 경유로 전환
- OpenClaw 에이전트 선택 기능 추가 (서버 전역 기본 + 프로젝트별 override)
- OpenClaw 토큰 입력 UI 추가 (관리자 전용, 향후 사용자별 확장 가능)
- 기존 Anthropic/Gemini API 키 및 직접 호출 코드 제거

---

## 2. 아키텍처

### 현재

```
Frontend → REST API → aiAnalyzer.js → Anthropic Claude API (REST)
                                     → Google Gemini API (REST, fallback)
                                     → Ollama (REST, local fallback)
```

### 변경 후

```
Frontend → REST API → openclawClient.js → OpenClaw Gateway (WebSocket RPC)
                                           ↓
                                     twinverse-ai LAN (192.168.219.117:18789)
                                     또는 wss://openclaw.twinverse.org
                                           ↓
                                     CLI Agents (Codex/Claude/Gemini/Ollama)
```

프론트엔드의 REST API 인터페이스(`/api/projects/:id/chat`, `/source/ai-edit`)는 변경 없음. 백엔드 서비스 계층만 교체.

---

## 3. 새 서비스: `services/openclawClient.js`

기존 `aiAnalyzer.js`를 대체하는 OpenClaw WebSocket RPC 클라이언트.

### 3.1 핵심 기능

| 메서드 | OpenClaw RPC | 용도 |
|--------|-------------|------|
| `connect()` | WebSocket handshake + 토큰 인증 | 연결 수립 |
| `listAgents()` | `agents.list` | 사용 가능 에이전트 목록 |
| `chat(agentId, sessionKey, message)` | `chat.send` | 메시지 전송 + 스트리밍 응답 |
| `abort()` | `chat.abort` | 진행 중 응답 취소 |
| `getHealth()` | WebSocket ping 또는 `agents.list` | 연결 상태 확인 |

### 3.2 연결 관리

- **Lazy 연결**: 첫 AI 호출 시 연결, 유휴 시 유지
- **자동 재연결**: 연결 끊김 시 exponential backoff로 재시도
- **세션 키 패턴**: `agent:{agentId}:orbitron-{projectId}-{feature}`
  - feature: `chat`, `error-analysis`, `code-edit`, `auto-repair`
  - 같은 프로젝트+기능이면 컨텍스트 유지

### 3.3 응답 수집

OpenClaw `chat.send`는 스트리밍 delta를 반환. 현재 Orbitron AI 엔드포인트는 전체 응답을 한 번에 반환하므로, delta를 버퍼링하여 완전한 응답으로 조합 후 반환.

```javascript
async chat(agentId, sessionKey, message) {
    let fullResponse = '';
    await this.client.chatSend(agentId, sessionKey, message, (delta) => {
        fullResponse += delta.text ?? '';
    });
    return fullResponse;
}
```

향후 SSE/WebSocket 스트리밍이 필요하면 프론트엔드도 수정.

---

## 4. 교체 매핑

### 4.1 채팅 (`routes/projects.js` → `POST /api/projects/:id/chat`)

| 항목 | 현재 | 변경 |
|------|------|------|
| 호출 | `aiAnalyzer.chat(messages, aiModel, envVars, context)` | `openclawClient.chat(agentId, sessionKey, message)` |
| 모델 선택 | `project.ai_model` (claude-4-6-sonnet 등) | `project.openclaw_agent_id \|\| env.OPENCLAW_DEFAULT_AGENT` |
| 시스템 프롬프트 | 코드에 하드코딩 | OpenClaw 에이전트 설정에 포함 (에이전트 생성 시 지정) |
| 컨텍스트 | 프로젝트 정보를 시스템 프롬프트에 주입 | 메시지 앞에 프로젝트 컨텍스트 프리픽스 |
| ACTION 태그 | `[ACTION:FIX_AND_DEPLOY]` 등 파싱 | 동일 유지 (응답 텍스트에서 파싱) |

### 4.2 오류 분석 (`deployer.js` → 배포 실패 시)

| 항목 | 현재 | 변경 |
|------|------|------|
| 호출 | `aiAnalyzer.analyzeError(logs, aiModel, envVars)` | `openclawClient.chat(agentId, errorSessionKey, logs + prompt)` |
| 프롬프트 | 한국어 기술 분석 시스템 프롬프트 | 에이전트 시스템 프롬프트 + 메시지 내 컨텍스트 |

### 4.3 코드 편집 (`routes/source.js` → `POST /source/ai-edit`)

| 항목 | 현재 | 변경 |
|------|------|------|
| 호출 | Anthropic SDK → Claude API (45s timeout) → Gemini fallback | `openclawClient.chat()` 단일 경로 |
| 응답 | JSON 구조 (modifications, explanation) | 동일 JSON 구조를 프롬프트로 요청, 응답에서 파싱 |
| 폴백 | Claude → Gemini | OpenClaw 에이전트의 모델 폴백에 위임 |

### 4.4 자동 수리 (`aiAutoRepair.js`)

| 항목 | 현재 | 변경 |
|------|------|------|
| 호출 | `aiAnalyzer.chat()` 내부에서 Claude/Gemini | `openclawClient.chat()` + 패치 생성 프롬프트 |
| 패치 적용 | `applyPatches()` 그대로 | 변경 없음 |
| GitHub PR | `createGitHubPR()` 그대로 | 변경 없음 |

---

## 5. 설정 구조

### 5.1 서버 전역 (`.env`)

```env
# OpenClaw 게이트웨이 (기존 ANTHROPIC_API_KEY, GEMINI_API_KEY 대체)
OPENCLAW_WS_URL=wss://openclaw.twinverse.org
OPENCLAW_TOKEN=<게이트웨이 토큰>
OPENCLAW_DEFAULT_AGENT=<기본 에이전트 ID>
```

### 5.2 DB 변경

`projects` 테이블:
- `ai_model` 컬럼 → `openclaw_agent_id` 로 용도 변경 (또는 새 컬럼)
  - 미설정 시 서버 기본 에이전트 사용

### 5.3 Orbitron 대시보드 설정 페이지

새 섹션 "OpenClaw 게이트웨이":
- **URL**: 텍스트 입력 (기본값: `wss://openclaw.twinverse.org`)
- **토큰**: 비밀번호 입력 + 마스킹
- **연결 테스트**: 버튼 → `agents.list` 호출로 검증
- **기본 에이전트**: 연결 테스트 성공 후 드롭다운 표시

---

## 6. 프론트엔드 변경

### 6.1 설정 페이지 (관리자)

- OpenClaw URL/토큰/기본 에이전트 설정 UI
- 연결 테스트 버튼 + 상태 표시
- 기존 Anthropic/Gemini API 키 입력 UI 제거

### 6.2 프로젝트 설정

- "AI 모델" 드롭다운 → "OpenClaw 에이전트" 드롭다운으로 교체
- 에이전트 목록은 서버에서 `agents.list` 결과를 캐싱하여 제공
- "서버 기본값 사용" 옵션 포함

### 6.3 채팅/코드 에디터

- UI 변경 없음 (기존 인터페이스 유지)
- AI 모델 표시 부분만 에이전트 이름으로 교체

---

## 7. 제거 대상

| 항목 | 파일 |
|------|------|
| `ANTHROPIC_API_KEY` 환경변수 | `.env`, `aiAnalyzer.js`, `source.js` |
| `GEMINI_API_KEY` 환경변수 | `.env`, `aiAnalyzer.js`, `source.js` |
| Anthropic SDK 호출 코드 | `aiAnalyzer.js` |
| Gemini SDK 호출 코드 | `aiAnalyzer.js` |
| Claude/Gemini 폴백 로직 | `aiAnalyzer.js`, `source.js` |
| AI 모델 선택 UI | `app.html`, `app.js` |
| 프로젝트별 API 키 저장 | `routes/projects.js` |

**유지**: `aiAutoRepair.js`의 패치 적용/PR 생성 로직, `errorKnowledge.js`, ACTION 태그 파싱

---

## 8. 향후 확장

- **사용자별 토큰**: `users` 테이블에 `openclaw_token` 컬럼 추가, `사용자 토큰 || 서버 토큰` 우선순위
- **스트리밍 응답**: 프론트엔드 SSE/WebSocket으로 실시간 delta 표시
- **에이전트 관리**: Orbitron 대시보드에서 OpenClaw 에이전트 CRUD

---

_설계: 2026-04-26_
