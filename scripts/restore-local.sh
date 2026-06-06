#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${1:-}"

POSTGRES_CONTAINER="docker-postgres-1"
MINIO_CONTAINER="docker-minio-1"

if [[ -z "$BACKUP_DIR" ]]; then
  echo "Usage: pnpm backup:restore <backup-dir>" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_DIR/postgres-openpims.dump" ]]; then
  echo "Missing $BACKUP_DIR/postgres-openpims.dump" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_DIR/minio-data.tgz" ]]; then
  echo "Missing $BACKUP_DIR/minio-data.tgz" >&2
  exit 1
fi

if [[ "${VETFLOW_RESTORE_CONFIRM:-}" != "restore-local-data" ]]; then
  cat >&2 <<'WARNING'
Refusing to restore without confirmation.

This overwrites the local Docker Postgres database and MinIO object store.
Run again with:

  VETFLOW_RESTORE_CONFIRM=restore-local-data pnpm backup:restore <backup-dir>
WARNING
  exit 1
fi

cd "$ROOT_DIR"
docker compose -f docker/docker-compose.yml up -d postgres minio

if ! docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
  echo "Postgres container '$POSTGRES_CONTAINER' is not running." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER"; then
  echo "MinIO container '$MINIO_CONTAINER' is not running." >&2
  exit 1
fi

echo "Restoring Postgres from $BACKUP_DIR/postgres-openpims.dump"
docker exec "$POSTGRES_CONTAINER" psql -U openpims -d openpims -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA IF EXISTS public CASCADE;' \
  -c 'CREATE SCHEMA public;' \
  -c 'DROP SCHEMA IF EXISTS drizzle CASCADE;'

docker exec -i "$POSTGRES_CONTAINER" pg_restore \
  -U openpims \
  -d openpims \
  --no-owner \
  --no-acl \
  < "$BACKUP_DIR/postgres-openpims.dump"

echo "Restoring MinIO data from $BACKUP_DIR/minio-data.tgz"
docker exec "$MINIO_CONTAINER" sh -c 'rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true'

TMP_MINIO_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_MINIO_DIR"' EXIT
tar -xzf "$BACKUP_DIR/minio-data.tgz" -C "$TMP_MINIO_DIR"
docker cp "$TMP_MINIO_DIR/." "$MINIO_CONTAINER:/data/"

echo "Restore complete."
