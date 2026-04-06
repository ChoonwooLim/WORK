#!/bin/bash
# DeskRPG 서버 중지 스크립트
echo "[stop] DeskRPG 프로세스 종료 중..."
pkill -f "node.*proxy.js" 2>/dev/null || true
pkill -f "deskrpg start" 2>/dev/null || true
sleep 2
echo "[stop] 포트 확인..."
ss -tlnp | grep -E ':310[0-3] ' && echo "경고: 일부 포트가 아직 사용 중" || echo "모든 포트 해제됨"
