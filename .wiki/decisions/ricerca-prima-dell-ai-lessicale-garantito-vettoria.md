---
title: "Ricerca prima dell AI: lessicale garantito, vettoriale opzionale"
adr_id: ADR-0002
category: decisions
status: accepted
date: 2026-09-11
decides: "La barra di chat esegue SOLO ricerca sulla memoria: FTS italiana+trigrammi sempre attivi (query sanificate), embeddings"
decision_hash: 1965f25d
tags: [search, privacy, deepseek]
---
# ADR-0002 — Ricerca prima dell AI: lessicale garantito, vettoriale opzionale

- **Stato:** accepted
- **Data:** 2026-09-11
- **Decide:** La barra di chat esegue SOLO ricerca sulla memoria: FTS italiana+trigrammi sempre attivi (query sanificate), embeddings

## Context

DeepSeek non offre embeddings e la privacy impone che i vettori restino su servizi fidati; la digitazione non deve mai produrre bozze salvate né chiamate a modelli.

## Decision

La barra di chat esegue SOLO ricerca sulla memoria: FTS italiana+trigrammi sempre attivi (query sanificate), embeddings bge-m3 opzionali da un endpoint Ollama locale esplicitamente configurato, senza fallback a servizi cloud. Il submit generativo avviene solo con Invio esplicito; bozze e cronologia ricerche non vengono conservate.

## Alternatives considerate

- Embeddings via API di terze parti: scartato, nessun provider configurato è legittimo di default
- Salvare bozze per continuità: scartato, requisito esplicito di non conservazione

## Consequences

Senza endpoint embeddings la ricerca è testuale+affini: comportamento dichiarato nell’interfaccia. La modalità ibrida compare solo quando il servizio risponde.

## Status

accepted dal 2026-09-11.

