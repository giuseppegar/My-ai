# File Map

Mappa di tutti i file del progetto con descrizione e dipendenze.

## Code

- **`AGENTS.md`** (47 righe) — Questo progetto usa memoria, un sistema di memoria Wiki-Code per sviluppo LLM-as
- **`Dockerfile`** (24 righe) — Il build condivide il LXC con altre app: limita thread Rust e heap Node.
- **`README.md`** (129 righe) — Chat AI personale in italiano, memoria illustrata a isole, ricerca prima dell'AI
- **`deploy/proxmox.md`** (100 righe) — - Backend dati: stack Supabase DEDICATO myai-supabase su LXC 105 (ssh supabase),
- **`deploy/supabase/README.md`** (254 righe) — Questa è l'istanza self-hosted separata usata esclusivamente da My ai. Non è il 
- **`deploy/supabase/backups/20260914T053145Z/extensions.txt`** (5 righe) — pg_trgm=1.6
pgcrypto=1.3
pgjwt=0.2.0
uuid-ossp=1.1
vector=0.8.0
- **`deploy/supabase/backups/20260914T053145Z/manifest.txt`** (6 righe) — created_utc=2026-09-14T05:31:45Z
compose_project=myai-supabase
database_image=su
- **`deploy/supabase/backups/20260914T053145Z/stack.env`** (11 righe) — Segreti esclusivi My ai: non stampare né versionare.
- **`deploy/supabase/compose.yml`** (164 righe) — Documento YAML con 5 chiavi top-level
- **`deploy/supabase/generate_env.py`** (69 righe, 3 funzioni) — Genera credenziali nuove e indipendenti. Non legge né copia altri stack.
- **`deploy/supabase/kong.yml`** (60 righe) — Documento YAML con 5 chiavi top-level
- **`deploy/supabase/status.py`** (94 righe, 4 funzioni) — Controllo operativo dello stack dedicato My ai senza stampare segreti o dati per
- **`docker-compose.prod.yml`** (30 righe) — Documento YAML con 2 chiavi top-level
- **`next-env.d.ts`** (7 righe) — / <reference types="next" /> / <reference types="next/image-types/global" />
- **`next.config.ts`** (18 righe) — File .ts in My ai
- **`package-lock.json`** (7754 righe) — Oggetto JSON con 5 chiavi top-level
- **`package.json`** (46 righe) — Oggetto JSON con 7 chiavi top-level
- **`scripts/smoke-isolation.py`** (113 righe, 2 funzioni) — Smoke test sul SOLO backend dedicato: due account di test, file, RLS, cancellazi
- **`src/app/api/[...path]/route.ts`** (285 righe, 3 funzioni) — File .ts in [...path]
- **`src/app/error.tsx`** (4 righe, 1 funzioni) — File .tsx in app
- **`src/app/globals.css`** (55 righe) — File .css in app
- **`src/app/layout.tsx`** (13 righe, 1 funzioni) — File .tsx in app
- **`src/app/manifest.ts`** (21 righe, 1 funzioni) — File .ts in app
- **`src/app/page.tsx`** (2 righe, 1 funzioni) — File .tsx in app
- **`src/components/account.tsx`** (74 righe, 2 funzioni) — File .tsx in components
- **`src/components/agents-panel.tsx`** (65 righe, 5 funzioni) — File .tsx in components
- **`src/components/archipelago.tsx`** (34 righe, 1 funzioni) — File .tsx in components
- **`src/components/composer.tsx`** (135 righe, 8 funzioni) — File .tsx in components
- **`src/components/dashboard.tsx`** (310 righe, 23 funzioni) — File .tsx in components
- **`src/components/editors.tsx`** (138 righe, 1 funzioni) — File .tsx in components
- **`src/components/island.tsx`** (93 righe, 2 funzioni) — File .tsx in components
- **`src/components/ui.tsx`** (40 righe, 2 funzioni) — File .tsx in components
- **`src/components/video-jobs.tsx`** (49 righe, 3 funzioni) — File .tsx in components
- **`src/lib/agent-plan.ts`** (28 righe, 3 funzioni) — File .ts in lib
- **`src/lib/demo.ts`** (18 righe, 1 funzioni) — File .ts in lib
- **`src/lib/document-context.ts`** (20 righe, 1 funzioni) — File .ts in lib
- **`src/lib/domain.ts`** (34 righe, 1 funzioni) — File .ts in lib
- **`src/lib/search.ts`** (33 righe, 4 funzioni) — Espansione lessicale deterministica: non è un embedding e non chiama un LLM.
- **`src/lib/validation.ts`** (17 righe, 1 funzioni) — File .ts in lib
- **`src/server/agents.ts`** (89 righe, 4 funzioni) — File .ts in server
- **`src/server/ai.ts`** (43 righe, 5 funzioni) — File .ts in server
- **`src/server/artifacts.ts`** (240 righe, 4 funzioni) — File .ts in server
- **`src/server/core.ts`** (90 righe, 13 funzioni, 1 classi) — File .ts in server
- **`src/server/files.ts`** (204 righe, 12 funzioni) — File .ts in server
- **`src/server/images.ts`** (40 righe, 1 funzioni) — Solo testo → immagine, un'immagine per richiesta. Il provider riceve esclusivame
- **`src/server/instance.ts`** (24 righe, 1 funzioni) — File .ts in server
- **`src/server/ocr.ts`** (57 righe, 3 funzioni) — File .ts in server
- **`src/server/retrieval.ts`** (66 righe, 3 funzioni) — File .ts in server
- **`src/server/video-config.ts`** (18 righe, 2 funzioni) — File .ts in server
- **`src/server/video-file.ts`** (48 righe, 2 funzioni) — File .ts in server
- **`src/server/videos.ts`** (144 righe, 12 funzioni) — File .ts in server
- **`src/server/web.ts`** (177 righe, 16 funzioni) — Solo sviluppo/test locale: consente di puntare i test a un server in ascolto su 
- **`tests/app-icons.test.ts`** (34 righe) — File .ts in tests
- **`tests/artifacts.test.ts`** (345 righe, 2 funzioni) — File .ts in tests
- **`tests/core-isolation.test.ts`** (70 righe, 1 funzioni) — File .ts in tests
- **`tests/domain.test.ts`** (63 righe) — File .ts in tests
- **`tests/e2e/artifacts-auth.spec.ts`** (140 righe, 3 funzioni) — File .ts in e2e
- **`tests/e2e/artifacts/.last-run.json`** (4 righe) — Oggetto JSON con 2 chiavi top-level
- **`tests/e2e/auth.setup.ts`** (33 righe) — File .ts in e2e
- **`tests/e2e/auto-video.spec.ts`** (116 righe, 3 funzioni) — File .ts in e2e
- **`tests/e2e/autosave-auth.spec.ts`** (71 righe, 2 funzioni) — File .ts in e2e
- **`tests/e2e/document-ai.spec.ts`** (26 righe) — File .ts in e2e
- **`tests/e2e/documents.spec.ts`** (120 righe, 3 funzioni) — File .ts in e2e
- **`tests/e2e/flows.spec.ts`** (86 righe, 1 funzioni) — File .ts in e2e
- **`tests/e2e/install.spec.ts`** (30 righe) — File .ts in e2e
- **`tests/e2e/islands.spec.ts`** (45 righe) — File .ts in e2e
- **`tests/e2e/mobile-layout.spec.ts`** (125 righe, 1 funzioni) — File .ts in e2e
- **`tests/e2e/mobile.spec.ts`** (36 righe, 1 funzioni) — File .ts in e2e
- **`tests/e2e/preview.desktop.spec.ts`** (42 righe) — File .ts in e2e
- **`tests/e2e/preview.mobile.spec.ts`** (14 righe) — File .ts in e2e
- **`tests/e2e/web-images.spec.ts`** (90 righe, 2 funzioni) — These are UI guards, not paid provider tests. Exercise the unavailable state det
- **`tests/files.test.ts`** (130 righe, 4 funzioni) — File .ts in tests
- **`tests/fixtures/documents.ts`** (39 righe, 3 funzioni) — Synthetic fixtures only: no user documents or external resources.
- **`tests/images.test.ts`** (72 righe, 2 funzioni) — File .ts in tests
- **`tests/instance.test.ts`** (58 righe) — File .ts in tests
- **`tests/isolation.test.ts`** (246 righe, 3 funzioni) — PostgreSQL reale in WASM. Auth/Storage sono fixture minime, non un'istanza Supab
- **`tests/ocr.test.ts`** (60 righe) — File .ts in tests
- **`tests/retrieval.test.ts`** (48 righe, 1 funzioni) — File .ts in tests
- **`tests/server-only.ts`** (2 righe) — Stub esclusivamente nel runner di test. Next.js usa il vero guard server-only.
- **`tests/video-file.test.ts`** (43 righe, 1 funzioni) — File .ts in tests
- **`tests/videos.test.ts`** (190 righe, 5 funzioni) — File .ts in tests
- **`tests/web.test.ts`** (103 righe, 1 funzioni) — File .ts in tests
- **`tsconfig.json`** (21 righe) — Oggetto JSON con 3 chiavi top-level

