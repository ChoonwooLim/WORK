# OpenClaw AI Integration — Implementation Plan

> **상태**: ✅ **모든 9개 Task 완료** (2026-04-26)
> **추가 작업 (계획 외)**: 프로토콜 어댑테이션, 세션 캐싱, 이미지/파일 업로드, 에이전트 선택 UI 모두 완료

## 실행 결과 요약

| Task | 커밋 | 상태 |
|------|------|------|
| Task 1: `services/openclawClient.js` 생성 | `96aac97` | ✅ |
| Task 2: `aiAnalyzer.js` OpenClaw 전환 | `5c59708` | ✅ |
| Task 3: `aiAutoRepair.js` OpenClaw 전환 | `c417e5e` | ✅ |
| Task 4: `routes/source.js` 코드 에디터 AI 전환 | `fb590f5` | ✅ |
| Task 5: `routes/projects.js` 채팅+설정 엔드포인트 | `c65161c` | ✅ |
| Task 6: `.env` 환경변수 교체 | (gitignored) | ✅ |
| Task 7: 프론트엔드 UI (에이전트 + 토큰) | `00d13da` | ✅ |
| Task 8: E2E 검증 | — | ✅ |
| Task 9: SDK 제거 | `648231d` | ✅ |
| 추가: 프로토콜 적응 (connect+sessions) | `6b02901` | ✅ |
| 추가: 이미지/파일 업로드 | `2972a31` | ✅ |
| 추가: 세션 캐싱 | `765c55e` | ✅ |
| 추가: 채팅 페이지 에이전트 선택 | `af4ea1e` | ✅ |
| 추가: Orbi 시스템 프롬프트 주입 | `2bdc826` | ✅ |

---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all Anthropic/Gemini API direct calls in Orbitron with OpenClaw Gateway WebSocket RPC, add agent selection and token input UI.

**Architecture:** New `services/openclawClient.js` wraps OpenClaw WebSocket RPC. All existing AI call sites (`aiAnalyzer.js`, `aiAutoRepair.js`, `source.js`) are rewired to use this single client. Frontend REST API endpoints remain unchanged — only backend service layer swaps.

**Tech Stack:** Node.js WebSocket (`ws` package), OpenClaw RPC v3 (JSON over WebSocket), existing Express routes, existing frontend vanilla JS.

**Spec:** `docs/superpowers/specs/2026-04-26-openclaw-ai-integration-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `services/openclawClient.js` | Create | OpenClaw WebSocket RPC client (connect, chat, listAgents, abort) |
| `services/aiAnalyzer.js` | Rewrite | Delegate to openclawClient instead of Anthropic/Gemini SDK |
| `services/aiAutoRepair.js` | Modify | Replace Claude/Gemini calls with openclawClient |
| `routes/projects.js` | Modify | Add OpenClaw settings endpoints, update chat handler |
| `routes/source.js` | Modify | Replace fetch-based Claude/Gemini calls with openclawClient |
| `public/js/app.js` | Modify | Agent selector, token input, remove model/key UI |
| `public/app.html` | Modify | Settings UI: OpenClaw section replaces API key section |
| `.env` | Modify | Add OPENCLAW_WS_URL, OPENCLAW_TOKEN; remove API keys |

---

### Task 1: Create `services/openclawClient.js`

**Files:**
- Create: `services/openclawClient.js`

- [ ] **Step 1: Install ws package**

```bash
cd /home/stevenlim/WORK/orbitron && npm install ws
```

- [ ] **Step 2: Create OpenClaw client service**

Reference: `deployments/openclaw-ai/frontend/src/lib/openclaw-client.js` for RPC protocol.

```javascript
// services/openclawClient.js
const WebSocket = require('ws');

const OPENCLAW_WS_URL = () => process.env.OPENCLAW_WS_URL || 'wss://openclaw.twinverse.org';
const OPENCLAW_TOKEN = () => process.env.OPENCLAW_TOKEN || '';
const OPENCLAW_DEFAULT_AGENT = () => process.env.OPENCLAW_DEFAULT_AGENT || '';

class OpenClawClient {
    constructor() {
        this.ws = null;
        this.connected = false;
        this.rpcId = 1;
        this.pending = new Map();       // rpcId → { resolve, reject }
        this.streamCbs = new Map();     // streamKey → { onDelta, onDone, onError }
        this._reconnectTimer = null;
        this._connectPromise = null;
    }

