---
title: "Autorizzazione backup, migrazioni Supabase dedicate e collaudo autenticato"
date: 2026-09-14
prompt_id: 2026-09-14-002
tags: [migrazioni, backup, supabase, test]
related_pages: []
decisions: [Collaudo autenticato con AI simulata e HTTPS locale senza indebolire i cookie]
suggested_adrs: []
files_modified: []
status: analyzed
---

## Prompt originale

procedi

## Analisi automatica

## Richiesta autorizzata
Procedere con il percorso proposto: backup verificato, applicazione delle due migrazioni allo stack Supabase dedicato, reload PostgREST, status e prove e2e autenticate. Pubblicazione del nuovo frontend e abilitazione video rimangono separate.
## Esito
Backup 20260914T053145Z, restore di prova riuscito e copia verificata sul Mac. Applicate 202609140001_auto_memories.sql e 202609140002_videos.sql in un'unica transazione con timeout, COMMIT e NOTIFY PostgREST. Identità dell'istanza, RLS e accessi RPC verificati.
## Collaudo
103 test unitari/SQL; 79 e2e verdi con Supabase reale e AI simulata su loopback HTTPS, 2 prove AI reale saltate; 3 verifiche pubbliche di login/navigazione verdi. Nessuna generazione a pagamento. Fixture rimosse, conteggi utente/ricordi/chat/file e container invariati.
## Limiti
Nessun deploy del nuovo codice frontend/API, nessuna abilitazione video. Il BFF pubblico precedente non collega ancora le risposte con reply_to_id; per la funzione completa serve pubblicare il nuovo codice.

## Outcome

(da compilare dopo il coding)
