/**
 * OpenClaw WebSocket RPC client (Node.js / Orbitron)
 *
 * Connects to OpenClaw gateway using the native frame protocol:
 *   - Handshake: wait for connect.challenge → send { type:"req", method:"connect", params:{...} }
 *   - Requests: { type:"req", id, method, params }
 *   - Responses: { type:"res", id, ok, result|error }
 *   - Events: { type:"event", event, payload }
 *
 * Env vars:
 *   OPENCLAW_WS_URL          (default: wss://openclaw.twinverse.org)
 *   OPENCLAW_TOKEN            gateway auth token
 *   OPENCLAW_DEFAULT_AGENT    fallback agent id (default: "main")
 */

const WebSocket = require('ws');

const REQUEST_TIMEOUT_MS = 30_000;

// ─── state ───────────────────────────────────────────────────────────
let ws = null;
let requestSeq = 0;
const pending = new Map();   // id -> { resolve, reject, timer }
const streams = new Map();   // sessionKey -> { resolve, reject, chunks, timer }
let ready = false;
let connectingP = null;

// ─── helpers ─────────────────────────────────────────────────────────
function nextId() {
  requestSeq += 1;
  return `req-${Date.now()}-${requestSeq}`;
}

function envUrl()   { return process.env.OPENCLAW_WS_URL || 'wss://openclaw.twinverse.org'; }
function envToken() { return process.env.OPENCLAW_TOKEN || ''; }

// ─── low-level send ──────────────────────────────────────────────────
function rpcSend(method, params, timeoutMs = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return reject(new Error(`[openclaw] ws not open, cannot call ${method}`));
    }
    const id = nextId();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`[openclaw] RPC ${method} timed out (${timeoutMs}ms)`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try {
      ws.send(JSON.stringify({ type: 'req', id, method, params: params || {} }));
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error(`[openclaw] ws.send failed: ${e.message}`));
    }
  });
}

// ─── dispatch incoming messages ──────────────────────────────────────
function dispatch(msg) {
  // RPC response: { type:"res", id, ok, result|error }
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, timer } = pending.get(msg.id);
    clearTimeout(timer);
    pending.delete(msg.id);
    if (msg.ok === false || msg.error) {
      const code = msg.error?.code || msg.error?.errorCode || 'gateway_error';
      const text = msg.error?.message || msg.error?.error || 'Gateway error';
      return reject(new Error(`[openclaw] ${code}: ${text}`));
    }
    return resolve(msg.result ?? msg.payload ?? msg.data ?? null);
  }

  // Stream events — OpenClaw uses { type:"event", event:"agent"|"chat", payload:{...} }
  if (msg.type === 'event') {
    const sk = msg.payload?.sessionKey || msg.params?.sessionKey;
    const stream = sk && streams.get(sk);

    if (msg.event === 'agent' && msg.payload?.stream === 'assistant') {
      // Delta from agent stream
      if (stream) {
        const delta = msg.payload?.data?.delta || '';
        if (delta) stream.chunks.push(delta);
      }
      return;
    }

    if (msg.event === 'chat' && msg.payload?.state === 'final') {
      // Final message — extract full text
      if (stream) {
        clearTimeout(stream.timer);
        const content = msg.payload?.message?.content;
        let fullText = '';
        if (typeof content === 'string') fullText = content;
        else if (Array.isArray(content)) fullText = content.filter(c => c.type === 'text').map(c => c.text).join('');
        else fullText = stream.chunks.join('');
        stream.resolve(fullText);
        streams.delete(sk);
      }
      return;
    }

    if (msg.event === 'agent' && msg.payload?.stream === 'lifecycle' && msg.payload?.data?.phase === 'end') {
      // Lifecycle end — if no chat.final comes, resolve from chunks after short delay
      if (stream && !stream.finalTimer) {
        stream.finalTimer = setTimeout(() => {
          if (streams.has(sk)) {
            clearTimeout(stream.timer);
            stream.resolve(stream.chunks.join(''));
            streams.delete(sk);
          }
        }, 2000);
      }
      return;
    }

    return;
  }
}

