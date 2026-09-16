## [2026-09-11] init | Creata struttura .wiki/

## [2026-09-11] ingest | Scansione progetto completata

files-scanned: 1

## [2026-09-11] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-11] summarize | Stats: 2 pagine in 1 categorie

## [2026-09-11] ensure_init | Wiki inizializzata da MCP ensure_init

## [2026-09-11] decision | ADR-0001: BFF Next.js con Supabase dedicato e DeepSeek server-only

status: accepted

## [2026-09-11] sync | Codice → Wiki (diff report)

added: 40
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-11] decision | ADR-0002: Ricerca prima dell AI: lessicale garantito, vettoriale opzionale

status: accepted

## [2026-09-11] feature | Prima versione My ai: chat DeepSeek server-only, memoria a isole, ricerca prima dell AI, allegati con scope, desideri, indicatori, Approfondisci con lease/budget, account/export/delete, test SQL di isolamento (PGlite) e e2e Playwright; README e deploy Proxmox.

## [2026-09-11] decision | ADR-0002: Collegamento live a Supabase LXC105 condiviso e DeepSeek

status: accepted

## [2026-09-11] feature | Collegato live: migrazione su Supabase LXC105 (additiva, myai_*), chiave DeepSeek deepseek:default in .env.local, account di test attivati, e2e 13/13 verde con backend reale, fix standalone start (static+env) e retry PGRST303.

## [2026-09-11] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-11] fix | Wiki: corretto frontmatter YAML della decisione ricerca (due punti in title/decides) che bloccava memoria_sync.

## [2026-09-11] fix | Registrazione bloccata: giuseppegar33@gmail.com esisteva già su auth.users (da marzo, altra app). Reset password via GoTrue admin (apikey+Authorization con service role) e messaggi d'errore chiari per user_already_exists/invalid_credentials nell'app.

## [2026-09-11] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 1
stale_legacy_pages: 0

## [2026-09-11] decision | ADR-0003: Isolamento completo tra applicazioni con Supabase dedicato

status: accepted

## [2026-09-11] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-11] security | Chiarito requisito di isolamento tra app. Rimossa da .env.local la service-role dello stack Supabase condiviso e impostato ALLOW_AUTH_ACCOUNT_DELETION=false; verificato runtime accountDeletion=false. Nessun account, password, file o database esterno modificato in questo intervento. Decisione registrata per istanza Supabase dedicata; provisioning e migrazione ancora da eseguire.

## [2026-09-11] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-11] decision | ADR-0004: Stack Supabase dedicato e ripristino password dell'altra app

status: accepted

## [2026-09-11] sync | Codice → Wiki (diff report)

added: 7
removed: 0
changed: 3
stale_legacy_pages: 0

## [2026-09-11] build | Stack Supabase dedicato My ai attivo su LXC 105 porta 8010: credenziali, rete, volumi e chiavi proprie; marcatore myai_instance_id verificato dal BFF prima di Auth/dati; cookie dedicato; PGRST303 gestito come JWT invalido. Migrazione applicata solo al nuovo stack. Verifiche: 32 unit + 13 Playwright, smoke di isolamento (account, ricerca, file, cancellazione), JWTs incrociati rifiutati, account omonimo originale intatto, nessuna tabella/bucket altrui. Password account originale ripristinata su richiesta dell'utente. Documentazione README/deploy/infra aggiornata.

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 4
stale_legacy_pages: 0

## [2026-09-12] decision | ADR-0005: Messa online su LXC 110 con NPM e due domini

status: accepted

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-12] deploy | Messa online in corso: app `my-ai` attiva su LXC 110 (homelab 172.20.0.3:3000, sorgenti /opt/my-ai, .env 600), DuckDNS + CORS + APP_URL aggiornati ai domini pubblici, APP_ORIGINS implementato (35 test ok). SOSPESO: record A Aruba (myai → 87.8.228.159) e proxy host NPM (credenziali admin non note). Documentazione aggiornata: deploy/proxmox.md, README, ADR-0005. ADR-0005 aveva frontmatter YAML non valido (decides con ':') — riparato.

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 1
stale_legacy_pages: 0

