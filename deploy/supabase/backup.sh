#!/bin/sh
# Backup locale completo dello stack dedicato My ai. Eseguire come root sul LXC 105.
set -eu
umask 077
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
DEST="$ROOT/backups/$STAMP"
mkdir -p "$DEST"
chmod 700 "$ROOT/backups" "$DEST"

if [ ! -f .env ]; then
  echo "ERRORE: $ROOT/.env assente" >&2
  exit 1
fi
if [ "$(stat -c %a .env)" != "600" ]; then
  echo "ERRORE: .env deve avere permessi 600" >&2
  exit 1
fi

echo "[1/5] Dump PostgreSQL applicativo..."
# My ai usa questi schemi applicativi. Le estensioni sono dipendenze ricreabili e
# non vanno eliminate durante un restore nello stack completo.
docker compose exec -T db pg_dump -U supabase_admin -d postgres -Fc --no-owner \
  --schema=auth --schema=storage --schema=public > "$DEST/postgres.dump"
docker compose exec -T db psql -U supabase_admin -d postgres -Atc \
  "select extname || '=' || extversion from pg_extension where extname in ('vector','pg_trgm','pgcrypto','pgjwt','uuid-ossp') order by extname;" \
  > "$DEST/extensions.txt"

echo "[2/5] Archivio Storage..."
STORAGE_MOUNT=$(docker volume inspect -f '{{.Mountpoint}}' myai-supabase_storage-data)
tar --numeric-owner -C "$STORAGE_MOUNT" -czf "$DEST/storage.tar.gz" .

echo "[3/5] Configurazione e segreti protetti..."
tar -czf "$DEST/config.tar.gz" compose.yml kong.yml generate_env.py status.py backup.sh verify-backup.sh README.md init migrations
install -m 600 .env "$DEST/stack.env"

echo "[4/5] Metadati e checksum..."
{
  date -u '+created_utc=%Y-%m-%dT%H:%M:%SZ'
  echo 'compose_project=myai-supabase'
  echo 'database_image=supabase/postgres:15.8.1.085'
  echo 'database_schemas=auth,storage,public'
  echo 'database_extension_dependencies=see extensions.txt'
  echo 'restore_requires_same_stack_env=true'
} > "$DEST/manifest.txt"
chmod 600 "$DEST"/*
(
  cd "$DEST"
  sha256sum postgres.dump storage.tar.gz config.tar.gz stack.env extensions.txt manifest.txt > SHA256SUMS
)
ln -sfn "$STAMP" "$ROOT/backups/latest"

echo "[5/5] Verifica dump..."
docker compose exec -T db pg_restore --list < "$DEST/postgres.dump" >/dev/null

echo "Backup completato: $DEST"
echo "NOTA: è sullo stesso LXC; copiarlo anche fuori host per disaster recovery."
