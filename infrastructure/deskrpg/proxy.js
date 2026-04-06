const http = require("node:http");
const { createProxyServer } = require("http-proxy");

const proxy = createProxyServer({ ws: true });
const HTTP_TARGET = "http://127.0.0.1:3102";
const WS_TARGET = "http://127.0.0.1:3103";

const server = http.createServer((req, res) => {
  const target = req.url?.startsWith("/socket.io") ? WS_TARGET : HTTP_TARGET;
  proxy.web(req, res, { target }, (err) => {
    res.writeHead(502);
    res.end("Bad Gateway");
  });
});

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head, { target: WS_TARGET }, (err) => {
    socket.destroy();
  });
});

server.listen(3100, "0.0.0.0", () => {
  console.log("[proxy] Listening on 0.0.0.0:3100 → HTTP:3102, WS:3103");
});