## [2026-09-12] deploy | My ai ONLINE: myai.terraleonum.com + myai.terraleonum.duckdns.org via NPM su LXC 110 → my-ai (172.20.0.3:3000). Certificati Let's Encrypt emessi (scad. 2026-12-11). Blocco NPM risolto: v2.14.0 richiede riga user_permission per utente (senza → 404 API); usato utente tecnico temporaneo con backup DB, poi rimosso, admin intatto. Verificati via HTTPS: health, login, bootstrap, cookie HttpOnly dedicato, ricerca. Docs aggiornate.

## [2026-09-12] decision | ADR-0006: Runbook operativo e backup ripristinabile per My ai

status: accepted

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 2
removed: 0
changed: 2
stale_legacy_pages: 0

## [2026-09-12] lint | Health check: 6 issues trovate

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-12] lint | Health check: 6 issues trovate

## [2026-09-12] backup | Stato online e accesso Supabase salvati integralmente. Creato runbook deploy/supabase/README.md (copie su LXC 105 e /root/backups/my-ai/SUPABASE-RUNBOOK.md), strumenti status.py, backup.sh, verify-backup.sh. NPM normalizzato a DNS Docker my-ai:3000 con Force SSL/HTTP2, proprietà admin id1 e nessun utente tecnico residuo. Backup applicativo 20260912T113936Z (auth/storage/public + versioni estensioni + file + env/config root-only) ha superato restore reale temporaneo. Copie coordinate Supabase/app/NPM e checksum sul nodo Proxmox con symlink latest. 35 test, sintassi strumenti, HTTPS e TLS verificati; nessun valore segreto nei documenti. Backup automatici non pianificati.

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 1
stale_legacy_pages: 0

## [2026-09-12] docs | Runbook Supabase finale sincronizzato in tre copie (Mac, LXC 105, nodo Proxmox) con comando vi compatibile per .env; archivio app e checksum dello snapshot 20260912T113936Z rigenerati e verificati.

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-12] write | Aggiornata pagina: operativita-my-ai-supabase-dedicato

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-12] docs | Salvata esplicitamente in MCP Memoria la pagina architecture [[Operatività My ai e Supabase dedicato]] con URL, accesso SSH/psql, servizi, volumi, percorsi dei segreti senza valori, backup/ripristino verificato, NPM e avvertenze operative.

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-12] prompt | Salvato prompt: Correzione allegati e home centrata sulle isole

prompt_id: 2026-09-12-001

## [2026-09-12] decision | ADR-0007: Allegati leggibili localmente, con limiti e testo parziale espliciti

status: accepted

## [2026-09-12] decision | ADR-0008: Chat libera come ingresso illustrato, non quinta categoria persistente

status: accepted

## [2026-09-12] decision | ADR-0009: Build con parallelismo limitato sul LXC Docker condiviso

status: accepted

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 10
removed: 0
changed: 18
stale_legacy_pages: 0

## [2026-09-12] fix/deploy | Pubblicata correzione allegati e nuova home: PDF utente verificato in sola lettura (206 pagine, 441.164 caratteri), limiti 500/1M con estratti parziali espliciti, OCR locale ita+eng per foto/scansioni, link originali BFF accessibili da internet, contesto pertinente oltre le prime pagine. Cinque isole sotto indicatori, CTA ad alto contrasto 44px e chat libera. 60 test unità/SQL, typecheck/lint/build passati; 23 e2e locali (2 opt-in saltati), 5 prove candidato con OCR e AI reali, 11 e2e pubblici passati. Docker my-ai healthy e HTTPS entrambi domini verificati, 33 file runtime/config senza drift. Nessuna migrazione/riscrittura file utente: usare Reindicizza per il vecchio PDF. Prima build ha saturato RAM LXC: fermata e disponibilità ripristinata; build limitata a 2 thread/worker, heap 1024MB, RAM temporanea riportata a 4096MB (4 core/swap2048 invariati). Rollback my-ai:before-files-islands e backup /opt/my-ai-release-backups/source-before-files-islands-20260912T182657Z.tar.gz. ADR-0007/8/9 salvati; runbook aggiornato.

