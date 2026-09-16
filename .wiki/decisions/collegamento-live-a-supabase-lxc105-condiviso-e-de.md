---
title: Collegamento live a Supabase LXC105 condiviso e DeepSeek
adr_id: ADR-0002
category: decisions
status: accepted
date: 2026-09-11
decides: Migrazione additiva solo con prefissi myai_ e bucket myai-private; policy storage esistenti verificate bucket-scoped; ch
decision_hash: 29fb277a
tags: [supabase, deepseek, deploy, testing]
---
# ADR-0002 — Collegamento live a Supabase LXC105 condiviso e DeepSeek

- **Stato:** accepted
- **Data:** 2026-09-11
- **Decide:** Migrazione additiva solo con prefissi myai_ e bucket myai-private; policy storage esistenti verificate bucket-scoped; ch

## Context

L’istanza Supabase self-hosted (LXC 105, 192.168.1.17:8000) è condivisa con un’altra app (schema public occupato, bucket allegati, 6 utenti). DeepSeek usa la chiave del profilo openclaw deepseek:default, modello deepseek-flash.

## Decision

Migrazione additiva solo con prefissi myai_ e bucket myai-private; policy storage esistenti verificate bucket-scoped; chiavi mai stampate, solo scritte in .env.local (600); e2e eseguiti con account di test attivato via ENABLE_EMAIL_AUTOCONFIRM già presente; retry PGRST303 nel layer checked perché PostgREST ricarica la cache dopo DDL.

## Alternatives considerate

- Creare un DB separato per My ai: scartato, lo stack Supabase self-hosted punta a un solo database
- Stampare chiavi o modificarle in chiaro: scartato, gestione con file temporanei rimossi

## Consequences

Il saldo DeepSeek è limitato (3,90 USD); le tariffe cautelative in .env.local sono 0,3/1,2 USD per milione di token. JWT_EXPIRY=3600 sull’istanza limita le sessioni a un’ora.

## Status

accepted dal 2026-09-11.

