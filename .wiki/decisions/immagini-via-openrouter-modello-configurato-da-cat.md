---
title: Immagini via OpenRouter, modello configurato da catalogo reale
adr_id: ADR-0012
category: decisions
status: accepted
date: 2026-09-12
decides: Configurare OpenRouter con IMAGE_BASE_URL=https://openrouter.ai/api/v1 e IMAGE_MODEL=openai/gpt-5-image (migliore qualit
decision_hash: 905860f1
tags: [immagini, openrouter, provider, costi]
---
# ADR-0012 — Immagini via OpenRouter, modello configurato da catalogo reale

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Configurare OpenRouter con IMAGE_BASE_URL=https://openrouter.ai/api/v1 e IMAGE_MODEL=openai/gpt-5-image (migliore qualit

## Context

L’utente ha fornito una chiave OpenRouter chiedendo black-forest-labs/flux.2-pro. Il catalogo OpenRouter attuale (445 modelli) non contiene più modelli Black Forest Labs/Flux. L’endpoint /images/generations di OpenRouter risponde con b64_json e il payload dell’app funziona senza modifiche.

## Decision

Configurare OpenRouter con IMAGE_BASE_URL=https://openrouter.ai/api/v1 e IMAGE_MODEL=openai/gpt-5-image (migliore qualità disponibile), IMAGE_SIZE 1024x1024 e IMAGE_DAILY_LIMIT 5. Le immagini generate vengono salvate con status=ready (corretto da processing: non serve estrazione). La chiave vive solo in /opt/my-ai/.env (600), mai nel repository; poiché condivisa in chat, valutarne la rotazione. Il modello è una riga di .env: gpt-5-image-mini e gemini-3.1-flash-image sono alternative più economiche.

## Alternatives considerate

- Cercare Flux altrove (BFL/Replicate/fal): richiede nuova chiave e adattatore non OpenAI-compatible.
- Lasciare IMAGE_MODEL default gpt-image-1: non esiste su OpenRouter, risponderebbe 404.
- Modelli Gemini/gpt-mini: qualità inferiore ma costo molto minore; scelta rimandata all’utente via env.

## Consequences

Costo osservato ≈ 0,17 USD per immagine 1024x1024 (gpt-5-image), tre chiamate di collaudo fatturate (~0,5 USD totali). Il contatore giornaliero per utente limita a 5 immagini/giorno. Se il catalogo OpenRouter cambia ancora, verificare i modelli prima di configurare.

## Status

accepted dal 2026-09-12.