## [2026-09-12] decision | ADR-0010: Web sicuro: link aperti dal server con SSRF e ricerca solo su richiesta

status: accepted

## [2026-09-12] decision | ADR-0010: Generazione immagini via provider OpenAI-compatible, senza chiamate AI intermedie

status: accepted

## [2026-09-12] feature/deploy | Pubblicati web sicuro e immagini generate. Link incollati aperti dal server con blocco SSRF di reti private/loopback/metadata (max 3 link, 3 redirect, 2MB, 10s, solo testo); ricerca Tavily opzionale solo con chiave e pulsante esplicito; risultati web nel contesto come materiale non attendibile. Immagini via endpoint OpenAI-compatible (b64/url validato, max 1536px), salvate nel bucket privato come documenti origin=generated con galleria in chat, spostamento in memoria e limite giornaliero atomico myai_consume_image. Migrazione additiva 202609130001 applicata con backup 20260912T193226Z. UI: pulsanti Cerca nel web/Genera immagine mutuamente esclusivi con Approfondisci, errori onesti senza chiavi, nessuna chiamata AI per immagini. 73 test unitari (SSRF, adattatori con servizi simulati) + 27 e2e locali; candidato e dominio pubblico: 15 prove desktop/mobile superate, HTTPS entrambi i domini, container healthy. Rollback my-ai:before-web-images e backup sorgenti conservati. ADR-0010/0011 salvati; runbook aggiornato.

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-12] docs | Wiki sistemata: il titolo ADR con due punti interni rompeva il parser YAML della wiki e il sync; rinominata ADR-0010 (web) e ADR-0011 (immagini). Runtime/config remoti e locali coincidono (59 file).

## [2026-09-12] decision | ADR-0012: Immagini via OpenRouter, modello configurato da catalogo reale

status: accepted

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 4
stale_legacy_pages: 0

## [2026-09-12] config/deploy | Attivata generazione immagini in produzione via OpenRouter (openai/gpt-5-image, 1024x1024, limite 5/giorno). Flux richiesto non più nel catalogo OpenRouter: scelto il modello di punta disponibile, costo osservato ≈0,17 USD/immagine, alternative più economiche documentate. Chiave solo in /opt/my-ai/.env (600) con backup del file precedente; valutarne rotazione perché condivisa in chat. Patch: immagini generate salvate con status=ready (prima processing). Collaudo reale end-to-end: 201, PNG valido 2,9MB, anteprima privata 200, esterno 401, messaggi corretti, pulizia completa. La build della patch ha appeso il LXC per memoria (load 235): processi terminati, RAM temporanea 6144 poi ripristinata 4096, produzione sempre online. Rollback my-ai:before-image-status-patch. ADR-0012 salvato.

## [2026-09-12] decision | ADR-0013: Ricerca web via plugin OpenRouter, una chiave per immagini e ricerca

status: accepted

## [2026-09-12] feature/deploy | Ricerca web attivata via OpenRouter (plugin web, gemini-3.8-flash con reasoning spento, ≈0,028 USD/ricerca, limite 10/giorno con contatore atomico myai_consume_web e migrazione 202609130002 con backup 20260912T211330Z). Una sola chiave per immagini e ricerca; Tavily resta alternativa. Collaudo reale: chat con web attivo → DeepSeek ha citato il dato aggiornato trattandolo come materiale da verificare. Provider visibile in Impostazioni; messaggi di errore aggiornati senza menzione TAVILY. 74 test unitari + e2e web/immagini passati; deploy con RAM temporanea 6144 (ripristinata 4096), produzione sempre online. ADR-0013 salvato; runbook aggiornato.

