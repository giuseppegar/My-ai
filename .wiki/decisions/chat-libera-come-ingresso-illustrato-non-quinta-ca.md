---
title: Chat libera come ingresso illustrato, non quinta categoria persistente
adr_id: ADR-0008
category: decisions
status: accepted
date: 2026-09-12
decides: Mostrare cinque isole, con Chat libera come ingresso senza argomento e quattro categorie di memoria. Mantenere il modell
decision_hash: 0d1f2b23
tags: [ux, isole, chat]
---
# ADR-0008 — Chat libera come ingresso illustrato, non quinta categoria persistente

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Mostrare cinque isole, con Chat libera come ingresso senza argomento e quattro categorie di memoria. Mantenere il modell

## Context

L’utente vuole vedere subito le isole sotto gli indicatori e una chat libera con la stessa dignità visiva. Le quattro categorie esistenti organizzano memoria, ricerca, preferenze e indicatori.

## Decision

Mostrare cinque isole, con Chat libera come ingresso senza argomento e quattro categorie di memoria. Mantenere il modello dati a quattro categorie: non aggiungere una categoria fittizia solo per ottenere una scheda. Le CTA Parliamone in chat hanno contrasto e bersaglio di almeno 44px, portano il focus alla conversazione e non inviano richieste AI.

## Alternatives considerate

- Quinta categoria nel database: richiederebbe ridefinire filtri, memoria e indicatori senza necessità espressa.
- Chat prima delle isole: nasconde i punti di ingresso richiesti.
- Piccoli link testuali: scarsa visibilità e usabilità mobile.

## Consequences

La bozza resta disponibile cambiando isola, mentre il cambio di argomento evita di riutilizzare allegati di una conversazione diversa. Chat libera non è un ulteriore archivio persistente.

## Status

accepted dal 2026-09-12.

