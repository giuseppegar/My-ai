---
title: Isolamento completo tra applicazioni con Supabase dedicato
adr_id: ADR-0003
category: decisions
status: accepted
date: 2026-09-11
decides: Richiedere un progetto o stack Supabase dedicato a My ai con Auth, database, storage, segreti JWT e chiavi API indipende
decision_hash: 778e8311
tags: [isolation, security, supabase, auth]
---
# ADR-0003 — Isolamento completo tra applicazioni con Supabase dedicato

- **Stato:** accepted
- **Data:** 2026-09-11
- **Decide:** Richiedere un progetto o stack Supabase dedicato a My ai con Auth, database, storage, segreti JWT e chiavi API indipende

## Context

L’utente chiarisce che le diverse app non devono condividere dati né account. Il collegamento di My ai allo stack Supabase esistente separava solo le tabelle myai_ e il bucket, ma condivideva auth.users, password e chiavi amministrative. Il precedente reset password ha quindi interessato anche l’account usato dall’altra app.

## Decision

Richiedere un progetto o stack Supabase dedicato a My ai con Auth, database, storage, segreti JWT e chiavi API indipendenti. La RLS per utente rimane necessaria ma non sostituisce la separazione tra app. Non modificare ulteriormente gli account esistenti e non cancellare dati dello stack condiviso. Disabilitata nell’attuale .env.local l’eliminazione account, rimossa la service-role condivisa e verificato accountDeletion=false nel server locale. Nuova istanza e migrazione non ancora eseguite.

## Alternatives considerate

- Sole tabelle prefissate o schemi distinti sullo stesso stack con Auth condivisa non soddisfano il requisito.
- Stack distinti sullo stesso host Proxmox permettono separazione applicativa senza richiedere hardware diverso; un LXC dedicato aggiunge isolamento operativo.

## Consequences

Prima di riabilitare l’eliminazione account occorre collegare e verificare lo stack dedicato. La stessa email potrà essere registrata indipendentemente in ciascuna app. Gli eventuali dati My ai esistenti devono essere preservati e migrati solo con un piano esplicito. Nessun altro reset password né eliminazione dell’account condiviso.

## Status

accepted dal 2026-09-11.