## [2026-09-12] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-13] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-13] prompt | Salvato prompt: Icona schermata Home e ripristino layout mobile

prompt_id: 2026-09-13-001

## [2026-09-13] decision | ADR-0014: Schermata Home e strumenti compatti senza cache dei dati privati

status: accepted

## [2026-09-13] sync | Codice → Wiki (diff report)

added: 4
removed: 0
changed: 7
stale_legacy_pages: 0

## [2026-09-13] fix/deploy | Corretto logo schermata Home con PNG Apple 180 e Android 192/512 maskable + manifest standalone, nessun service worker/cache privata. Composer mobile ora compatto con disclosure Strumenti, focus/Escape, selezione esclusiva senza invio automatico, 44px touch, input16 e safe area. 78 unit/SQL, typecheck/lint/build e 61 e2e locali passati (2 AI opt-in saltati). 42 test UI/metadati candidato Docker + 42 pubblici Chromium/Pixel7/WebKit iPhone13 simulato, 320–1280px; 3 test pubblici login/mobile reali. Nessuna chiamata AI a pagamento, nessuna modifica DB/env. Buildkit temporaneo hard cap2GiB/2CPU, LXC6144MB temporanei poi4096 ripristinati, builder/candidato rimossi e altri servizi invariati. Produzione healthy su entrambi i domini. Rollback my-ai:before-mobile-ui, backup source-before-mobile-ui-20260913T071801Z.tar.gz. 44 file remoti/locali identici. ADR0014 e prompt2026-09-13-001 salvati. Collegamenti Home già creati potrebbero richiedere rimozione/nuova aggiunta; installazione fisica non verificata.

## [2026-09-13] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-13] prompt | Salvato prompt: Valutazione ricerca internet self-hosted, senza implementazione

prompt_id: 2026-09-13-002

## [2026-09-14] decision | ADR-0015: Salvataggio automatico di richieste e risposte come ricordi catalogati

status: accepted

## [2026-09-14] decision | ADR-0016: Video generati via API asincrona OpenRouter con conferma del credito

status: accepted

## [2026-09-14] prompt | Salvato prompt: Indicatori in fondo, salvataggio automatico, video OpenRouter

prompt_id: 2026-09-14-001

## [2026-09-14] feat/memoria-video | Implementate tre modifiche richieste: (1) indicatori analogici spostati in fondo alla pagina Home, sotto la chat; (2) salvataggio e catalogazione automatica di ogni richiesta con la risposta nello stesso ricordo, via trigger SQL security invoker (migrazione 202609140001_auto_memories.sql: reply_to_id, auto_conversation_id, auto_update, revoca nelle chat riservate, scope dei media generati, sintesi agenti salvata una volta sola, limite ricordi a 65.000 caratteri); (3) generazione video via API asincrona OpenRouter con conferma del credito, job durabili, quota separata, idempotenza, stato uncertain senza reinvio, MP4 privato con streaming Range (migrazione 202609140002_videos.sql, VIDEO_ENABLED=false di default). UI: quarto strumento "Genera video", monitor con polling 30s, player in chat e Documenti, messaggi e privacy aggiornati. Nessuna chiamata a pagamento nei test: provider simulato. Verifiche: 103 test unitari/SQL (PGlite con tutte le migrazioni), typecheck/lint/build, e2e Playwright simulati (auto-video, web-images, mobile-layout 320-1280px, anteprime desktop e mobile) tutti verdi; dry-run delle due migrazioni su PostgreSQL 15.8 reale con ROLLBACK (nessuna modifica persistita). Nota: bootstrap/accedi richiedono le migrazioni applicate, quindi le prove e2e autenticate e la produzione sono da aggiornare con backup. Nessun deploy eseguito.

