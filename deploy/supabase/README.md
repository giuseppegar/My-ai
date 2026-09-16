# Runbook — Supabase dedicato di My ai

Questa è l'istanza **self-hosted separata** usata esclusivamente da My ai. Non è il Supabase originale delle altre applicazioni.

## Identità e indirizzi

| Voce | Valore |
|---|---|
| Host Proxmox | LXC 105 `supabase`, IP `192.168.1.17` |
| Accesso SSH dal Mac | `ssh supabase` |
| Directory server | `/opt/myai-supabase` |
| Progetto Docker Compose | `myai-supabase` |
| API LAN/Tailscale | `http://192.168.1.17:8010` |
| App pubblica | `https://myai.terraleonum.com` |
| App alternativa | `https://myai.terraleonum.duckdns.org` |
| Sorgenti/config senza segreti sul Mac | `deploy/supabase/` |

L'API Supabase **non è pubblicata tramite NPM**: viene raggiunta dal server Next.js sulla LAN. Dal browser pubblico si passa sempre attraverso il BFF di My ai.

## Componenti

Lo stack minimale contiene cinque servizi indipendenti dallo stack preesistente:

- `db`: PostgreSQL 15.8;
- `auth`: GoTrue 2.185;
- `rest`: PostgREST 14.3;
- `storage`: Storage API 1.37;
- `gateway`: Kong 2.8 sulla porta 8010.

Volumi persistenti:

- `myai-supabase_db-data` — database, Auth e metadati Storage;
- `myai-supabase_db-config` — configurazione interna PostgreSQL;
- `myai-supabase_storage-data` — contenuto fisico dei file.

**Non eseguire mai `docker compose down -v`**: `-v` elimina i dati. `docker compose stop`, `restart`, `down` senza `-v` e `up -d` conservano i volumi.

## Accesso e stato

```bash
ssh supabase
cd /opt/myai-supabase
python3 status.py
```

`status.py` controlla container, marcatore d'istanza, Auth, conteggi, HTTPS e ultimo backup senza mostrare chiavi o email.

Comandi manuali:

```bash
docker compose ps
docker compose logs --tail=100 auth
docker compose logs --tail=100 rest storage gateway
docker compose up -d
docker compose restart gateway
```

### Accesso SQL

Non esiste una porta PostgreSQL pubblica: si accede solo dentro il container.

```bash
ssh supabase
cd /opt/myai-supabase
docker compose exec db psql -U postgres -d postgres
```

Esempi in sola lettura:

```sql
\dt public.myai_*
select count(*) from auth.users;
select count(*) from public.myai_memories;
select id, name, public from storage.buckets;
select public.myai_instance_id();
```

Uscita da `psql`: `\q`.

### Supabase Studio

Questo stack minimale **non include Supabase Studio**. Per amministrare si usano `psql`, i comandi sopra e le API. Studio si può aggiungere in seguito, ma non va esposto direttamente a internet.

## Configurazione e segreti

I valori reali sono memorizzati esclusivamente in:

- LXC 105: `/opt/myai-supabase/.env` (`600`, proprietario root);
- LXC 110: `/opt/my-ai/.env` (`600`, usato solo dal server Next.js);
- Mac sviluppo: `/Users/macair/developer/My ai/.env.local` (`600`, ignorato da git).

Mappatura tra stack e applicazione:

| Stack Supabase | Applicazione My ai |
|---|---|
| `SUPABASE_PUBLIC_URL` | `SUPABASE_URL` |
| `ANON_KEY` | `SUPABASE_ANON_KEY` |
| `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |
| `MYAI_INSTANCE_ID` | `SUPABASE_INSTANCE_ID` |

`SERVICE_ROLE_KEY`, `JWT_SECRET` e `POSTGRES_PASSWORD` non devono mai finire nel browser, in screenshot, wiki, messaggi o log. La service-role è usata dal BFF esclusivamente per eliminare un account sullo stack dedicato. Per vedere/modificare il file sul server usare una sessione SSH privata (`vi /opt/myai-supabase/.env`); non incollarne l'output in chat.

Il BFF verifica `MYAI_INSTANCE_ID` tramite la funzione pubblica non segreta `myai_instance_id()` **prima** di leggere cookie o accedere ad Auth/dati. Una configurazione verso lo stack sbagliato viene quindi bloccata.

## Avvio, arresto e modifiche

```bash
ssh supabase
cd /opt/myai-supabase