    // ── Connection ──

    async connect() {
        if (this.connected && this.ws?.readyState === WebSocket.OPEN) return;
        if (this._connectPromise) return this._connectPromise;

        this._connectPromise = new Promise((resolve, reject) => {
            const url = OPENCLAW_WS_URL();
            const token = OPENCLAW_TOKEN();
            if (!url || !token) {
                this._connectPromise = null;
                return reject(new Error('OPENCLAW_WS_URL 또는 OPENCLAW_TOKEN 미설정'));
            }

            try { this.ws = new WebSocket(url); } catch (e) {
                this._connectPromise = null;
                return reject(e);
            }

            const timeout = setTimeout(() => {
                this._connectPromise = null;
                this.ws?.terminate();
                reject(new Error('OpenClaw 연결 타임아웃 (15초)'));
            }, 15000);

            this.ws.on('open', async () => {
                try {
                    await this._send('auth.token', { token });
                    this.connected = true;
                    clearTimeout(timeout);
                    this._connectPromise = null;
                    console.log('[OpenClaw] 게이트웨이 연결 성공:', url);
                    resolve();
                } catch (e) {
                    clearTimeout(timeout);
                    this._connectPromise = null;
                    reject(new Error(`OpenClaw 인증 실패: ${e.message}`));
                }
            });

            this.ws.on('message', (raw) => this._dispatch(JSON.parse(raw.toString())));

            this.ws.on('close', () => {
                this.connected = false;
                this._connectPromise = null;
                console.log('[OpenClaw] 연결 종료');
            });

            this.ws.on('error', (err) => {
                this.connected = false;
                this._connectPromise = null;
                clearTimeout(timeout);
                console.error('[OpenClaw] WebSocket 오류:', err.message);
                reject(err);
            });
        });

        return this._connectPromise;
    }

    disconnect() {
        if (this.ws) { this.ws.close(); this.ws = null; }
        this.connected = false;
        this._connectPromise = null;
        this.pending.clear();
        this.streamCbs.clear();
    }

    // ── RPC ──

    _send(method, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('OpenClaw WebSocket 미연결'));
            }
            const id = this.rpcId++;
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`RPC 타임아웃: ${method}`));
                }
            }, 60000);
        });
    }

    _dispatch(msg) {
        // RPC response
        if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
            else resolve(msg.result);
            return;
        }
        // Stream events
        if (msg.method === 'chat.delta') {
            const key = msg.params?.session_key || msg.params?.sessionKey;
            const cb = this.streamCbs.get(key);
            if (cb?.onDelta) cb.onDelta(msg.params);
        } else if (msg.method === 'chat.done') {
            const key = msg.params?.session_key || msg.params?.sessionKey;
            const cb = this.streamCbs.get(key);
            if (cb?.onDone) cb.onDone(msg.params);
            this.streamCbs.delete(key);
        } else if (msg.method === 'chat.error') {
            const key = msg.params?.session_key || msg.params?.sessionKey;
            const cb = this.streamCbs.get(key);
            if (cb?.onError) cb.onError(msg.params);
            this.streamCbs.delete(key);
        }
    }

    // ── Public API ──

    async listAgents() {
        await this.connect();
        return this._send('agents.list');
    }

    /**
     * Send a chat message and collect the full streamed response.
     * @param {string} agentId - OpenClaw agent ID
     * @param {string} sessionKey - Session key (e.g. "agent:{agentId}:orbitron-{projectId}-chat")
     * @param {string} message - User message
     * @param {number} timeoutMs - Max wait time (default 120s)
     * @returns {Promise<string>} Full response text
     */
    async chat(agentId, sessionKey, message, timeoutMs = 120000) {
        await this.connect();

        return new Promise((resolve, reject) => {
            let fullText = '';
            const timer = setTimeout(() => {
                this.streamCbs.delete(sessionKey);
                reject(new Error(`OpenClaw 응답 타임아웃 (${timeoutMs / 1000}초)`));
            }, timeoutMs);

            this.streamCbs.set(sessionKey, {
                onDelta: (params) => { fullText += params.text ?? ''; },
                onDone: () => { clearTimeout(timer); resolve(fullText); },
                onError: (params) => { clearTimeout(timer); reject(new Error(params.message || 'OpenClaw chat 오류')); },
            });

            this._send('chat.send', {
                agent_id: agentId,
                session_key: sessionKey,
                message,
            }).catch((e) => {
                clearTimeout(timer);
                this.streamCbs.delete(sessionKey);
                reject(e);
            });
        });
    }

    async abort(agentId, sessionKey) {
        await this.connect();
        return this._send('chat.abort', { agent_id: agentId, session_key: sessionKey });
    }

    /**
     * Resolve the agent ID: project override → server default.
     */
    resolveAgent(project) {
        return project?.openclaw_agent_id || OPENCLAW_DEFAULT_AGENT() || null;
    }

    /**
     * Build a session key for a project feature.
     */
    sessionKey(agentId, projectId, feature) {
        return `agent:${agentId}:orbitron-${projectId}-${feature}`;
    }

    isConfigured() {
        return !!(OPENCLAW_WS_URL() && OPENCLAW_TOKEN());
    }

    async health() {
        try {
            await this.connect();
            const agents = await this.listAgents();
            return { ok: true, agents: agents?.length || 0, url: OPENCLAW_WS_URL() };
        } catch (e) {
            return { ok: false, error: e.message, url: OPENCLAW_WS_URL() };
        }
    }
}

