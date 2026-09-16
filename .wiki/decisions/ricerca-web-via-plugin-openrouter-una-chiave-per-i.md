---
title: Ricerca web via plugin OpenRouter, una chiave per immagini e ricerca
adr_id: ADR-0013
category: decisions
status: accepted
date: 2026-09-12
decides: Usare WEB_SEARCH_PROVIDER=openrouter, chiamata chat/completions con plugins=[{id:web,max_results:3}], modello google/gem
decision_hash: 036c19f1
tags: [web, openrouter, provider, costi]
---
# ADR-0013 — Ricerca web via plugin OpenRouter, una chiave per immagini e ricerca

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Usare WEB_SEARCH_PROVIDER=openrouter: chiamata chat/completions con plugins=[{id:web,max_results:3}], modello google/gem

## Context

L’utente propone di usare la chiave OpenRouter già configurata per le immagini anche per la ricerca web, evitando un account Tavily. OpenRouter non ha un endpoint di ricerca dedicato: espone un plugin web nelle chat completions (billing web_search per query), senza restituire risultati strutturati ma con risposta sintetica e citazioni url_citation su alcuni modelli. I modelli più economici testati hanno costi di token variabili quando il plugin inietta i risultati nel prompt.

## Decision

Usare WEB_SEARCH_PROVIDER=openrouter: chiamata chat/completions con plugins=[{id:web,max_results:3}], modello google/gemini-3.8-flash con reasoning.effort=low (reasoning_tokens=0, costo osservato ≈0,028 USD/ricerca), max_tokens 600. La risposta e le fonti entrano nel contesto di DeepSeek come materiale web non attendibile. Limite giornaliero atomico separato (myai_consume_web, default 10). Tavily resta supportata come alternativa. La chiave OPENROUTER_API_KEY è condivisa con le immagini.

## Alternatives considerate

- Tavily: risultati strutturati ma seconda chiave/account.
- grok-4.6: citazioni ma prompt token 40K per ricerca (≈0,10 USD).
- muse-spark-1.3: più economico ma richiede attestazione 18+.
- Endpoint dedicato /web/search: non esiste su OpenRouter.

## Consequences

Costo per ricerca ≈0,028 USD, limitato a 10/giorno per utente. Le fonti citate dal modello entrano nel contesto; DeepSeek continua a trattarle come materiale da verificare (verificato in collaudo reale). Se il catalogo OpenRouter cambia, OPENROUTER_WEB_MODEL è una riga di .env.

## Status

accepted dal 2026-09-12.