## [2026-09-14] sync | Codice → Wiki (diff report)

added: 7
removed: 0
changed: 19
stale_legacy_pages: 0

## [2026-09-14] lint | Health check: 6 issues trovate

## [2026-09-14] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-14] decision | ADR-0017: Collaudo autenticato con AI simulata e HTTPS locale senza indebolire i cookie

status: accepted

## [2026-09-14] prompt | Salvato prompt: Autorizzazione backup, migrazioni Supabase dedicate e collaudo autenticato

prompt_id: 2026-09-14-002

## [2026-09-14] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-14] migration/test | Su autorizzazione 'procedi': verificata identità Supabase dedicato (/opt/myai-supabase, PostgreSQL15.8, project myai-supabase) contro SUPABASE_INSTANCE_ID locale. Backup 20260914T053145Z con ./backup.sh, restore di prova via verify-backup.sh riuscito e database temporaneo rimosso, SHA256SUMS verificati. Copia completa sul Mac deploy/supabase/backups/20260914T053145Z (dir700/file600, ignorata). Applicate 202609140001_auto_memories.sql (SHA e6a73841c385dfb920a99d40c189354672aeb1a67023a1e59f5a12168025f2ea) e 202609140002_videos.sql (SHA fc34838ce89b8a5fb78ef3a3b81308f3b3be0b081de7be34abbf997dba63c32f) in singola transazione, lock_timeout5s/statement_timeout60s, COMMIT e NOTIFY pgrst reload schema. RLS myai_video_jobs attiva; RPC start/claim invoker, consume quota definer; anon senza EXECUTE; bucket myai-private non pubblico, MP4 max52428800. Stato finale invariato:2utenti/2ricordi/22conversazioni/2documenti/2oggettiStorage/0videojobs, stessi ID di tutti i container, nessun intervento altri stack. Collaudo:103 unit/SQL, typecheck/lint/build verdi; nuova modalità test:e2e:authenticated con Supabase reale e stub AI localhost, TLS locale temporaneo per cookie Secure in WebKit. Prima prova HTTP:77pass,2skip,2Safari fail(cookies Secure su HTTP), corretta senza indebolire cookie app; prova completa HTTPS:79pass,2test AI reale skip,11chiamate stub (19totali inclusa prima prova), zero generazioni a pagamento.3test pubblici login/navigazione Pixel7 passati, health HTTPS entrambi domini OK. Fixture ripulite; quota del solo account test registra richieste simulate, non è stata azzerata. Aggiornati test isole, pulizia flusso Invio e opt-in TEST_CHAT_AI, aggiunti e2e autosave-auth, corretta frase del system prompt che parlava di salvataggio solo manuale; README/runbook aggiornati, .gitignore rafforzato. npm audit:0 vulnerabilità; nessun pattern segreto rilevato src/bundle, historygit assente/nonverificabile. ADR0017+prompt2026-09-14-002 salvati, corrette virgolette YAML del frontmatter generato da memoria, sync riuscito. IMPORTANTE: nessun deploy del nuovo frontend/BFF né abilitazione video; fino al deploy la produzione usa il BFF precedente (richieste possono essere catalogate dal trigger, ma risposta non collegata via reply_to_id).

