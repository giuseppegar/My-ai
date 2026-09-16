---
title: Build con parallelismo limitato sul LXC Docker condiviso
adr_id: ADR-0009
category: decisions
status: accepted
date: 2026-09-12
decides: Limitare a due i thread Rayon e i worker Next; limitare heap Node della fase build a 1024 MB. Compilare e verificare un’
decision_hash: aa04e1cf
tags: [deploy, risorse, operativita]
---
# ADR-0009 — Build con parallelismo limitato sul LXC Docker condiviso

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Limitare a due i thread Rayon e i worker Next; limitare heap Node della fase build a 1024 MB. Compilare e verificare un’

## Context

La prima build della correzione allegati ha saturato il limite RAM del LXC 110 condiviso, causando indisponibilità temporanea. Il build non deve interferire con le applicazioni già avviate; il numero di thread predefinito non era adeguato al contenitore.

## Decision

Limitare a due i thread Rayon e i worker Next; limitare heap Node della fase build a 1024 MB. Compilare e verificare un’immagine candidata prima di promuoverla, conservando il tag precedente per rollback e controllando la memoria disponibile. Non aumentare permanentemente la RAM per mascherare un build eccessivamente parallelo.

## Alternatives considerate

- Aumentare permanentemente il LXC: modifica capacità condivisa e non affronta l’oversubscription.
- Compilare e ricreare subito la produzione: espone il sito a una release non ancora verificata.

## Consequences

La build limitata ha completato in circa 14 secondi la fase next build; RAM temporanea ripristinata da 6144 a 4096 MB, 4 core e swap 2048 invariati. Con margine insufficiente usare un builder separato.

## Status

accepted dal 2026-09-12.