// Singleton
module.exports = new OpenClawClient();
```

- [ ] **Step 3: Verify module loads without error**

```bash
cd /home/stevenlim/WORK/orbitron && node -e "const c = require('./services/openclawClient'); console.log('loaded, configured:', c.isConfigured())"
```

Expected: `loaded, configured: false` (no env vars yet)

- [ ] **Step 4: Commit**

```bash
git add services/openclawClient.js package.json package-lock.json
git commit -m "feat: add OpenClaw WebSocket RPC client service"
```

---

### Task 2: Rewrite `services/aiAnalyzer.js`

**Files:**
- Modify: `services/aiAnalyzer.js`

- [ ] **Step 1: Replace aiAnalyzer.js with OpenClaw-based implementation**

Replace the entire file. Keep the same exported interface (`analyzeError`, `chat`) so callers don't break.

```javascript
// services/aiAnalyzer.js — OpenClaw 기반
const openclawClient = require('./openclawClient');

const ERROR_ANALYSIS_PROMPT = `당신은 Orbitron 배포 플랫폼의 기술 분석 AI입니다.

사용자가 배포 로그를 보내면 다음 구조로 분석하세요:
1. **에러 감지**: 로그에서 실패 원인을 정확히 찾아내기
2. **근본 원인**: 왜 이 에러가 발생했는지 설명
3. **해결 방법**: 구체적인 수정 단계 제시

한국어로 답변하세요. 코드 블록이 필요하면 \`\`\`로 감싸세요.
자동 수리가 가능하면 답변 마지막에 [ACTION:FIX_AND_DEPLOY] 태그를 붙이세요.
재배포만 하면 되면 [ACTION:REDEPLOY] 태그를 붙이세요.`;

class AiAnalyzer {
    /**
     * Analyze deployment error logs.
     * @param {string} logs - Build/deploy log output
     * @param {string} _aiModel - Ignored (kept for API compat)
     * @param {object} _projectEnvVars - Ignored
     * @param {object} project - Project record (for agent resolution)
     * @returns {Promise<string>} Analysis text
     */
    async analyzeError(logs, _aiModel = '', _projectEnvVars = {}, project = null) {
        if (!openclawClient.isConfigured()) {
            return '⚠️ OpenClaw 게이트웨이가 설정되지 않았습니다. 서버 설정에서 URL과 토큰을 입력하세요.';
        }

        const agentId = openclawClient.resolveAgent(project);
        if (!agentId) {
            return '⚠️ OpenClaw 에이전트가 설정되지 않았습니다. 서버 설정에서 기본 에이전트를 선택하세요.';
        }

        const sessionKey = openclawClient.sessionKey(agentId, project?.id || 'global', 'error-analysis');
        const message = `${ERROR_ANALYSIS_PROMPT}\n\n--- 배포 로그 ---\n${logs.slice(-8000)}`;

        try {
            return await openclawClient.chat(agentId, sessionKey, message);
        } catch (e) {
            console.error('[AiAnalyzer] OpenClaw analyzeError 실패:', e.message);
            return `⚠️ AI 분석 실패: ${e.message}`;
        }
    }

