---
title: Collaudo autenticato con AI simulata e HTTPS locale senza indebolire i cookie
adr_id: ADR-0017
category: decisions
status: accepted
date: 2026-09-14
decides: "Test end-to-end autenticati su HTTPS locale con AI simulata: database reale, zero chiamate ai provider a pagamento, cookie Secure invariati."
decision_hash: de958621
tags: [test, sicurezza, https, safari, costi]
---
# ADR-0017 — Collaudo autenticato con AI simulata e HTTPS locale senza indebolire i cookie

- **Stato:** accepted
- **Data:** 2026-09-14
- **Decide:** Test end-to-end autenticati su HTTPS locale con AI simulata: database reale, zero chiamate ai provider a pagamento, cookie Secure invariati.

## Context

Dopo le migrazioni di [[Salvataggio automatico di richieste e risposte come ricordi catalogati]] e [[Video generati via API asincrona OpenRouter con conferma del credito]], occorre verificare il percorso completo BFF→Supabase senza generazioni a pagamento. Il riuso dei cookie Secure da Chromium su HTTP locale fallisce in WebKit: non è una ragione per disabilitare la protezione in produzione.

## Decision

Usare un runner esplicito per i collaudi autenticati: account TEST_USER e Supabase dedicato reali, simulatore AI vincolato a loopback senza registrare né inoltrare i prompt, chiavi dei provider neutralizzate nel solo BFF locale. Servire l'app di test via proxy HTTPS locale con certificato temporaneo, accettato solo nei test locali: i cookie dell'app restano Secure. Le fixture eliminano esclusivamente i propri documenti, ricordi e conversazioni. I test con modelli reali restano opt-in separati.

## Alternatives considerate

- Disabilitare Secure nei cookie per superare i test Safari: indebolirebbe o renderebbe meno rappresentativa la configurazione.
- Mockare anche bootstrap/chat nel browser: utile per il layout, ma non verifica trigger, RLS e persistenza reali.
- Usare i provider a pagamento nei test predefiniti: introduce costi e dipendenza dalla disponibilità esterna.

## Consequences

Richiede openssl e una build locale aggiornata. Le richieste simulate consumano la quota applicativa del solo account di test, ma non credito dei provider. La generazione reale dei video resta da collaudare separatamente dopo abilitazione autorizzata. Nessun deploy automatico dal runner; rifiuta E2E_BASE_URL remoto.

## Status

accepted dal 2026-09-14.

