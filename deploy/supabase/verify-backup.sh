#!/bin/sh
# Ripristino di prova in un database temporaneo; non modifica il database live.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$ROOT"
SOURCE=${1:-"$ROOT/backups/latest"}
DUMP="$SOURCE/postgres.dump"
if [ ! -f "$DUMP" ]; then
  echo "ERRORE: dump non trovato: $DUMP" >&2
  exit 1
fi
DB="myai_restore_check_$$"
cleanup() {
  docker compose exec -T db dropdb -U supabase_admin --if-exists --force "$DB" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker compose exec -T db createdb -U supabase_admin -T template0 "$DB"
docker compose exec -T db psql -U supabase_admin -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgjwt with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
SQL
docker compose exec -T db pg_restore -U supabase_admin -d "$DB" \
  --clean --if-exists --no-owner --exit-on-error < "$DUMP"
RESULT=$(docker compose exec -T db psql -U supabase_admin -d "$DB" -v ON_ERROR_STOP=1 -Atc \
  "select (public.myai_instance_id() is not null) and exists (select 1 from storage.buckets where id='myai-private');")
if [ "$RESULT" != "t" ]; then
  echo "ERRORE: verifica logica del ripristino fallita" >&2
  exit 1
fi
printf 'Ripristino di prova riuscito; database temporaneo %s rimosso.\n' "$DB"
