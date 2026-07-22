const http = require("node:http");
const { createProxyServer } = require("http-proxy");
const { SignJWT, jwtVerify } = require("jose");

const proxy = createProxyServer({ ws: true });
const HTTP_TARGET = "http://127.0.0.1:3102";
const WS_TARGET = "http://127.0.0.1:3103";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET env var is required (set in start.sh via .env)");
  process.exit(1);
}
const secret = new TextEncoder().encode(JWT_SECRET);

// DeskRPG user mapping: twinverse username -> deskrpg user
const USER_MAP = {
  "admin": { userId: "3226067b-e38c-4784-90ab-7492cc309934", nickname: "Twinverse" },
  "limp2004": { userId: "98818019-112c-4b0a-94f5-c4b2bc039a77", nickname: "림프" },
  "sodam2025hl": { userId: "f297eafd-9933-480a-b522-7dbae80e3d21", nickname: "소담이" },
};

// Generate a DeskRPG-compatible JWT
async function makeDeskToken(deskUser) {
  return new SignJWT({ userId: deskUser.userId, nickname: deskUser.nickname })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(secret);
}

// Extract twinverse username from twinverse_token (no verification needed, just decode payload)
function decodeTwinverseToken(cookieHeader) {
  const m = cookieHeader.match(/twinverse_token=([^;]+)/);
  if (!m) return null;
  try {
    const payload = JSON.parse(Buffer.from(m[1].split(".")[1], "base64url").toString());
    return payload.username || null;
  } catch { return null; }
}

// Extract existing deskrpg `token` value (NOT `twinverse_token`)
function extractDeskToken(cookieHeader) {
  const m = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  return m ? m[1] : null;
}

// Verify against our secret. Returns true only if signature + expiry pass.
async function isValidDeskToken(token) {
  if (!token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Strip stale `token=...` from cookie header (keeps twinverse_token + other cookies intact)
function stripDeskToken(cookieHeader) {
  return cookieHeader
    .replace(/(?:^|;)\s*token=[^;]*;?/g, "")
    .replace(/^;\s*/, "")
    .replace(/;\s*$/, "")
    .trim();
}

// Inject deskrpg token into cookie header — but FIRST verify any existing one.
// If existing token is stale/invalid we strip it and replace, so the upstream
// server never sees an invalid token (which used to cause auth:rejected loops
// that the HttpOnly cookie made impossible for the browser to recover from).
async function injectToken(req) {
  const cookies = req.headers.cookie || "";
  const existing = extractDeskToken(cookies);

  if (await isValidDeskToken(existing)) return; // happy path — keep valid token

  // Existing is missing or invalid. Strip it before we look at anything else
  // so even if we cannot mint a fresh one (no twinverse_token / no USER_MAP),
  // the server at least sees a clean state instead of a half-broken token.
  const cleaned = stripDeskToken(cookies);

  const username = decodeTwinverseToken(cleaned);
  if (!username) {
    req.headers.cookie = cleaned;
    return;
  }

  const deskUser = USER_MAP[username];
  if (!deskUser) {
    console.error(`[proxy] WARN MISSING USER_MAP entry for TwinverseAI user "${username}". Add to USER_MAP and restart proxy.js. (Available keys: ${Object.keys(USER_MAP).join(", ")})`);
    req.headers.cookie = cleaned;
    return;
  }

  const token = await makeDeskToken(deskUser);
  req.headers.cookie = (cleaned ? cleaned + "; " : "") + "token=" + token;
  console.log(`[proxy] ${existing ? "Replaced stale" : "Injected"} DeskRPG token for: ${username} -> ${deskUser.nickname}`);
}

proxy.on("error", (err, req, res) => {
  console.error("[proxy:error]", err.message, req.url);
});

const server = http.createServer(async (req, res) => {
  const target = req.url?.startsWith("/socket.io") ? WS_TARGET : HTTP_TARGET;
  if (req.url?.startsWith("/socket.io")) {
    await injectToken(req);
  }
  proxy.web(req, res, { target }, (err) => {
    console.error("[proxy:web-err]", err.message, req.url);
    res.writeHead(502);
    res.end("Bad Gateway");
  });
});

server.on("upgrade", async (req, socket, head) => {
  await injectToken(req);
  proxy.ws(req, socket, head, { target: WS_TARGET }, (err) => {
    console.error("[proxy:ws-err]", err.message);
    socket.destroy();
  });
});

server.listen(3100, "0.0.0.0", () => {
  console.log("[proxy] Listening on 0.0.0.0:3100 (with token verify+inject)");
});
