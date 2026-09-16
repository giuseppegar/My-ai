---
title: "Artefatti di testo: output JSON, revisione su anteprima e scope chat-only"
adr_id: ADR-0019
category: decisions
status: accepted
date: 2026-09-16
decides: Generazione via DeepSeek con output JSON strutturato e fallback; revisione AI solo in anteprima con conferma; riuso di myai_documents e delle policy esistenti; artefatti chat-only fuori dalla ricerca globale.
decision_hash: 8ed172c4
tags: [artefatti, ai, documenti, privacy, deepseek]
relates_to: [BFF Next.js con Supabase dedicato e DeepSeek server-only, Allegati leggibili localmente, con limiti e testo parziale espliciti]
---
# ADR-0019 — Artefatti di testo: output JSON, revisione su anteprima e scope chat-only

- **Stato:** accepted
- **Data:** 2026-09-16
- **Decide:** Generazione via DeepSeek con output JSON strutturato e fallback; revisione AI solo in anteprima con conferma; riuso di myai_documents e delle policy esistenti; artefatti chat-only fuori dalla ricerca globale.

## Context

Aggiunta dello strumento "Genera file di testo" a My ai: generazione di documenti .md/.txt da un prompt, modifica manuale di titolo e contenuto, revisione AI su richiesta e salvataggio di una risposta della chat come file. Servivano scelte su formato di output del modello, sul momento del salvataggio delle modifiche AI, sull'archiviazione e sul comportamento nelle chat riservate.

## Decision

Generare il documento chiedendo a DeepSeek un singolo oggetto JSON (title, filename, content, summary) con response_format json_object e fallback al testo grezzo se il parsing fallisce; normalizzare sempre il filename; riusare l'infrastruttura documenti esistente (bucket privato, 10 MB per file, 65.000 caratteri per contenuto, quota AI giornaliera condivisa, chunk indicizzati come gli altri documenti). La revisione AI produce solo un'anteprima e salva esclusivamente dopo conferma esplicita; nelle chat riservate l'artefatto resta nella chat e fuori dalla ricerca globale; copia, download e apertura passano dal BFF autenticato.

## Alternatives considerate

- Far scrivere markdown libero al modello e dedurre titolo e nome file con regole locali (meno controllo sul formato, più rischio di nomi incoerenti)
- Salvare la revisione AI direttamente senza anteprima (l'utente perderebbe la possibilità di verificare prima di sovrascrivere)
- Creare una tabella e un bucket dedicati agli artefatti (duplicazione di policy, trigger e quote già esistenti)
- Trattare gli artefatti come contenuti sempre globali, anche nelle chat riservate (violerebbe l'ambito chat-only già applicato a media generati e allegati)

## Consequences

Il testo resta modificabile e verificabile a mano; il nome file non può diventare un percorso pericoloso; nessuna migrazione e nessun nuovo bucket; gli artefatti chat-only ereditano i trigger e le policy già esistenti (incluso lo scope dei media generati). La revisione AI consuma quota come le altre chiamate e non è mai silenziosa. Un artefatto con contenuto fornito non consuma quota e non contatta il provider.

## Status

accepted dal 2026-09-16.
**Collegato a:** [[BFF Next.js con Supabase dedicato e DeepSeek server-only]], [[Allegati leggibili localmente, con limiti e testo parziale espliciti]]