## [2026-09-14] deploy | Deploy su LXC 110 del nuovo frontend/BFF (indicatori in fondo, salvataggio automatico domanda+risposta, strumento video disattivato, streaming MP4 con Range). Flusso: tag rollback my-ai:before-autosave-video (2efec8273eb0), backup sorgenti senza segreti /opt/my-ai-release-backups/source-before-autosave-video-20260914T064124Z.tar.gz (600, symlink source-latest-...), 105 file copiati con manifest SHA-256 verificato e confronto elenco in ordine C. Build in builder temporaneo buildx docker-container con hard cap 2GiB/2CPU (nohup, log /tmp/myai-build.log), RAM LXC alzata temporaneamente 4096→6144 e ripristinata 4096, builder/candidato/stub rimossi, /tmp ripulito, porta 3311 chiusa. Candidato my-ai:autosave-video-candidate su 127.0.0.1:3311 con env-file reale ma HOSTNAME=0.0.0.0, APP_URL/ORIGINS loopback, DEEPSEEK_BASE_URL a stub node:22-alpine nello stesso namespace di rete (solo loopback, nessuna esposizione LAN), IMAGE/OPENROUTER/TAVILY/OLLAMA azzerate: bootstrap candidato con web=false, images=false, videos=false, model e2e-local-stub. Collaudo candidato via tunnel SSH: 59 passati, 2 saltati (document-ai opt-in), 0 falliti, su database reale. Promozione: tag my-ai:local dalla candidata, docker compose up -d --no-build --wait --wait-timeout 90, container healthy. Verifica dopo la promozione: health HTTPS OK su myai.terraleonum.com e myai.terraleonum.duckdns.org; capabilities produzione con web=true, images=true, videos=false, model deepseek-flash; suite completa sul dominio pubblico 71 passati/10 saltati/0 falliti (salti: document-ai e autosave-auth e invio-AI che richiedono modelli reali o lo stub locale); solo my-ai ricreato, altri 25 container intatti e con uptime invariato. Dati invariati: 2 utenti/2 ricordi/22 conversazioni/2 documenti/2 oggetti storage/0 job video; status.py OK con backup 20260914T053145Z. Nessuna modifica a .env: video spenti perché VIDEO_ENABLED è assente; per abilitarli serve VIDEO_ENABLED=true (chiave da OPENROUTER_API_KEY o IMAGE_API_KEY con IMAGE_BASE_URL OpenRouter) e docker compose up -d. Deploy aggiornati: deploy/proxmox.md sezione 2026-09-14 con rollback e procedura; README migrazioni e test; deploy/supabase/README stato deploy. Da fare prima di abilitare i video: una generazione reale controllata per verificare modello e listino.

## [2026-09-14] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 3
stale_legacy_pages: 0

## [2026-09-14] decision | ADR-0018: Video abilitati in produzione con veo-3.1-lite 4s 720p senza audio

status: accepted

## [2026-09-14] attivazione/video | Su richiesta "attiva": abilitata la generazione video in produzione. Copia di sicurezza /opt/my-ai/.env.bak-video-20260914T070949Z (600), nuova riga VIDEO_ENABLED=true con commento; solo container my-ai ricreato con docker compose up -d --wait, healthy. Capabilities pubbliche ora videos=true, videoModel=google/veo-3.1-lite, videoDuration=4, videoResolution=720p, senza modifiche agli altri servizi. Collaudo reale controllato end-to-end tramite la produzione e l account di test (nessuna apertura di browser): login con cookie a chunk, conversazione di prova, POST /api/videos (202, pending), refresh fino a completed in meno di un minuto, costo segnalato dal provider 0,12 USD, MP4 da 3.784.820 byte archiviato nel bucket privato, GET /file HTTP 200 con accept-ranges: bytes e Range 0-99 -> 206 content-range corretto, ricordo automatico trovato dalla ricerca, chat con i 2 messaggi attesi (richiesta + esito). Pulizia completa (documento, ricordo, conversazione) con HTTP 200; database riportato alla baseline: 0 job video, 0 MP4 orfani, 2 ricordi, 22 conversazioni, 2 documenti, 2 oggetti storage; resta solo video_oggi=1 per l account di test come traccia reale della quota. Documentazione aggiornata (README tabella integrazioni e limiti, deploy/proxmox.md con abilitazione e rollback, deploy/supabase/README.md, commento in .env.example). Nessuna modifica a Supabase, agli altri container o agli altri stack.

## [2026-09-14] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 3
stale_legacy_pages: 0

