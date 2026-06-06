#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_ROOT="${1:-"$ROOT_DIR/backups/local"}"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

POSTGRES_CONTAINER="docker-postgres-1"
MINIO_CONTAINER="docker-minio-1"

mkdir -p "$BACKUP_DIR"

if ! docker ps --format '{{.Names}}' | grep -qx "$POSTGRES_CONTAINER"; then
  echo "Postgres container '$POSTGRES_CONTAINER' is not running." >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$MINIO_CONTAINER"; then
  echo "MinIO container '$MINIO_CONTAINER' is not running." >&2
  exit 1
fi

echo "Writing backup to $BACKUP_DIR"

docker exec "$POSTGRES_CONTAINER" pg_dump \
  -U openpims \
  -d openpims \
  --format=custom \
  --no-owner \
  --no-acl \
  > "$BACKUP_DIR/postgres-openpims.dump"

TMP_MINIO_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_MINIO_DIR"' EXIT

docker cp "$MINIO_CONTAINER:/data/." "$TMP_MINIO_DIR/"
tar -czf "$BACKUP_DIR/minio-data.tgz" -C "$TMP_MINIO_DIR" .

cat > "$BACKUP_DIR/manifest.txt" <<MANIFEST
created_at=$TIMESTAMP
postgres_container=$POSTGRES_CONTAINER
postgres_database=openpims
minio_container=$MINIO_CONTAINER
minio_archive=minio-data.tgz
MANIFEST

echo "Backup complete:"
echo "  $BACKUP_DIR/postgres-openpims.dump"
echo "  $BACKUP_DIR/minio-data.tgz"
