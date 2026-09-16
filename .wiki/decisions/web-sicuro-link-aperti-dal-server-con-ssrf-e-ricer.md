---
title: Web sicuro con SSRF e ricerca solo su richiesta
adr_id: ADR-0010
category: decisions
status: accepted
date: 2026-09-12
decides: Aprire solo link http/https incollati dall’utente (max 3, risolti dal server), bloccando indirizzi privati, loopback, li
decision_hash: 257b6534
tags: [web, sicurezza, privacy]
---
# ADR-0010 — Web sicuro con SSRF e ricerca solo su richiesta

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Aprire solo link http/https incollati dall’utente (max 3, risolti dal server), bloccando indirizzi privati, loopback, li

## Context

L’utente vuole che l’app possa navigare in rete. Il server è sulla LAN (può raggiungere Supabase e altri servizi interni); il browser pubblico no. Non deve esistere un crawling autonomo né un modo per il contenuto web di diventare istruzione; senza chiavi non devono esserci promesse.

## Decision

Aprire solo link http/https incollati dall’utente (max 3, risolti dal server), bloccando indirizzi privati, loopback, link-local, metadata, CGNAT e IPv6 riservati a ogni salto di reindirizzamento; limiti di 3 reindirizzamenti, 2 MB, 10 s e solo contenuti testuali. Ricerca web tramite Tavily solo con TAVILY_API_KEY e solo quando il pulsante Cerca nel web è attivo; risultati marcati come materiale non attendibile e inclusi nel contesto prima dei ricordi. I tre modi della barra (AI, web, Approfondisci) restano mutuamente esclusivi; web+approfondimento non è previsto in questa versione.

## Alternatives considerate

- Tool calling verso DeepSeek: il modello potrebbe inventare URL o iterare; non verificabile con il modello attuale.
- Scraping di motori di ricerca senza chiave: fragile e contro i termini dei siti.
- Ricerca automatica a ogni invio: consumerebbe quota e privacy senza consenso esplicito.

## Consequences

I siti che bloccano i bot producono un avviso, mai contenuti inventati. WEB_FETCH_ALLOW_PRIVATE esiste solo per sviluppo/test. La richiesta va al provider di ricerca solo su azione esplicita; i link vengono aperti anche senza chiave.

## Status

accepted dal 2026-09-12.