    /**
     * Multi-turn chat with project context.
     * @param {Array} messagesArray - [{role, content}]
     * @param {string} _aiModel - Ignored
     * @param {object} _projectEnvVars - Ignored
     * @param {object} projectContext - {name, type, status, logs, sourceFiles}
     * @param {object} project - Project record
     * @returns {Promise<string>} Assistant reply
     */
    async chat(messagesArray, _aiModel = '', _projectEnvVars = {}, projectContext = null, project = null) {
        if (!openclawClient.isConfigured()) {
            return '⚠️ OpenClaw 게이트웨이가 설정되지 않았습니다.';
        }

        const agentId = openclawClient.resolveAgent(project);
        if (!agentId) {
            return '⚠️ OpenClaw 에이전트가 설정되지 않았습니다.';
        }

        const sessionKey = openclawClient.sessionKey(agentId, project?.id || 'global', 'chat');

        // Build context prefix for first message or when context changes
        let contextPrefix = '';
        if (projectContext) {
            contextPrefix = `[프로젝트 컨텍스트]\n이름: ${projectContext.name || 'N/A'}\n타입: ${projectContext.type || 'N/A'}\n상태: ${projectContext.status || 'N/A'}\n`;
            if (projectContext.logs) {
                contextPrefix += `\n최근 로그:\n${projectContext.logs.slice(-3000)}\n`;
            }
            if (projectContext.sourceFiles) {
                contextPrefix += `\n소스 파일:\n${projectContext.sourceFiles.slice(-3000)}\n`;
            }
            contextPrefix += '\n---\n\n';
        }

        // Use the last user message
        const lastUserMsg = [...messagesArray].reverse().find(m => m.role === 'user');
        const message = contextPrefix + (lastUserMsg?.content || '');

        try {
            return await openclawClient.chat(agentId, sessionKey, message);
        } catch (e) {
            console.error('[AiAnalyzer] OpenClaw chat 실패:', e.message);
            return `⚠️ AI 응답 실패: ${e.message}`;
        }
    }
}

module.exports = new AiAnalyzer();
```

- [ ] **Step 2: Verify module loads**

```bash
cd /home/stevenlim/WORK/orbitron && node -e "const a = require('./services/aiAnalyzer'); console.log('loaded, methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(a)).filter(m => m !== 'constructor'))"
```

Expected: `loaded, methods: [ 'analyzeError', 'chat' ]`

- [ ] **Step 3: Commit**

```bash
git add services/aiAnalyzer.js
git commit -m "refactor: replace aiAnalyzer Anthropic/Gemini calls with OpenClaw client"
```

---

### Task 3: Update `services/aiAutoRepair.js`

**Files:**
- Modify: `services/aiAutoRepair.js`

- [ ] **Step 1: Replace AI calls in aiAutoRepair.js**

Replace the Anthropic/Gemini import and `analyzeAndGeneratePatch` AI call section. Keep `applyPatches`, `createGitHubPR`, `_collectSourceFiles` unchanged.

At the top of the file, replace imports (lines 1-7):

```javascript
// OLD:
// const { GoogleGenAI } = require('@google/genai');
// const Anthropic = require('@anthropic-ai/sdk');

// NEW:
const openclawClient = require('./openclawClient');
```

In `analyzeAndGeneratePatch()`, replace the three-way routing (lines ~140-160) with:

```javascript
        // ── OpenClaw 호출 ──
        const agentId = openclawClient.resolveAgent({ openclaw_agent_id: envVars?.OPENCLAW_AGENT_ID });
        if (!agentId || !openclawClient.isConfigured()) {
            return { canFix: false, summary: 'OpenClaw 미설정', patches: [] };
        }

        const sessionKey = openclawClient.sessionKey(agentId, 'auto-repair', Date.now().toString(36));
        let responseText;
        try {
            responseText = await openclawClient.chat(agentId, sessionKey, userPrompt, 90000);
        } catch (e) {
            console.error('[AutoRepair] OpenClaw 호출 실패:', e.message);
            return { canFix: false, summary: `AI 호출 실패: ${e.message}`, patches: [] };
        }
