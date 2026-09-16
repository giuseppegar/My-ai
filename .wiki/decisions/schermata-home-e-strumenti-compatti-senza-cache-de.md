---
title: Schermata Home e strumenti compatti senza cache dei dati privati
adr_id: ADR-0014
category: decisions
status: accepted
date: 2026-09-13
decides: Privilegiare icone PNG native e strumenti a richiesta per preservare spazio e privacy su mobile
decision_hash: 18decf2b
tags: [mobile, ui, privacy, icons]
---
# ADR-0014 — Schermata Home e strumenti compatti senza cache dei dati privati

- **Stato:** accepted
- **Data:** 2026-09-13
- **Decide:** Privilegiare icone PNG native e strumenti a richiesta per preservare spazio e privacy su mobile

## Context

L’utente segnala logo assente nel collegamento Home e regressione mobile dopo i nuovi comandi. Il solo favicon SVG non copre i launcher e affollare una riga rende il tasto invio irraggiungibile sui piccoli schermi.

## Decision

Aggiungere icone PNG derivate dalla bussola e manifest standalone senza introdurre service worker o promesse offline. Raccogliere i modi opzionali in una disclosure Strumenti, con selezione esclusiva, indicatore attivo, focus ripristinato e avvio solo all’invio. Conservare allegati e bozza cambiando modo; usare controlli touch da 44 px, input leggibili e safe area senza bloccare lo zoom.

## Alternatives considerate

- Ridurre ancora font e bottoni o nascondere overflow maschererebbe il problema senza renderli usabili.
- Una barra a scorrimento laterale nasconderebbe funzioni e lascerebbe l’invio poco evidente.
- Cache offline dei dati autenticati aumenterebbe i rischi e non serve per il logo sulla schermata Home.

## Consequences

Una pressione aggiuntiva per scegliere lo strumento, in cambio di una chat compatta e invio sempre accessibile. I collegamenti preesistenti possono richiedere la rimozione e nuova aggiunta per aggiornare l’icona. L’app continua a richiedere rete e account; il collaudo browser non sostituisce l’installazione su telefono reale.

## Status

accepted dal 2026-09-13.

