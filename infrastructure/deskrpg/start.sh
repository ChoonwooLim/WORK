#!/bin/bash
source ~/.nvm/nvm.sh
cd ~/.deskrpg

DESKRPG_SOURCE=/home/stevenlim/WORK/deskrpg

# Stop existing DeskRPG processes
fuser -k 3100/tcp 2>/dev/null
fuser -k 3102/tcp 2>/dev/null
fuser -k 3103/tcp 2>/dev/null
sleep 2

# Ensure log directory exists
mkdir -p logs

# Secrets (JWT_SECRET, DATABASE_URL) live in the untracked .env next to this script.
# JWT_SECRET is shared by deskrpg server AND proxy (proxy verifies tokens — must match).
ENV_FILE="$(dirname "$(readlink -f "$0")")/.env"
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: $ENV_FILE not found (must define JWT_SECRET, DATABASE_URL)" >&2
    exit 1
fi
set -a
source "$ENV_FILE"
set +a

# Start DeskRPG from local clone (port 3102 HTTP, 3103 Socket.IO)
DB_TYPE=postgres \
INTERNAL_HOSTNAME=0.0.0.0 \
COOKIE_SECURE=false \
nohup node "$DESKRPG_SOURCE/bin/deskrpg.js" start -p 3102 > logs/server.log 2>&1 &

# Wait for DeskRPG to be ready
sleep 10

# Start proxy (port 3100 -> 3102/3103)
nohup node proxy.js > logs/proxy.log 2>&1 &

echo "DeskRPG started from $DESKRPG_SOURCE on :3102/:3103, proxy on :3100"
