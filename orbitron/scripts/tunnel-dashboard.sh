#!/bin/bash
# stevenhub.loca.lt 터널 유지 스크립트
# localtunnel이 끊기면 자동으로 재접속합니다.

SUBDOMAIN="stevenhub"
PORT=4000
MAX_RETRIES=0  # 0 = 무한 재시도
RETRY_DELAY=3

echo "🔗 Starting localtunnel: ${SUBDOMAIN}.loca.lt -> localhost:${PORT}"

while true; do
    npx -y localtunnel --port "$PORT" --subdomain "$SUBDOMAIN" --local-host 127.0.0.1
    EXIT_CODE=$?
    echo "⚠️ Tunnel exited (code $EXIT_CODE). Restarting in ${RETRY_DELAY}s..."
    sleep "$RETRY_DELAY"
done
