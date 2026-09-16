---
title: BFF Next.js con Supabase dedicato e DeepSeek server-only
adr_id: ADR-0001
category: decisions
status: accepted
date: 2026-09-11
decides: Usare Next.js come backend-for-frontend con cookie HttpOnly, auth.getUser a ogni richiesta, RLS Supabase su tutte le tab
decision_hash: e234b3b3
tags: [security, privacy, supabase, deepseek]
---
# ADR-0001 — BFF Next.js con Supabase dedicato e DeepSeek server-only

- **Stato:** accepted
- **Data:** 2026-09-11
- **Decide:** Usare Next.js come backend-for-frontend con cookie HttpOnly, auth.getUser a ogni richiesta, RLS Supabase su tutte le tab

## Context

Richiesta di memoria personale multiutente con ricerca in digitazione e hosting nella infrastruttura Proxmox esistente; rischio di accessi incrociati e di dichiarare operative integrazioni non collegate.

## Decision

Usare Next.js come backend-for-frontend con cookie HttpOnly, auth.getUser a ogni richiesta, RLS Supabase su tutte le tabelle e file privati prefissati con uid. DeepSeek soltanto su invio esplicito; embeddings bge-m3 opzionali via endpoint Ollama fidato, senza riattivare servizi rimossi da Proxmox. Anteprima separata e non persistente.

## Alternatives considerate

- Supabase service-role per tutte le query: scartato perché aggirerebbe RLS.
- Browser con chiave DeepSeek: scartato per esposizione dei segreti.
- Ripristinare Ollama automaticamente: scartato perché l'infrastruttura documenta la sua dismissione.

## Consequences

Servono configurazione di un progetto Supabase dedicato, dominio HTTPS e chiave API; nessuna modifica infrastrutturale in questa fase. Il modello embeddings non è incluso. La ricerca degrada esplicitamente a lessicale.

## Status

accepted dal 2026-09-11.

