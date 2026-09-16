---
title: "Indicatori in fondo, salvataggio automatico, video OpenRouter"
date: 2026-09-14
prompt_id: 2026-09-14-001
tags: [openrouter, ui, video, memoria]
related_pages: []
decisions: [Salvataggio automatico di richieste e risposte come ricordi catalogati, Video generati via API asincrona OpenRouter con conferma del credito]
suggested_adrs: []
files_modified: []
status: analyzed
---

## Prompt originale

Farei delle modifiche: sposterei gli indicatori in fondo alla pagina. Farei i salvataggi automatici ad ogni richiesta fatta e catalogata. Aggiungerei anche la possibilita di fare video, con la api di openrouter.

## Analisi automatica

## Richiesta
Tre modifiche: indicatori in fondo alla pagina, salvataggio e catalogazione automatica di ogni richiesta, generazione video con OpenRouter.
## Implementazione
- Indicatori spostati sotto la chat, prima del footer.
- Trigger SQL atomico per richiesta + risposta nello stesso ricordo (migrazione 202609140001), con auto_update, revoca nelle chat riservate e pulsante "Salvato in <isola> - Modifica".
- Video asincrono OpenRouter con job durabili, quota, conferma credito, MP4 privato con Range (migrazione 202609140002), disattivato di default.
## Verifiche
103 test unitari/SQL, typecheck/lint/build, e2e simulati (desktop, Pixel 7) su salvataggio, errori onesti e flusso video; dry-run delle migrazioni su PostgreSQL 15.8 reale con rollback.
## Stato
Codice completo e verificato in locale. Migrazioni non ancora applicate allo stack dedicato e nessun deploy: da autorizzare.

## Outcome

(da compilare dopo il coding)
