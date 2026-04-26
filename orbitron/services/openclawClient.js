/**
 * OpenClaw WebSocket RPC client (Node.js / Orbitron)
 *
 * Singleton client that talks to the OpenClaw gateway via JSON-RPC over WebSocket.
 * Protocol reference: deployments/openclaw-ai/frontend/src/lib/openclaw-client.js
 *
 * Env vars:
 *   OPENCLAW_WS_URL          (default: wss://openclaw.twinverse.org)
 *   OPENCLAW_TOKEN            gateway auth token
 *   OPENCLAW_DEFAULT_AGENT    fallback agent id
 */

const WebSocket = require('ws');

const PROTOCOL_VERSION = 3;
const REQUEST_TIMEOUT_MS = 30_000;

// ─── state ───────────────────────────────────────────────────────────
let ws = null;
let requestSeq = 0;
const pending = new Map();   // id -> { resolve, reject, timer }
const streams = new Map();   // sessionKey -> { resolve, reject, chunks }
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
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error(`[openclaw] ws.send failed: ${e.message}`));
    }
  });
}

// ─── dispatch incoming messages ──────────────────────────────────────
function dispatch(msg) {
  // RPC response
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, timer } = pending.get(msg.id);
    clearTimeout(timer);
    pending.delete(msg.id);
    if (msg.error) {
      const code = msg.error.code || msg.error.errorCode || 'gateway_error';
      const text = msg.error.message || msg.error.error || 'Gateway error';
      return reject(new Error(`[openclaw] ${code}: ${text}`));
    }
    return resolve(msg.result ?? msg.data ?? null);
  }

  // Streaming events
  if (msg.method === 'chat.delta') {
    const sk = msg.params?.sessionKey;
    const stream = sk && streams.get(sk);
    if (stream) {
      const delta = msg.params?.delta ?? msg.params?.text ?? '';
      if (delta) stream.chunks.push(delta);
    }
    return;
  }
  if (msg.method === 'chat.done') {
    const sk = msg.params?.sessionKey;
    const stream = sk && streams.get(sk);
    if (stream) {
      stream.resolve(stream.chunks.join(''));
      streams.delete(sk);
    }
    return;
  }
  if (msg.method === 'chat.error') {
    const sk = msg.params?.sessionKey;
    const stream = sk && streams.get(sk);
    if (stream) {
      const code = msg.params?.code || 'chat_error';
      const text = msg.params?.message || 'chat error';
      stream.reject(new Error(`[openclaw] ${code}: ${text}`));
      streams.delete(sk);
    }
    return;
  }
  // other notifications silently ignored
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
      ws = new WebSocket(url);
    } catch (e) {
      connectingP = null;
      return reject(new Error(`[openclaw] ws open failed: ${e.message}`));
    }

    ws.on('open', async () => {
      try {
        // hello (some instances may ignore this)
        await rpcSend('hello', {
          protocolVersion: PROTOCOL_VERSION,
          client_id: 'orbitron',
          client_mode: 'cli',
          role: 'operator',
          scopes: ['operator.read', 'operator.write', 'operator.admin'],
        }).catch(() => {});

        await rpcSend('auth.token', { token });
        ready = true;
        connectingP = null;
        resolve();
      } catch (e) {
        connectingP = null;
        reject(e);
      }
    });

    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      dispatch(msg);
    });

    ws.on('error', (e) => {
      console.error('[openclaw] ws error:', e.message);
    });

    ws.on('close', (code, reason) => {
      ready = false;
      const reasonStr = reason ? reason.toString() : 'WebSocket closed';
      // reject all pending RPCs
      for (const { reject: rej, timer } of pending.values()) {
        clearTimeout(timer);
        rej(new Error(`[openclaw] ws closed (${code}): ${reasonStr}`));
      }
      pending.clear();
      // reject all pending streams
      for (const stream of streams.values()) {
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
 * @param {string} agentId
 * @param {string} sessionKey  full "agent:..." key or short name
 * @param {string} message     user message text
 * @param {number} [timeoutMs=120000]  max wait for entire response
 * @returns {Promise<string>}  complete response text
 */
async function chat(agentId, sessionKey, message, timeoutMs = 120_000) {
  await ensure();
  const fullKey = sessionKey.startsWith('agent:') ? sessionKey : `agent:${agentId}:${sessionKey}`;

  // set up stream collector
  const streamP = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      streams.delete(fullKey);
      reject(new Error(`[openclaw] chat stream timed out (${timeoutMs}ms)`));
    }, timeoutMs);

    streams.set(fullKey, {
      chunks: [],
      resolve: (text) => { clearTimeout(timer); resolve(text); },
      reject:  (err)  => { clearTimeout(timer); reject(err); },
    });
  });

  // send RPC (ack comes first, then deltas, then done)
  await rpcSend('chat.send', {
    sessionKey: fullKey,
    agentId,
    message: { text: message },
  });

  return streamP;
}

/** Abort an in-progress chat */
async function abort(agentId, sessionKey) {
  await ensure();
  const fullKey = sessionKey.startsWith('agent:') ? sessionKey : `agent:${agentId}:${sessionKey}`;
  streams.delete(fullKey);
  return rpcSend('chat.abort', { sessionKey: fullKey });
}

/** Resolve agent id for a project record */
function resolveAgent(project) {
  return (project && project.openclaw_agent_id) || process.env.OPENCLAW_DEFAULT_AGENT || null;
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
