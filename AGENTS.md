# AGENTS.md — memoria

Questo progetto usa **memoria**, un sistema di memoria Wiki-Code per sviluppo LLM-assistito.

## Auto-attivazione

**Ogni volta che entri in questo progetto, `memoria_ensure_init` viene chiamato automaticamente.**

## Regole

1. **All'inizio di un task**: usa `memoria_recap "<task>"` per ricostruire il contesto (decisioni+file+log+drift) in una sola chiamata
2. **Prima di modificare codice**: cerca nella wiki con `memoria_query` (ranking con boost decisioni/architettura)
3. **Decisioni importanti**: salva un ADR con `memoria_save_decision` (Context/Decision/Alternatives/Consequences) — e l'asset piu prezioso, il *perche* non deducibile dal codice
4. **Dopo aver modificato codice**: esegui `memoria_sync` (diff report) e `memoria_log`
5. **Salva i prompt**: con `memoria_save_prompt` passando `analysis` per analisi completa
6. **Verifica le asserzioni**: se una pagina architecture fa claim tecnici (es. 'la funzione X ha firma Y'), aggiungi `verified_against` nel frontmatter ed esegui `memoria_verify` — la wiki deve essere 'verificata o marcita', non potenzialmente bugiarda
7. **Link tra wiki**: usa `[[PageName]]` per wikilink
8. **NON generare riassunti del codice**: l'LLM ha gia il codice. La wiki registra il *perche*, non il *cosa*. Usa la categoria `decisions`/`architecture`, non pagine AST-dump.

## Strumenti MCP disponibili

- `memoria_ensure_init` — inizializza o sincronizza la wiki (chiamare sempre all'inizio)
- `memoria_recap` — **one-shot handoff**: contesto completo per un task (decisioni+file+log+drift)
- `memoria_save_decision` — salva un ADR (l'asset #1: il perche)
- `memoria_list_decisions` / `memoria_read_decision` — elenca/leggi ADR
- `memoria_verify` — verifica i claim delle pagine contro il codice reale
- `memoria_query` — cerca nella wiki (ranking FTS5 + boost categorie)
- `memoria_read` — legge una pagina wiki
- `memoria_write` — scrive/aggiorna una pagina wiki
- `memoria_sync` — diff report codice ↔ wiki (NON genera pagine codice)
- `memoria_lint` — health check (orfani, broken link, verify falliti, drift)
- `memoria_log` — registra operazione nel log
- `memoria_status` — dashboard del progetto
- `memoria_save_prompt` — salva e analizza un prompt
- `memoria_list_prompts` / `memoria_read_prompt` / `memoria_update_prompt_analysis`
- `memoria_parse` — analisi approfondita di un file
- `memoria_obsidian_sync` — sync con vault Obsidian

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
