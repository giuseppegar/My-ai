---
title: Salvataggio automatico di richieste e risposte come ricordi catalogati
adr_id: ADR-0015
category: decisions
status: accepted
date: 2026-09-14
decides: Ogni nuova richiesta viene salvata e catalogata automaticamente; le chat riservate restano fuori dalla memoria globale.
decision_hash: adbfdc0e
tags: [memoria, sql, privacy, chat]
---
# ADR-0015 — Salvataggio automatico di richieste e risposte come ricordi catalogati

- **Stato:** accepted
- **Data:** 2026-09-14
- **Decide:** Ogni nuova richiesta viene salvata e catalogata automaticamente; le chat riservate restano fuori dalla memoria globale.

## Context

Richiesta: salvare automaticamente ogni richiesta fatta e catalogarla. Vincoli esistenti: RLS su ogni tabella, chat riservate se un allegato e chat-only, nessun dato personale dedotto senza conferma, la risposta AI puo fallire.

## Decision

Usare un trigger SQL AFTER INSERT/UPDATE su myai_messages (security invoker, quindi RLS attiva): la richiesta crea subito un ricordo con id uguale al messaggio; la risposta aggiorna lo stesso ricordo. Colonna auto_update per smettere di sovrascrivere dopo una modifica manuale; le chat riservate non creano copie e revocano quelle esistenti; nuovo pulsante "Salvato in <isola> - Modifica" al posto di "Salva nell isola" quando il ricordo esiste gia. Categoria dall isola selezionata, altrimenti regole locali (proposeCategory), mai un LLM.

## Alternatives considerate

- Doppia scrittura dal client (non atomica, puo divergere o duplicare)
- RPC dal server dopo la risposta (due round trip e retry duplicati)
- Tabella separata di riepiloghi (non ricercabile come ricordo)

## Consequences

Migrazione 202609140001: reply_to_id/idempotenza, auto_conversation_id, auto_update, trigger myai_auto_memory e revoca, scope automatico dei media generati, sintesi agenti salvata una volta sola; limite contenuto ricordi da 20.000 a 65.000 caratteri. Se la risposta AI fallisce la richiesta resta conservata. Eliminando la chat i ricordi curati restano (FK con set null). Test PGlite su atomicita, chat riservate, ricordo editato o cancellato.

## Status

accepted dal 2026-09-14.

