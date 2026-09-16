---
title: Allegati leggibili localmente, con limiti e testo parziale espliciti
adr_id: ADR-0007
category: decisions
status: accepted
date: 2026-09-12
decides: Conservare la pipeline locale con limiti 500 pagine / 1.000.000 caratteri e risultati parziali dichiarati. Aggiungere OC
decision_hash: 7dbee856
tags: [documenti, privacy, ocr, retrieval]
---
# ADR-0007 — Allegati leggibili localmente, con limiti e testo parziale espliciti

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Conservare la pipeline locale con limiti 500 pagine / 1.000.000 caratteri e risultati parziali dichiarati. Aggiungere OC

## Context

Un PDF reale di 206 pagine e 441.164 caratteri veniva scartato integralmente dal limite 100 pagine / 200.000 caratteri. Le foto erano solo conservate e il provider/browser pubblico non poteva raggiungere gli URL LAN di Supabase. Il caricamento deve restare indipendente dalla generazione AI e dai provider non configurati.

## Decision

Conservare la pipeline locale con limiti 500 pagine / 1.000.000 caratteri e risultati parziali dichiarati. Aggiungere OCR locale Tesseract ita+eng/Poppler, limitato a 20 pagine scansionate, 45 secondi e due elaborazioni. Dare priorità a riferimenti espliciti e allegati della chat, cercando in tutti i passaggi indicizzati; non sostenere di aver letto parti omesse. Servire originali tramite BFF autorizzato e inviare immagini normalizzate al provider solo con invio AI e visione configurata.

## Alternatives considerate

- Aumentare solo il limite: non risolve scansioni, contesto limitato alle prime pagine e URL LAN.
- OCR cloud automatico: introdurrebbe un nuovo destinatario di documenti privati e costi senza configurazione esplicita.
- Abilitare semplicemente DEEPSEEK_VISION: il flag non rende multimodale un modello testuale.
- Fallimento totale o troncamento silenzioso: penalizza documenti validi o induce fiducia ingiustificata.

## Consequences

Gli errori di lettura restano visibili e distinti dall’avvenuto caricamento. OCR può sbagliare, non descrive scene e richiede manutenzione di strumenti nativi. I vecchi file si recuperano con Reindicizza; nessuna migrazione o reindicizzazione automatica dei dati utente.

## Status

accepted dal 2026-09-12.