```

Remove any remaining references to `Anthropic`, `GoogleGenAI`, `process.env.ANTHROPIC_API_KEY`, `process.env.GEMINI_API_KEY` from the file.

- [ ] **Step 2: Verify module loads**

```bash
cd /home/stevenlim/WORK/orbitron && node -e "const a = require('./services/aiAutoRepair'); console.log('loaded')"
```

- [ ] **Step 3: Commit**

```bash
git add services/aiAutoRepair.js
git commit -m "refactor: replace aiAutoRepair Anthropic/Gemini calls with OpenClaw"
```

---

### Task 4: Update `routes/source.js` (code editor AI)

**Files:**
- Modify: `routes/source.js:274-431`

- [ ] **Step 1: Replace AI calls in the `POST /:id/source/ai-edit` handler**

Replace the Claude fetch + Gemini fallback block (lines ~350-410) with OpenClaw call. Keep the prompt building logic (lines 288-346) and JSON response parsing (lines 411-422) unchanged.

At top of file, add:

```javascript
const openclawClient = require('../services/openclawClient');
```

Replace the Claude/Gemini fetch block with:

```javascript
        // ── OpenClaw 호출 ──
        const agentId = openclawClient.resolveAgent(project);
        if (!agentId || !openclawClient.isConfigured()) {
            return res.status(500).json({ error: 'OpenClaw 게이트웨이 미설정. 서버 설정에서 URL/토큰/에이전트를 설정하세요.' });
        }

        const sessionKey = openclawClient.sessionKey(agentId, req.params.id, `code-${action}`);
        const fullPrompt = systemPrompt + '\n\n' + userPrompt;

        let responseText;
        try {
            responseText = await openclawClient.chat(agentId, sessionKey, fullPrompt, 60000);
        } catch (e) {
            console.error('[source/ai-edit] OpenClaw 오류:', e.message);
            return res.status(500).json({ error: `AI 응답 실패: ${e.message}` });
        }
```

Remove all references to `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `fetch('https://api.anthropic.com/...')`, `fetch('https://generativelanguage.googleapis.com/...')`.

- [ ] **Step 2: Verify route loads**

```bash
cd /home/stevenlim/WORK/orbitron && node -e "require('./routes/source'); console.log('source routes loaded')"
```

- [ ] **Step 3: Commit**

```bash
git add routes/source.js
git commit -m "refactor: replace source.js Claude/Gemini fetch with OpenClaw"
```

---

### Task 5: Update `routes/projects.js` (chat + settings endpoints)

**Files:**
- Modify: `routes/projects.js`

- [ ] **Step 1: Update chat handler to pass project to aiAnalyzer**

In `POST /:id/chat` handler (line ~944), update the `aiAnalyzer.chat()` call to pass the project object:

```javascript
// OLD (line ~944):
// const reply = await aiAnalyzer.chat(history, model, envVars, projectContext);

// NEW:
const reply = await aiAnalyzer.chat(history, '', {}, projectContext, project);
```

Similarly update `aiAnalyzer.analyzeError()` calls (in the ACTION handler ~line 951-1009) to pass project.

- [ ] **Step 2: Add OpenClaw settings endpoints**

Add after the chat endpoints (after line ~1054):

```javascript
// ── OpenClaw 설정 ──

// GET /api/openclaw/health — 연결 상태 확인
router.get('/openclaw/health', authMiddleware, async (req, res) => {
    const openclawClient = require('../services/openclawClient');
    const health = await openclawClient.health();
    res.json(health);
});

// GET /api/openclaw/agents — 에이전트 목록
router.get('/openclaw/agents', authMiddleware, async (req, res) => {
    const openclawClient = require('../services/openclawClient');
    try {
        const agents = await openclawClient.listAgents();
        res.json({ agents: agents || [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
```

- [ ] **Step 3: Remove env_vars decryption for API keys in chat handler**

In the chat handler (lines ~882-892), the Anthropic/Gemini key extraction from encrypted `env_vars` is no longer needed. Remove or simplify:

```javascript
// OLD (lines ~882-892):
// let envVars = {};
// if (project.env_vars && typeof project.env_vars === 'string') { ... decrypt ... }
// const anthropicKey = envVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
// ...

// NEW: env_vars decryption no longer needed for AI calls
// Keep the decrypt block if env_vars are used elsewhere, but remove AI key extraction
```

