---
title: Operatività My ai e Supabase dedicato
---

# Operatività My ai e Supabase dedicato

## Stato

My ai è online su:

- https://myai.terraleonum.com
- https://myai.terraleonum.duckdns.org

Il frontend Next.js gira nel container `my-ai` su LXC 110 e NPM lo raggiunge tramite DNS Docker stabile `my-ai:3000` sulla rete `homelab`. Force SSL, HTTP/2, Websocket e certificati Let's Encrypt sono verificati.

## Nuovo Supabase dedicato

- Host: LXC 105, IP LAN `192.168.1.17`, alias SSH `supabase`.
- Directory: `/opt/myai-supabase`.
- API LAN/Tailscale: `http://192.168.1.17:8010`.
- Progetto Compose: `myai-supabase`.
- Servizi: `db`, `auth`, `rest`, `storage`, `gateway`.
- Volumi: `myai-supabase_db-data`, `myai-supabase_db-config`, `myai-supabase_storage-data`.
- Non include Supabase Studio e non è pubblicato direttamente su Internet; l'accesso pubblico passa dal BFF Next.js.

Accesso operativo:

```bash
ssh supabase
cd /opt/myai-supabase
python3 status.py
docker compose exec db psql -U postgres -d postgres
```

Non eseguire mai `docker compose down -v` e non rieseguire alla cieca la migrazione iniziale non idempotente.

## Configurazione e segreti

I valori reali non sono nella wiki. Sono conservati con permessi 600 in:

- `/opt/myai-supabase/.env` sul LXC 105;
- `/opt/my-ai/.env` sul LXC 110;
- `/Users/macair/developer/My ai/.env.local` sul Mac.

La corrispondenza è `SUPABASE_PUBLIC_URL` → `SUPABASE_URL`, `ANON_KEY` → `SUPABASE_ANON_KEY`, `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`, `MYAI_INSTANCE_ID` → `SUPABASE_INSTANCE_ID`. Il BFF verifica `myai_instance_id()` prima di Auth o dati.

## Backup e ripristino

Runbook canonico: `/Users/macair/developer/My ai/deploy/supabase/README.md`, copiato anche in `/opt/myai-supabase/README.md` e `/root/backups/my-ai/SUPABASE-RUNBOOK.md`.

Comandi:

```bash
cd /opt/myai-supabase
./backup.sh
./verify-backup.sh
```

- Backup locale consigliato: `/opt/myai-supabase/backups/latest`.
- Copia root-only fuori dai LXC: `/root/backups/my-ai/` sul nodo Proxmox.
- Puntatori: `supabase-latest.tar.gz`, `app-latest.tar.gz`, `npm-latest.sqlite` e `LATEST`.
- Snapshot verificato il 2026-09-12: checksum validi e ripristino reale riuscito in un database temporaneo poi rimosso.
- Backup NPM: `/opt/nginxproxymanager/data/database.sqlite.bak-myai-online-latest`.

Il dump include dati e struttura di `auth`, `storage`, `public`; registra separatamente le versioni delle estensioni. Gli schemi interni non usati (GraphQL, Vault, Realtime, Analytics) sono esclusi per evitare fragilità di restore.

## Stato delle registrazioni

Le registrazioni pubbliche restano aperte per decisione dell'utente. Il limite AI è 50 chiamate giornaliere per account; resta il rischio di consumo del credito DeepSeek da utenti esterni.

## Collegamenti decisionali

[[Stack Supabase dedicato e ripristino password dell'altra app]]
[[Messa online su LXC 110 con NPM e due domini]]
[[Runbook operativo e backup ripristinabile per My ai]]