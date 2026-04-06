#!/bin/bash
# DeskRPG 서버 시작 스크립트 (Orbitron용)
# 사용법: bash start.sh

set -e

DESKRPG_DIR="$HOME/.deskrpg"
LOG_DIR="$DESKRPG_DIR/logs"

# nvm 로드
source "$HOME/.nvm/nvm.sh"

mkdir -p "$LOG_DIR"

# 기존 프로세스 종료
echo "[start] 기존 DeskRPG 프로세스 종료 중..."
pkill -f "node.*proxy.js" 2>/dev/null || true
pkill -f "deskrpg start" 2>/dev/null || true
sleep 2

# DeskRPG 서버 시작 (포트 3102, Socket.IO 3103)
echo "[start] DeskRPG 서버 시작 (3102/3103)..."
cd "$DESKRPG_DIR"
DB_TYPE=postgres \
DATABASE_URL="postgresql://orbitron_user:orbitron_db_pass@localhost:3718/deskrpg" \
INTERNAL_HOSTNAME=0.0.0.0 \
nohup npx deskrpg start -p 3102 > "$LOG_DIR/server.log" 2>&1 &

# 서버 준비 대기
echo "[start] 서버 준비 대기 중..."
sleep 8

# 프록시 시작 (포트 3100 → 3102 HTTP + 3103 WebSocket)
echo "[start] 프록시 시작 (3100)..."
nohup node "$DESKRPG_DIR/proxy.js" > "$LOG_DIR/proxy.log" 2>&1 &
sleep 2

# 상태 확인
echo ""
echo "=== DeskRPG 서비스 상태 ==="
echo "프록시:    $(ss -tlnp | grep ':3100 ' > /dev/null && echo 'OK (3100)' || echo 'FAIL')"
echo "HTTP:      $(ss -tlnp | grep ':3102 ' > /dev/null && echo 'OK (3102)' || echo 'FAIL')"
echo "Socket.IO: $(ss -tlnp | grep ':3103 ' > /dev/null && echo 'OK (3103)' || echo 'FAIL')"
echo ""
echo "Cloudflare Tunnel → localhost:3100 → proxy → 3102(HTTP) + 3103(WS)"
echo "URL: https://deskrpg.twinverse.org"
