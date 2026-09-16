---
title: Video abilitati in produzione con veo-3.1-lite 4s 720p senza audio
adr_id: ADR-0018
category: decisions
status: accepted
date: 2026-09-14
decides: Video attivi in produzione con veo-3.1-lite, 4s, 720p, senza audio, 2 al giorno, al costo osservato di 0,12 USD per video.
decision_hash: 09eda207
tags: [video, openrouter, costi, deploy]
relates_to: [ADR-0016]
---
# ADR-0018 — Video abilitati in produzione con veo-3.1-lite 4s 720p senza audio

- **Stato:** accepted
- **Data:** 2026-09-14
- **Decide:** Video attivi in produzione con veo-3.1-lite, 4s, 720p, senza audio, 2 al giorno, al costo osservato di 0,12 USD per video.

## Context

Su richiesta esplicita l'utente ha chiesto di attivare la generazione video dopo il deploy del codice (ADR-0016) e il collaudo simulato. Serviva una scelta di modello/parametri con costo reale misurato, mantenendo la quota giornaliera e la conferma del credito gia previste.

## Decision

Abilitare VIDEO_ENABLED=true in /opt/my-ai/.env con VIDEO_MODEL=google/veo-3.1-lite, 4 secondi, 720p, 16:9, senza audio (generate_audio=false) e VIDEO_DAILY_LIMIT=2. Verificare il costo con una singola generazione reale controllata tramite l'account di test e la produzione, poi eliminare i contenuti di collaudo.

## Alternatives considerate

- google/veo-3.1 (0,20 USD/s senza audio, 0,40 con audio): qualita superiore ma 4 volte il costo
- minimax/hailuo-3 (0,13 USD/s, 2K con audio): output piu ricco ma con audio e costo maggiore
- gpt-image-1 solo immagini: nessun video
- lasciare i video spenti: nessuna verifica reale del percorso a pagamento

## Consequences

Costo reale misurato: 0,12 USD per generazione (0,03 USD/s a 720p senza audio), MP4 3,8 MB, completata in meno di un minuto. Il listino cambia con modello, durata e risoluzione: ricontrollare il catalogo e il costo prima di modificare i parametri. Restano attivi quota giornaliera (2), conferma del credito nell'interfaccia, job durabili con lease e stato uncertain senza reinvio, e l'avviso che per i video OpenRouter non offre Zero Data Retention. Rollback: rimuovere VIDEO_ENABLED dal .env e ricreare il container; copia di sicurezza .env.bak-video-20260914T070949Z.

## Status

accepted dal 2026-09-14.
**Collegato a:** [[ADR-0016]]

