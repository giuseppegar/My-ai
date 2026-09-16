---
title: Stack Supabase dedicato e ripristino password dell'altra app
adr_id: ADR-0004
category: decisions
status: accepted
date: 2026-09-11
decides: Creato sullo stesso LXC uno stack Supabase autonomo `myai-supabase` (compose project proprio, rete e volumi dedicati, po
decision_hash: d9fe44de
tags: [isolation, supabase, security, infrastructure]
---
# ADR-0004 — Stack Supabase dedicato e ripristino password dell'altra app

- **Stato:** accepted
- **Data:** 2026-09-11
- **Decide:** Creato sullo stesso LXC uno stack Supabase autonomo `myai-supabase` (compose project proprio, rete e volumi dedicati, po

## Context

L'utente ha richiesto espressamente che le diverse app non si incrocino e che la password dell'account dell'altra app fosse riportata a 123456. La precedente impostazione (stack Supabase condiviso) era un errore.

## Decision

Creato sullo stesso LXC uno stack Supabase autonomo `myai-supabase` (compose project proprio, rete e volumi dedicati, porta 8010) con password DB, JWT e chiavi API generati ex novo; applicata la migrazione My ai solo lì. Il BFF ora richiede `SUPABASE_INSTANCE_ID` e verifica il marcatore `myai_instance_id()` via anon key prima di Auth/dati; cookie di sessione con nome dedicato; PGRST301/303 trattati come JWT invalido senza retry. Password dell'account originale ripristinata a quanto indicato dall'utente e verificata. I dati My ai creati sullo stack condiviso restano intatti e non sono stati migrati.

## Alternatives considerate

- Un LXC separato offrirebbe isolamento operativo maggiore ma richiede nuova VM e rete; il comparto Docker/volumi/chiavi dedicati soddisfa il requisito applicativo condiviso dall'utente.
- Migrare gli utenti dal vecchio stack è stato escluso: avrebbe ricreato il legame tra le app; i dati My ai storici restano intatti senza migrazione.

## Consequences

Registrazione, ricerca, file e cancellazione account sono ri-verificati sul nuovo stack. Le app condividono solo l'host, non credenziali né dati. La migrazione dei dati storici, se richiesta, richiede un piano esplicito.

## Status

accepted dal 2026-09-11.

