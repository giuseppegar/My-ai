---
title: Runbook operativo e backup ripristinabile per My ai
adr_id: ADR-0006
category: decisions
status: accepted
date: 2026-09-12
decides: Usare un runbook operativo versionato in deploy/supabase/README.md con status.py, backup.sh e verify-backup.sh. Il backu
decision_hash: 39f58bc8
tags: [operations, backup, restore, supabase, security]
relates_to: [stack-supabase-dedicato-e-ripristino-password-dell, messa-online-su-lxc-110-con-npm-e-due-domini]
---
# ADR-0006 — Runbook operativo e backup ripristinabile per My ai

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Usare un runbook operativo versionato in deploy/supabase/README.md con status.py, backup.sh e verify-backup.sh. Il backu

## Context

L'utente richiede di salvare integralmente lo stato online e soprattutto di non perdere le istruzioni per accedere al nuovo Supabase. Le prime prove di pg_dump completo hanno mostrato che gli schemi interni non usati da My ai possono rendere il restore fragile tra permessi Vault e firme GraphQL.

## Decision

Usare un runbook operativo versionato in deploy/supabase/README.md con status.py, backup.sh e verify-backup.sh. Il backup include auth, storage e public, registra le versioni delle estensioni, conserva Storage e configurazione root-only e viene verificato mediante restore in un database temporaneo. Conservare una copia locale su LXC 105 e una copia coordinata di Supabase, app e NPM in /root/backups/my-ai sul nodo Proxmox. NPM deve inoltrare tramite DNS Docker my-ai e non tramite IP variabile.

## Alternatives considerate

- Un dump indiscriminato di tutti gli schemi è stato scartato dopo prove reali fallite su vault.secrets e ACL GraphQL, componenti non usati da My ai.
- Un solo backup sul filesystem di LXC 105 è stato scartato come unica copia perché non protegge dalla perdita del container.
- Il target NPM basato sull'IP 172.20.0.3 è stato sostituito dal nome DNS Docker my-ai per resistere alla ricreazione del container.

## Consequences

Il backup consigliato è raggiungibile tramite i symlink backups/latest sul LXC e *-latest sul nodo Proxmox. Lo snapshot 20260912T113936Z ha superato checksum e ripristino di prova. La documentazione non contiene valori segreti; indica solo percorsi root-only. La pianificazione automatica dei backup non è stata attivata e resta una scelta successiva.

## Status

accepted dal 2026-09-12.
**Collegato a:** [[Stack Supabase dedicato e ripristino password dell'altra app]], [[Messa online su LXC 110 con NPM e due domini]]