- [ ] **Step 4: Commit**

```bash
git add routes/projects.js
git commit -m "refactor: update chat handler for OpenClaw, add settings endpoints"
```

---

### Task 6: Update `.env`

**Files:**
- Modify: `.env`

- [ ] **Step 1: Add OpenClaw env vars, comment out old keys**

```env
# ── OpenClaw 게이트웨이 (AI 기능) ──
OPENCLAW_WS_URL=wss://openclaw.twinverse.org
OPENCLAW_TOKEN=29604dcbe56e794c6ebbbd296070b27d2e8908170ce5578a7bfd40194028a27f
OPENCLAW_DEFAULT_AGENT=

# ── Legacy (사용 안 함) ──
# ANTHROPIC_API_KEY=sk-ant-api03-...
# GEMINI_API_KEY=AIzaSyDKFAW4...

# ── Ollama (OpenClaw 경유로 대체) ──
# OLLAMA_HOST=http://192.168.219.117:11434
```

Note: `OPENCLAW_DEFAULT_AGENT` 값은 게이트웨이 연결 후 `agents.list`로 확인하여 입력.

- [ ] **Step 2: Commit**

```bash
git add .env
git commit -m "chore: add OpenClaw env vars, comment out Anthropic/Gemini keys"
```

---

### Task 7: Update frontend — Settings UI (`public/app.html` + `public/js/app.js`)

**Files:**
- Modify: `public/app.html`
- Modify: `public/js/app.js`

- [ ] **Step 1: Replace AI model selector in app.html settings**

Find the AI model `<select>` (around line 978 in app.js or in app.html settings section) and replace with OpenClaw agent selector:

```html
<!-- OpenClaw 설정 -->
<div class="setting-group">
    <label>OpenClaw 게이트웨이</label>
    <div style="display:flex; gap:8px; align-items:center;">
        <input type="text" id="set-openclaw-url" placeholder="wss://openclaw.twinverse.org" style="flex:1;" />
        <button onclick="testOpenclawConnection()" class="btn btn-sm" id="btn-openclaw-test">연결 테스트</button>
    </div>
    <span id="openclaw-status" style="font-size:0.8em; color:var(--text-secondary);"></span>
</div>

<div class="setting-group">
    <label>게이트웨이 토큰</label>
    <input type="password" id="set-openclaw-token" placeholder="OpenClaw 게이트웨이 토큰" />
</div>

<div class="setting-group">
    <label>기본 에이전트</label>
    <select id="set-openclaw-agent">
        <option value="">연결 테스트 후 선택</option>
    </select>
</div>
```

Remove the old AI model `<select>` options (claude-4-6-sonnet, gemini-3.1-pro, gemma-4 등) and the Anthropic/Gemini API key input fields.

- [ ] **Step 2: Replace AI model selector in project settings**

In the per-project settings section, replace the `<select id="set-ai-model">` with:

```html
<div class="setting-group">
    <label>OpenClaw 에이전트 (미선택 시 서버 기본값)</label>
    <select id="set-ai-model">
        <option value="">서버 기본값 사용</option>
    </select>
</div>
```

- [ ] **Step 3: Add OpenClaw JS functions in app.js**

Add these functions (replace the old `toggleAiKeyFields()` and model-related code):

```javascript
// ── OpenClaw 설정 ──

async function testOpenclawConnection() {
    const btn = document.getElementById('btn-openclaw-test');
    const status = document.getElementById('openclaw-status');
    btn.disabled = true;
    status.textContent = '연결 중...';
    status.style.color = 'var(--text-secondary)';

    try {
        const res = await fetch('/api/projects/openclaw/health');
        const data = await res.json();
        if (data.ok) {
            status.textContent = `✅ 연결 성공 (에이전트 ${data.agents}개)`;
            status.style.color = '#4caf50';
            await loadOpenclawAgents();
        } else {
            status.textContent = `❌ 연결 실패: ${data.error}`;
            status.style.color = '#f44336';
        }
    } catch (e) {
        status.textContent = `❌ 오류: ${e.message}`;
        status.style.color = '#f44336';
    }
    btn.disabled = false;
}

async function loadOpenclawAgents() {
    try {
        const res = await fetch('/api/projects/openclaw/agents');
        const data = await res.json();
        const agents = data.agents || [];

        // Update both selectors
        for (const selId of ['set-openclaw-agent', 'set-ai-model']) {
            const sel = document.getElementById(selId);
            if (!sel) continue;
            const currentVal = sel.value;
            sel.innerHTML = selId === 'set-ai-model'
                ? '<option value="">서버 기본값 사용</option>'
                : '<option value="">선택...</option>';
            for (const agent of agents) {
                const opt = document.createElement('option');
                opt.value = agent.id || agent.name;
                opt.textContent = `${agent.name} (${agent.model || 'default'})`;
                sel.appendChild(opt);
            }
            if (currentVal) sel.value = currentVal;
        }
    } catch (e) {
        console.error('에이전트 목록 로드 실패:', e);
    }
}
```

