---
title: Messa online su LXC 110 con NPM e due domini
adr_id: ADR-0005
category: decisions
status: accepted
date: 2026-09-12
decides: "Deploy su LXC 110 (docker): sorgenti in /opt/my-ai, container `my-ai` sulla rete homelab senza porte host, raggiungibile da NPM su 172.20.0.3:3000"
decision_hash: 62134a1d
tags: [deployment, networking, nginx, dns]
---
# ADR-0005 — Messa online su LXC 110 con NPM e due domini

- **Stato:** accepted
- **Data:** 2026-09-12
- **Decide:** Deploy su LXC 110 (docker): sorgenti in /opt/my-ai, container `my-ai` sulla rete homelab senza porte host, raggiungibile

## Context

L'utente vuole portare My ai online con il dominio terraleonum.com (myai.terraleonum.com) e, in aggiunta, il sottodominio DuckDNS myai.terraleonum.duckdns.org. La porta 3000 di LXC 110 è occupata da AdGuard. Il DNS di terraleonum.com è gestito da Aruba e myai.terraleonum.com non punta ancora all'IP pubblico.

## Decision

Deploy su LXC 110 (docker): sorgenti in /opt/my-ai, container `my-ai` sulla rete homelab senza porte host, raggiungibile da NPM su 172.20.0.3:3000. Aggiunto APP_ORIGINS (lista di origin consentiti) per supportare due domini sullo stesso server. DuckDNS aggiornato con myai.terraleonum; CORS e APP_URL dello stack Supabase aggiornati ai domini pubblici. Le credenziali NPM non sono note all'assistente: la creazione dei proxy host è sospesa in attesa di una delle tre opzioni concordate (credenziali, inserimento manuale, utente tecnico temporaneo).

## Alternatives considerate

- Tailscale-only: scartato perché l'utente vuole un accesso web pubblico con dominio.
- Coolify (VM 120): scartato, il flusso Docker Compose + NPM su LXC 110 è già operativo e più semplice.

## Consequences

L'app gira su LXC 110 con IP homelab fisso per NPM; nessuna porta host (3000 occupata da AdGuard). Restano da fare: record A Aruba e due proxy host NPM con HTTPS. Le registrazioni pubbliche restano aperte su richiesta dell'utente, con il rischio di consumo del budget DeepSeek da parte di estranei.

## Status

accepted dal 2026-09-12.