## [2026-09-16] sync | Codice → Wiki (diff report)

added: 2
removed: 0
changed: 9
stale_legacy_pages: 0

## [2026-09-16] decision | ADR-0019: Artefatti di testo: output JSON, revisione su anteprima e scope chat-only

status: accepted

## [2026-09-16] prompt | Salvato prompt: Deploy della release con file di testo e artefatti su My ai

prompt_id: 2026-09-16-001

## [2026-09-16] deploy | Release file di testo e artefatti pubblicata su LXC 110. Contenuto: strumento Genera file di testo (DeepSeek con output JSON title/filename/content/summary e fallback al testo grezzo), editor manuale titolo/contenuto, revisione AI solo su anteprima con conferma, "Salva come file di testo" dalle risposte della chat, copia/download dal BFF autenticato, allegati .md accettati. Nessuna migrazione e nessuna modifica a /opt/my-ai/.env. Flusso: tag rollback my-ai:before-artifacts (immagine precedente 3617ac71fc69), backup sorgenti senza segreti /opt/my-ai-release-backups/source-before-artifacts-20260916T093210Z.tar.gz (600, symlink source-latest-before-artifacts.tar.gz), copia di 109 file con manifest SHA-256 verificato, build nel builder temporaneo myai-builder (docker-container, hard cap 2 GiB/2 CPU), candidato my-ai:artifacts-candidate su 127.0.0.1:3311 con AI simulata nello stesso namespace (web/immagini/video spenti, chiavi provider azzerate), promozione con docker compose -f docker-compose.prod.yml up -d --no-build --wait --wait-timeout 90. RAM LXC alzata temporaneamente 4096->6144 e ripristinata 4096; builder, candidato, stub e tunnel rimossi; solo my-ai ricreato (immagine 66ec0eeb445e, healthy), altri contenitori intatti. Aggiunti tests/e2e/artifacts-auth.spec.ts (creazione/modifica/download/ricerca, privacy chat-only e generazione con AI simulata) e aggiornato il test di tastiera degli strumenti; progetto mobile-safari esteso al nuovo spec. Collaudo: 111 test unitari/SQL verdi; runner autenticato locale 88 passati/2 saltati/0 falliti; candidato Docker su database reale 63 passati/2 saltati/0 falliti via tunnel SSH (durante il collaudo l'account di test ha esaurito la quota AI giornaliera di 50 chiamate: il solo candidato ha usato AI_DAILY_CALL_LIMIT=100, poi rimosso; la produzione mantiene il valore di .env); dominio pubblico 77 passati/13 saltati/0 falliti su Chromium, Pixel 7 e WebKit/iPhone 13; health HTTPS OK su myai.terraleonum.com e myai.terraleonum.duckdns.org; capabilities invariate (deepseek-flash, web, immagini, video google/veo-3.1-lite, OCR, senza vision/embeddings). Dati riportati alla baseline e Supabase non toccato: 2 utenti, 6 ricordi, 23 conversazioni, 3 documenti, 3 oggetti storage; status.py OK (ultimo backup 20260914T053145Z). Documentazione aggiornata e copiata sul server con checksum: README (nuova voce funzionalità, limiti, numeri di collaudo) e deploy/proxmox.md (sezione 2026-09-16 con procedura e rollback). Nessuna generazione reale via DeepSeek in collaudo: contratto JSON già usato dagli agenti e coperto dai test; la prima generazione reale dall'account utente consuma la quota AI giornaliera come le altre chiamate. Rollback pronto: ritaggare my-ai:before-artifacts come my-ai:local e ripristinare i sorgenti dal tarball. ADR-0019 e prompt 2026-09-16-001 salvati.

## [2026-09-16] sync | Codice → Wiki (diff report)

added: 0
removed: 0
changed: 0
stale_legacy_pages: 0

## [2026-09-16] lint | Health check: 6 issues trovate