- [ ] **Step 4: Update `saveSettings()` function**

In the existing `saveSettings()` function (around line 1465-1504), change `ai_model` to send the selected agent ID:

```javascript
// In saveSettings():
const aiModel = document.getElementById('set-ai-model')?.value || '';
// This value is now an OpenClaw agent ID (or empty for server default)
// The rest of the save logic stays the same — it still saves to project.ai_model column
```

- [ ] **Step 5: Remove old model/key UI code**

Remove:
- `toggleAiKeyFields()` function
- Anthropic/Gemini API key input fields in HTML
- Model-specific option elements (claude-4-6-sonnet, gemini-3.1-pro, etc.)

- [ ] **Step 6: Commit**

```bash
git add public/app.html public/js/app.js
git commit -m "feat: replace AI model/key UI with OpenClaw agent selector and token input"
```

---

### Task 8: Restart and verify end-to-end

**Files:** None (verification only)

- [ ] **Step 1: Set OPENCLAW_DEFAULT_AGENT**

```bash
# Connect to gateway and list agents to find an ID
cd /home/stevenlim/WORK/orbitron && node -e "
const c = require('./services/openclawClient');
process.env.OPENCLAW_WS_URL = 'wss://openclaw.twinverse.org';
process.env.OPENCLAW_TOKEN = '29604dcbe56e794c6ebbbd296070b27d2e8908170ce5578a7bfd40194028a27f';
c.listAgents().then(a => { console.log(JSON.stringify(a, null, 2)); c.disconnect(); }).catch(e => console.error(e.message));
"
```

Set the returned agent ID in `.env` as `OPENCLAW_DEFAULT_AGENT=<agent_id>`.

- [ ] **Step 2: Restart Orbitron server**

```bash
kill -USR2 $(ps aux | grep "node.*orbitron/server.js" | grep -v grep | awk '{print $2}')
```

- [ ] **Step 3: Verify chat endpoint**

```bash
# Get a project ID
PROJECT_ID=$(docker exec orbitron-openclaw-db psql -U orbitron_user -d orbitron_db -t -c "SELECT id FROM projects LIMIT 1" 2>/dev/null | tr -d ' ')
echo "Project: $PROJECT_ID"

# Test chat
curl -s -X POST "http://localhost:3000/api/projects/$PROJECT_ID/chat" \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <admin session cookie>' \
  -d '{"message":"안녕하세요, 테스트입니다"}' | head -c 500
```

- [ ] **Step 4: Verify OpenClaw health endpoint**

```bash
curl -s http://localhost:3000/api/projects/openclaw/health
```

Expected: `{"ok":true,"agents":N,"url":"wss://openclaw.twinverse.org"}`

- [ ] **Step 5: Test in browser**

Open Orbitron dashboard → 아무 프로젝트 → AI 어시스턴트 → 메시지 전송 → OpenClaw 경유 응답 확인.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete OpenClaw AI integration — all AI calls via gateway"
```

---

### Task 9: Cleanup — Remove unused dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Uninstall Anthropic and Gemini SDK**

```bash
cd /home/stevenlim/WORK/orbitron && npm uninstall @anthropic-ai/sdk @google/genai
```

- [ ] **Step 2: Verify no remaining imports**

```bash
grep -rn "require.*anthropic\|require.*@google/genai" services/ routes/ --include="*.js"
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused Anthropic and Gemini SDK dependencies"
```
