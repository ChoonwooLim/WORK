#!/bin/bash
# ============================================
# WRA Database Sync: Render.com → Local
# ============================================
# Usage:
#   ./sync-db.sh              # Full sync (drop & restore)
#   ./sync-db.sh --schema     # Schema only (no data)
#   ./sync-db.sh --backup     # Backup only (no restore)
# ============================================

set -e

# --- Configuration ---
RENDER_DB_URL="postgresql://wra_database_user:JbPs6YvLPgGtF5WqMSojt9qmshT0ZYD4@dpg-d62aqffgi27c73d34s8g-a.singapore-postgres.render.com/wra_database"
LOCAL_DB_USER="devuser"
LOCAL_DB_NAME="wra_db"
LOCAL_CONTAINER="dev-postgres"

BACKUP_DIR="/home/stevenlim/WORK/orbitron/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="wra_render_${TIMESTAMP}.sql"

# --- Colors ---
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[SYNC]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

mkdir -p "$BACKUP_DIR"

# --- Parse args ---
MODE="full"
[ "$1" == "--schema" ] && MODE="schema"
[ "$1" == "--backup" ] && MODE="backup"

# --- Step 1: Dump from Render.com (using pg_dump inside Docker) ---
log "📥 Dumping from Render.com..."

DUMP_OPTS="--no-owner --no-acl"
[ "$MODE" == "schema" ] && DUMP_OPTS="$DUMP_OPTS --schema-only"

/usr/lib/postgresql/18/bin/pg_dump "$RENDER_DB_URL" $DUMP_OPTS -f "${BACKUP_DIR}/${BACKUP_FILE}" 2>&1

FILESIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
log "✅ Dump complete (${FILESIZE})"

if [ "$MODE" == "backup" ]; then
    log "📦 Backup saved: ${BACKUP_DIR}/${BACKUP_FILE}"
    exit 0
fi

# --- Step 2: Restore to local DB ---
log "🔄 Restoring to local database (${LOCAL_DB_NAME})..."

# Terminate existing connections & recreate DB
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${LOCAL_DB_NAME}' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true

docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d postgres -c "DROP DATABASE IF EXISTS ${LOCAL_DB_NAME};"
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d postgres -c "CREATE DATABASE ${LOCAL_DB_NAME} OWNER ${LOCAL_DB_USER};"

# Restore
docker exec -i "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" < "${BACKUP_DIR}/${BACKUP_FILE}" 2>&1 | grep -v "^$" | tail -5

log "✅ Restore complete!"

# --- Step 3: Verify ---
log "📊 Tables:"
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c \
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name;"

log "📊 Row counts:"
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c \
    "SELECT 'User' as tbl, count(*) FROM \"User\" UNION ALL SELECT 'Post', count(*) FROM \"Post\" UNION ALL SELECT 'Account', count(*) FROM \"Account\";" 2>/dev/null || warn "Some tables may not exist yet"

# Cleanup old backups (keep last 5)
ls -t "${BACKUP_DIR}"/wra_render_*.sql 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true

log ""
log "🎉 Sync complete! Render.com → Local"
log "   Backup: ${BACKUP_DIR}/${BACKUP_FILE}"
