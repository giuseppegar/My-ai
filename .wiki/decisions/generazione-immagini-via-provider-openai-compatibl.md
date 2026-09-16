---
title: Generazione immagini via provider OpenAI-compatible, senza chiamate AI intermedie
adr_id: ADR-0011
category: decisions
status: accepted
date: 2026-09-12
decides: Usare un endpoint OpenAI-compatible /images/generations configurabile (IMAGE_API_KEY, IMAGE_BASE_URL, IMAGE_MODEL, IMAGE
decision_hash: 413716ee
tags: [immagini, provider, privacy]
---
# ADR-0011 — Generazione immagini via provider OpenAI-compatible, senza chiamate AI intermedie

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Usare un endpoint OpenAI-compatible /images/generations configurabile (IMAGE_API_KEY, IMAGE_BASE_URL, IMAGE_MODEL, IMAGE

## Context

L’utente vuole generare immagini. DeepSeek non offre generazione immagini e il modello testuale non può descriverle; serve un provider dedicato. Le immagini generate devono vivere nello spazio privato dell’utente con gli stessi vincoli di costo e archiviazione dei file.

## Decision

Usare un endpoint OpenAI-compatible /images/generations configurabile (IMAGE_API_KEY, IMAGE_BASE_URL, IMAGE_MODEL, IMAGE_SIZE). Il testo dell’utente è il prompt (max 500 caratteri); il provider riceve solo quello. Nessuna chiamata DeepSeek intermedia. Risultato normalizzato (max 1536 px), salvato nel bucket privato come documento `origin=generated` legato alla chat, con galleria, spostamento in memoria e limite giornaliero atomico separato (myai_consume_image). Senza chiave la funzione dichiara di non essere configurata.

## Alternatives considerate

- Modelli locali: nessuna GPU sui LXC e costi di gestione alti.
- Reutilizzare il limite delle chiamate AI: un’immagine vale più di una chat e meriterebbe un tetto distinto.
- URL pubblici dal provider: esporrebbe contenuti senza controllo del bucket privato.

## Consequences

La conservazione lato provider dipende dalle sue condizioni; il salvataggio locale resta nel bucket privato con RLS. Il prompt viaggia solo al momento della generazione. Costi configurabili via limite giornaliero, nessuna stima di prezzo mostrata agli utenti.

## Status

accepted dal 2026-09-12.

