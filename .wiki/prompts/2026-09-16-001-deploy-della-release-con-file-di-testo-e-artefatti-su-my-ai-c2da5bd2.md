---
title: "Deploy della release con file di testo e artefatti su My ai"
date: 2026-09-16
prompt_id: 2026-09-16-001
tags: [artefatti, collaudo, deploy, lxc110]
related_pages: [operativita-my-ai-e-supabase-dedicato]
decisions: [Artefatti di testo: output JSON, revisione su anteprima e scope chat-only]
suggested_adrs: []
files_modified: []
status: analyzed
---

## Prompt originale

ho fatto delle modifiche, puoi installarlo e aggiornare l'app on line

## Analisi automatica

## Richiesta
Pubblicare in produzione le modifiche locali presenti nell'area di lavoro (file di testo e artefatti) e verificare che l'app online funzioni.

## Implementazione
- Dipendenze reinstallate, verifica completa (typecheck, lint, 111 test unitari/SQL, build).
- Confronto sorgenti locali contro quelli in produzione: 8 file modificati e 2 nuovi (src/server/artifacts.ts, tests/artifacts.test.ts), più un nuovo test e2e autenticato per gli artefatti.
- Aggiornato il test di tastiera degli strumenti (primo strumento ora "Genera file di testo") e aggiunto il progetto Safari mobile al nuovo spec.
- Deploy su LXC 110: tag rollback my-ai:before-artifacts, backup sorgenti senza segreti, copia di 109 file con checksum, build in builder temporaneo con hard cap 2 GiB/2 CPU, candidato su loopback con AI simulata, promozione con Compose --no-build, RAM del LXC alzata temporaneamente a 6144 MB e ripristinata a 4096 MB.
- Documentazione aggiornata (README e deploy/proxmox.md) e copiata sul server con checksum verificato.

## Verifiche
Runner autenticato locale: 88 passati, 2 saltati, 0 falliti. Candidato Docker su database reale: 63 passati, 2 saltati, 0 falliti. Dominio pubblico: 77 passati, 13 saltati, 0 falliti con WebKit/iPhone 13. Health HTTPS su entrambi i domini, capabilities invariate, dati tornati alla baseline (2 utenti, 6 ricordi, 23 conversazioni, 3 documenti, 3 oggetti storage). Nessuna spesa verso provider: AI simulata e contenuti forniti nei test; la quota giornaliera dell'account di test è stata esaurita dal collaudo e il candidato ha usato un limite più alto solo per la durata dei test.

## Stato
Online su LXC 110 (immagine 66ec0eeb445e). Nessuna migrazione e nessuna modifica ai segreti. Rollback pronto con my-ai:before-artifacts.

## Outcome

(da compilare dopo il coding)