## Prompts

- **`.wiki/prompts/2026-09-12-001-correzione-allegati-e-home-centrata-sulle-isole-9b3e5e6d.md`** (1 righe) — Correzione allegati e home centrata sulle isole
- **`.wiki/prompts/2026-09-13-001-icona-schermata-home-e-ripristino-layout-mobile-82b00f90.md`** (1 righe) — Icona schermata Home e ripristino layout mobile
- **`.wiki/prompts/2026-09-13-002-valutazione-ricerca-internet-self-hosted-senza-implementazio-1b5f8c99.md`** (1 righe) — Valutazione ricerca internet self-hosted, senza implementazione
- **`.wiki/prompts/2026-09-14-001-indicatori-in-fondo-salvataggio-automatico-video-openrouter-29910f7e.md`** (1 righe) — Indicatori in fondo, salvataggio automatico, video OpenRouter
- **`.wiki/prompts/2026-09-14-002-autorizzazione-backup-migrazioni-supabase-dedicate-e-collaud-332424e9.md`** (1 righe) — Autorizzazione backup, migrazioni Supabase dedicate e collaudo autenticato
- **`.wiki/prompts/2026-09-16-001-deploy-della-release-con-file-di-testo-e-artefatti-su-my-ai-c2da5bd2.md`** (1 righe) — Deploy della release con file di testo e artefatti su My ai