// ─── connect / disconnect ────────────────────────────────────────────
async function connect() {
  if (ws && ws.readyState === WebSocket.OPEN && ready) return;
  if (connectingP) return connectingP;

  connectingP = new Promise((resolve, reject) => {
    const url = envUrl();
    const token = envToken();
    if (!token) {
      connectingP = null;
      return reject(new Error('[openclaw] OPENCLAW_TOKEN not set'));
    }

    try {
      ws = new WebSocket(url, { headers: { Origin: url.replace('wss://', 'https://').replace('ws://', 'http://') } });
    } catch (e) {
      connectingP = null;
      return reject(new Error(`[openclaw] ws open failed: ${e.message}`));
    }

    const handshakeTimeout = setTimeout(() => {
      connectingP = null;
      ws?.terminate();
      reject(new Error('[openclaw] handshake timeout (20s)'));
    }, 20000);

    let challengeReceived = false;

    ws.on('open', () => {
      // Wait for connect.challenge event before sending connect request
    });

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }

      // Handle connect.challenge — this is the first message from gateway
      if (!challengeReceived && msg.type === 'event' && msg.event === 'connect.challenge') {
        challengeReceived = true;
        // Send connect request with proper frame format
        const connectId = nextId();
        pending.set(connectId, {
          resolve: () => {
            ready = true;
            clearTimeout(handshakeTimeout);
            connectingP = null;
            console.log('[openclaw] 게이트웨이 연결 성공:', url);
            resolve();
          },
          reject: (err) => {
            clearTimeout(handshakeTimeout);
            connectingP = null;
            reject(err);
          },
          timer: handshakeTimeout
        });
        try {
          ws.send(JSON.stringify({
            type: 'req',
            id: connectId,
            method: 'connect',
            params: {
              client: {
                id: 'openclaw-control-ui',
                displayName: 'Orbitron',
                mode: 'cli',
                version: '1.0.0',
                platform: 'linux'
              },
              auth: { token },
              minProtocol: 3,
              maxProtocol: 3,
              role: 'operator',
              scopes: ['operator.read', 'operator.write', 'operator.admin']
            }
          }));
        } catch (e) {
          clearTimeout(handshakeTimeout);
          connectingP = null;
          reject(new Error(`[openclaw] connect send failed: ${e.message}`));
        }
        return;
      }

      // After challenge, dispatch normally
      dispatch(msg);
    });

    ws.on('error', (e) => {
      console.error('[openclaw] ws error:', e.message);
    });

    ws.on('close', (code, reason) => {
      ready = false;
      connectingP = null;
      const reasonStr = reason ? reason.toString() : 'WebSocket closed';
      for (const { reject: rej, timer } of pending.values()) {
        clearTimeout(timer);
        rej(new Error(`[openclaw] ws closed (${code}): ${reasonStr}`));
      }
      pending.clear();
      for (const stream of streams.values()) {
        clearTimeout(stream.timer);
        stream.reject(new Error(`[openclaw] ws closed: stream interrupted`));
      }
      streams.clear();
    });
  });

  return connectingP;
}

function disconnect() {
  if (ws) {
    try { ws.close(1000, 'client_disconnect'); } catch {}
  }
  ws = null;
  ready = false;
  connectingP = null;
}

async function ensure() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !ready) {
    await connect();
  }
}

// ─── public API ──────────────────────────────────────────────────────

/** List available agents */
async function listAgents() {
  await ensure();
  const res = await rpcSend('agents.list', {});
  return Array.isArray(res?.agents) ? res.agents : Array.isArray(res) ? res : [];
}

/**
 * Send a chat message and collect the full streamed response.
 * Uses sessions.send (OpenClaw native) with chat.send fallback.
 * @param {string} agentId
 * @param {string} sessionKey  full "agent:..." key or short name
 * @param {string} message     user message text
 * @param {number} [timeoutMs=120000]  max wait for entire response
 * @returns {Promise<string>}  complete response text
 */
async function chat(agentId, sessionKey, message, timeoutMs = 120_000) {
  await ensure();

  // Create or reuse session — gateway assigns the actual key
  let actualKey;
  try {
    const created = await rpcSend('sessions.create', { agentId });
    actualKey = created?.key || `agent:${agentId}:${sessionKey}`;
  } catch (e) {
    // Session might already exist or creation not needed — use provided key
    actualKey = sessionKey.startsWith('agent:') ? sessionKey : `agent:${agentId}:${sessionKey}`;
  }

  // Set up stream collector using the actual key
  const streamP = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      streams.delete(actualKey);
      reject(new Error(`[openclaw] chat stream timed out (${timeoutMs}ms)`));
    }, timeoutMs);

    streams.set(actualKey, {
      chunks: [],
      timer,
      finalTimer: null,
      resolve: (text) => { clearTimeout(timer); resolve(text); },
      reject:  (err)  => { clearTimeout(timer); reject(err); },
    });
  });

  // Send message — gateway expects { key, message (string) }
  try {
    await rpcSend('sessions.send', {
      key: actualKey,
      message: message,
    });
  } catch (e) {
    streams.delete(actualKey);
    throw e;
  }

  return streamP;
}

/** Abort an in-progress chat */
async function abort(agentId, sessionKey) {
  await ensure();
  const fullKey = sessionKey.startsWith('agent:') ? sessionKey : `agent:${agentId}:${sessionKey}`;
  const stream = streams.get(fullKey);
  if (stream) {
    clearTimeout(stream.timer);
    streams.delete(fullKey);
  }
  return rpcSend('sessions.abort', { agentId, sessionKey: fullKey });
}

/** Resolve agent id for a project record */
function resolveAgent(project) {
  return (project && project.openclaw_agent_id) || process.env.OPENCLAW_DEFAULT_AGENT || 'main';
}

/** Build a deterministic session key */
function sessionKeyFor(agentId, projectId, feature) {
  return `agent:${agentId}:orbitron-${projectId}-${feature}`;
}

/** Check whether required env vars are present */
function isConfigured() {
  return Boolean(process.env.OPENCLAW_TOKEN);
}

/** Health check: connect + list agents */
async function health() {
  try {
    await connect();
    const agents = await listAgents();
    return { ok: true, agents: agents.length, url: envUrl() };
  } catch (e) {
    return { ok: false, error: e.message, url: envUrl() };
  }
}

module.exports = {
  connect,
  disconnect,
  listAgents,
  chat,
  abort,
  resolveAgent,
  sessionKey: sessionKeyFor,
  isConfigured,
  health,
};
