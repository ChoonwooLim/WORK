#!/bin/bash
# Auto-restart cloudflared tunnel for DevDeploy dashboard
# Usage: ./tunnel-dashboard.sh [port]

PORT=${1:-4000}

echo "🔗 Starting cloudflared tunnel for port $PORT..."

while true; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') Starting cloudflared tunnel..."
    /tmp/cloudflared tunnel --url http://localhost:$PORT --no-autoupdate 2>&1
    EXIT_CODE=$?
    echo "$(date '+%Y-%m-%d %H:%M:%S') Tunnel exited with code $EXIT_CODE. Restarting in 3 seconds..."
    sleep 3
done