docker compose stop                 # arresta, dati conservati
docker compose up -d --wait         # avvia e attende healthcheck
docker compose restart gateway      # dopo modifiche a kong.yml
docker compose up -d --force-recreate auth  # dopo APP_URL/parametri Auth
python3 status.py
```

Prima di modificare `compose.yml`, `kong.yml` o `.env`:

```bash
./backup.sh
docker compose config --quiet
```

## Migrazioni database

Le migrazioni versionate sono in `/opt/myai-supabase/migrations/` e nel progetto Mac in `supabase/migrations/`.

La migrazione iniziale `202609110001_my_ai.sql` è già applicata e contiene istruzioni non idempotenti: **non rieseguirla alla cieca**. Per una nuova migrazione:

```bash
cd /opt/myai-supabase
./backup.sh
docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -f /dev/stdin < migrations/NOME_NUOVA_MIGRAZIONE.sql
docker compose exec -T db psql -U postgres -d postgres \
  -c "NOTIFY pgrst, 'reload schema';"
python3 status.py
```

Non applicare mai migrazioni My ai al container `supabase-db` dello stack originale.

### Ultima applicazione verificata — 14 settembre 2026

- Applicate `202609140001_auto_memories.sql` e `202609140002_videos.sql` nella stessa transazione, con `lock_timeout=5s`, `statement_timeout=60s` e reload dello schema PostgREST al commit. **Non rieseguirle**: colonne, constraint e trigger sono già presenti.
- Backup precedente: `/opt/myai-supabase/backups/20260914T053145Z`. Ripristino in database temporaneo riuscito (database di prova eliminato) e checksum verificati. Copia fuori LXC sul Mac: `deploy/supabase/backups/20260914T053145Z`, directory `700`, file `600`, ignorata da git.
- Controllati RLS della tabella video, funzioni RPC non accessibili ad `anon`, bucket ancora privato e nuovi limiti MP4. Dati preesistenti e container invariati; gli altri stack non sono stati modificati.
- Collaudo del codice locale sul database reale: 79 e2e passate e 2 prove AI a pagamento saltate. AI simulata su loopback, HTTPS locale per mantenere cookie `Secure` anche su Safari. Tutte le fixture sono state rimosse. Anche accesso e navigazione sul frontend pubblico precedente sono verificati.
- Il nuovo codice frontend/API è stato pubblicato su LXC 110 il 14 settembre 2026 (rollback immagine `my-ai:before-autosave-video`, sorgenti in `/opt/my-ai-release-backups/source-before-autosave-video-20260914T064124Z.tar.gz`): da quel momento domanda e risposta vengono collegate con `reply_to_id`. Generazione video **abilitata** lo stesso giorno (`VIDEO_ENABLED=true`, `veo-3.1-lite`, 4 s, 720p, senza audio) e collaudata con una generazione reale da 0,12 USD.
- Collaudo dopo la pubblicazione: 71 prove superate, 10 saltate, 0 fallite sul dominio pubblico, con health HTTPS su entrambi i domini e conteggi dati invariati.

## Backup

Eseguire:

```bash
ssh supabase
cd /opt/myai-supabase
./backup.sh
```

Ogni backup viene salvato in `/opt/myai-supabase/backups/<UTC>/` (permessi root-only) e contiene:

- `postgres.dump` — dati e struttura degli schemi applicativi `auth`, `storage`, `public` in formato custom;
- `extensions.txt` — nomi e versioni delle dipendenze PostgreSQL;
- `storage.tar.gz` — file del bucket;
- `config.tar.gz` — compose, Kong, script e migrazioni;
- `stack.env` — segreti necessari al ripristino, protetti `600`;
- `SHA256SUMS` e `manifest.txt`.

`backups/latest` punta all'ultimo snapshot. Verificare realmente il ripristino, senza toccare il database live:

```bash
./verify-backup.sh                    # ultimo backup
./verify-backup.sh backups/UTC        # backup specifico
```

`verify-backup.sh` restaura il dump in un database temporaneo, controlla identità e bucket, quindi lo elimina. Il backup sullo stesso LXC protegge dagli errori applicativi, **non** dalla perdita del nodo Proxmox: mantenere anche una copia root-only fuori da LXC 105.

## Ripristino (procedura di emergenza)

1. Non ripristinare mai sullo stack condiviso o senza aver verificato il marcatore My ai.
2. Preparare uno stack vuoto con le stesse versioni e ripristinare `stack.env` come `.env` (`chmod 600`). Il segreto JWT deve corrispondere al database restaurato.
3. Avviare solo `db` e attendere l'inizializzazione:

   ```bash
   docker compose up -d db
   docker compose exec -T db pg_isready -U postgres
   ```

4. Fermare gli altri servizi, verificare/creare le estensioni e restaurare il dump nel database dedicato:

   ```bash
   docker compose stop auth rest storage gateway
   docker compose exec -T db psql -U supabase_admin -d postgres \
     -v ON_ERROR_STOP=1 -c 'create schema if not exists extensions' \
     -c 'create extension if not exists vector with schema extensions' \
     -c 'create extension if not exists pg_trgm with schema extensions' \
     -c 'create extension if not exists pgcrypto with schema extensions' \
     -c 'create extension if not exists pgjwt with schema extensions' \
     -c 'create extension if not exists "uuid-ossp" with schema extensions'
   docker compose exec -T db pg_restore -U supabase_admin -d postgres \
     --clean --if-exists --no-owner --exit-on-error < backups/UTC/postgres.dump
   ```

5. Restaurare i file a Storage fermo:

   ```bash
   STORAGE_MOUNT=$(docker volume inspect -f '{{.Mountpoint}}' myai-supabase_storage-data)
   tar -C "$STORAGE_MOUNT" -xzf backups/UTC/storage.tar.gz
   ```

6. Avviare e verificare:

   ```bash
   docker compose up -d --wait
   docker compose exec -T db psql -U supabase_admin -d postgres \
     -c "NOTIFY pgrst, 'reload schema';"
   python3 status.py
   ```

Il dump deve essere creato e ripristinato con `supabase_admin`: nell'immagine self-hosted il ruolo `postgres` non è superuser. Sono inclusi esclusivamente gli schemi che contengono dati e struttura di My ai (`auth`, `storage`, `public`). Le estensioni (`vector`, `pg_trgm`, `pgcrypto`, `pgjwt`, `uuid-ossp`) sono elencate con versione e vengono ricreate prima del restore; non vengono eliminate, così Vault/GraphQL dello stack completo non perdono dipendenze. Realtime e Analytics restano componenti ricreabili esclusi dal dump. Provare sempre il ripristino su uno stack o database temporaneo prima di affidarsi alla procedura in emergenza.

## Applicazione e reverse proxy

Frontend Next.js:

```bash
ssh docker
cd /opt/my-ai
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 my-ai
```

NPM inoltra entrambi i domini a `http://my-ai:3000` tramite DNS Docker sulla rete `homelab` (non a un IP di container variabile). Force SSL, HTTP/2, Websocket e Block Exploits sono attivi. I certificati Let's Encrypt si rinnovano automaticamente.

NPM: `http://192.168.1.61:81` in LAN. Il backup coerente finale è in `/opt/nginxproxymanager/data/database.sqlite.bak-myai-online-latest`.

## Verifiche rapide dall'esterno

```bash
curl -I http://myai.terraleonum.com/api/health       # deve fare 301 verso HTTPS
curl -fsS https://myai.terraleonum.com/api/health    # {"ok":true,...}
curl -fsS https://myai.terraleonum.duckdns.org/api/health
```

Per una verifica completa (account, RLS, memoria, file e pulizia) dal Mac:

```bash
cd '/Users/macair/developer/My ai'
python3 scripts/smoke-isolation.py
npm test
npx playwright test
```
