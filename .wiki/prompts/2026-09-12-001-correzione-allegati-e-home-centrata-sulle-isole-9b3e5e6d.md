---
title: "Correzione allegati e home centrata sulle isole"
date: 2026-09-12
prompt_id: 2026-09-12-001
tags: [pdf, immagini, isole, home, allegati]
related_pages: []
decisions: []
suggested_adrs: []
files_modified: []
status: analyzed
---

## Prompt originale

ci sono delle cose da modificare e da correggere. ho provato a caricare un pdf e non si è riusciti a leggere il  file. Controlla se le integrazioni con pdf, file in genere e foto funzioni. poi mi piacerebbe che in alto, sotto gli indicatori ci siano gia le isole con il tasto ben visibile parliamone in chat. anche la chat libera mi piacerebbe sia come un isola

## Analisi automatica

## Esito
Aggiornamento pubblicato su entrambi i domini My ai. Causa accertata: PDF utente 206 pagine / 441.164 caratteri oltre i vecchi limiti; parsing completo verificato in sola lettura. Nuovi limiti 500 pagine / 1M caratteri con testo parziale dichiarato; OCR locale per testo di foto/scansioni; originali BFF same-origin e contesto pertinente anche a fine documento. Cinque isole sotto gli indicatori, CTA accessibile, chat libera senza nuova categoria persistente.
## Verifiche
Typecheck, lint, build, audit senza vulnerabilità e 60 test unità/SQL passati. Playwright locale: 23 passati, 2 opt-in AI saltati di default; l’opt-in è stato eseguito e superato separatamente sul Docker candidato con DeepSeek reale (codice a pagina 206). OCR reale verificato per PNG/JPG/GIF/WebP e PDF scansionato. Dopo promozione: 11 prove desktop/mobile sul dominio pubblico, HTTPS su entrambi i domini e container healthy. 33 file runtime/config locali e remoti coincidono.
## Operatività
Backup sorgenti e tag immagine precedente conservati. Prima build interrotta per pressione memoria con indisponibilità temporanea; limitati Rayon/Next a 2 worker e heap Node build a 1024 MB. RAM LXC ripristinata a 4096 MB dopo aumento temporaneo a 6144, nessuna modifica permanente a CPU/swap o database.
## Limiti espliciti
OCR legge testo, non scene; visione generica resta non configurata. PDF precedente da recuperare con Documenti → Reindicizza: nessuna modifica automatica ai contenuti degli utenti.

## Outcome

(da compilare dopo il coding)
