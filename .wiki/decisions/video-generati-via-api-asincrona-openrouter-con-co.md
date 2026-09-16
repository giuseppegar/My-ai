---
title: Video generati via API asincrona OpenRouter con conferma del credito
adr_id: ADR-0016
category: decisions
status: accepted
date: 2026-09-14
decides: Video via OpenRouter solo se VIDEO_ENABLED=true, con conferma del credito e job durabili verificabili.
decision_hash: e2512305
tags: [video, openrouter, costi, privacy]
---
# ADR-0016 — Video generati via API asincrona OpenRouter con conferma del credito

- **Stato:** accepted
- **Data:** 2026-09-14
- **Decide:** Video via OpenRouter solo se VIDEO_ENABLED=true, con conferma del credito e job durabili verificabili.

## Context

Richiesta: aggiungere la generazione video con la API di OpenRouter. L API e asincrona (POST /videos, polling, download), a pagamento, senza zero data retention, con output temporaneo lato provider.

## Decision

Integrare come job durabile in myai_video_jobs: base URL fissa openrouter.ai/api/v1 (mai polling_url o unsigned_urls del provider), catalogo /videos/models verificato prima di ogni nuovo job, quota giornaliera separata, conferma esplicita del consumo di credito nell UI, niente audio, request_id idempotente con lease di invio (un retry HTTP non invia un secondo POST), firma HMAC del provider_id, stato uncertain se l esito dell invio resta ignoto (mai reinvio automatico), MP4 <= 50 MB nel bucket privato con streaming Range dal BFF per Safari, VIDEO_ENABLED=false di default.

## Alternatives considerate

- Proxy sincrono (timeout e costi opachi)
- Usare gli URL restituiti dal provider (SSRF e fuga della chiave)
- Nessun job persistente (risultato perso se l app si chiude)
- Abilitare di default (costo a sorpresa)

## Consequences

Migrazione 202609140002 (tabella, RPC start/claim, quota video, trigger esito, MIME video/mp4 e limite bucket). Test unitari con provider simulato: nessuna chiamata reale a pagamento. L amministratore deve applicare le migrazioni e impostare VIDEO_ENABLED=true e la chiave OpenRouter. I video sono ricercabili per titolo e prompt, senza trascrizione.

## Status

accepted dal 2026-09-14.

