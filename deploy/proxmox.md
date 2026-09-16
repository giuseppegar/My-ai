# Note di distribuzione sulla infrastruttura Proxmox

## Stato reale (aggiornato 2026-09-16)

- **Backend dati:** stack Supabase DEDICATO `myai-supabase` su LXC 105 (`ssh supabase`), directory `/opt/myai-supabase`, porta LAN `192.168.1.17:8010`. Segreti in `/opt/myai-supabase/.env` (600). Il BFF verifica il marcatore `myai_instance_id()` prima di ogni operazione.
- **App:** container `my-ai` su LXC 110 (`ssh docker`), sorgenti in `/opt/my-ai`, avviato con `docker compose -f docker-compose.prod.yml up -d --no-build --wait --wait-timeout 90` dopo la preparazione e il collaudo dell’immagine. Porta interna 3000, **nessuna porta sull'host** (la 3000 è di AdGuard). NPM lo raggiunge tramite il DNS Docker stabile `my-ai:3000` sulla rete `homelab`, quindi la ricreazione del container non rompe il proxy.
- **Segreti app:** `/opt/my-ai/.env` (600, `env_file`). Contiene `APP_URL=https://myai.terraleonum.com` e `APP_ORIGINS=https://myai.terraleonum.com,https://myai.terraleonum.duckdns.org` oltre a Supabase/DeepSeek. Mai in git, mai nei log.
- **CORS/redirect:** lo stack My ai consente gli origin `localhost`, `myai.terraleonum.com` e `myai.terraleonum.duckdns.org`; `APP_URL` dello stack = dominio principale.

## Accesso da internet (COMPLETATO 2026-09-12)

- **Domini attivi:** `https://myai.terraleonum.com` e `https://myai.terraleonum.duckdns.org`, entrambi → NPM → `my-ai:3000` con Force SSL, HTTP/2, Websockets e Block Exploits.
- **Certificati Let's Encrypt:** emessi 2026-09-12, scadenza 2026-12-11, rinnovo automatico NPM.
- **DNS:** record `myai` su `terraleonum.com` aggiunto dall'utente (CNAME → duckdns); `myai.terraleonum` in DuckDNS.
- **Verificato via HTTPS:** health, login, bootstrap, cookie HttpOnly dedicato, ricerca.
- **Nota tecnica NPM:** v2.14.0 richiede una riga `user_permission` per utente (altrimenti 404 sugli endpoint API). Gli host sono stati creati/normalizzati con un utente tecnico temporaneo, poi rimosso; admin originale intatto. Backup coerente finale: `/opt/nginxproxymanager/data/database.sqlite.bak-myai-online-latest`.

## Registrazioni

Aperte su richiesta dell'utente (10-09-2026): chiunque può registrarsi e consumare il budget DeepSeek (limite 50 chiamate/giorno per utente); da rivalutare.

## Runbook e backup

- Accesso, comandi SQL, segreti, migrazioni, backup e ripristino: `deploy/supabase/README.md`.
- Backup Supabase **ripristinato con successo in un database temporaneo**: `/opt/myai-supabase/backups/latest`.
- Copia fuori dai LXC sul nodo Proxmox: `/root/backups/my-ai/` (`LATEST`, archivio Supabase, archivio app con configurazione, snapshot NPM e SHA256).

## Aggiornamento dell'app

Sull'host Docker: backup/tag di rollback → copia sorgenti senza segreti (il Mac usa `tar` via SSH) → build limitata e collaudo candidato → tag `my-ai:local` → `cd /opt/my-ai && docker compose -f docker-compose.prod.yml up -d --no-build --wait --wait-timeout 90`. Non avviare una build non limitata sul LXC condiviso; vedere il collaudo mobile sotto.
Sullo stack Supabase: `cd /opt/myai-supabase && docker compose up -d` (ricrea auth/gateway quando cambiano `.env` o `kong.yml`).

## Aggiornamento allegati e isole (2026-09-12)

- Pubblicati: PDF fino a 500 pagine / 1.000.000 caratteri con lettura parziale esplicita, OCR locale Tesseract `ita+eng` e Poppler, originali same-origin autenticati, cinque isole sotto gli indicatori con CTA in evidenza. Nessuna migrazione database e nessuna modifica ai segreti.
- Vecchi PDF con errore: **Documenti → Reindicizza**. Non sono stati modificati automaticamente i documenti degli utenti.
- Collaudo Docker candidato, prima della promozione: upload/ricerca/riapertura PDF lungo, DOCX/TXT, OCR reale su PNG/JPG/GIF/WebP e scansione PDF; una chiamata DeepSeek ha recuperato il codice sintetico a pagina 206. Dopo la promozione: 11 prove Playwright desktop/mobile sul dominio pubblico superate, health HTTPS su entrambi i domini e container `healthy`.
- Rollback immagine disponibile: `my-ai:before-files-islands`. Backup sorgenti senza segreti: `/opt/my-ai-release-backups/source-before-files-islands-20260912T182657Z.tar.gz`. I backup completi precedenti del runbook restano intatti.
- La prima build non limitata ha provocato pressione di memoria nel LXC condiviso e indisponibilità temporanea. Build interrotta; RAM aumentata temporaneamente a 6144 MB per sbloccare il contenitore, poi ripristinata a **4096 MB**, con 4 core e swap 2048 MB invariati. Nessun riavvio del LXC o dei database.
- Per evitare parallelismo eccessivo: Docker build usa `RAYON_NUM_THREADS=2` e heap Node massimo 1024 MB; Next usa 2 worker. Controllare comunque memoria disponibile prima di compilare sul LXC condiviso; preferire un builder separato se non c’è margine. Promuovere solo immagini già collaudate.
- Compose imposta `HOSTNAME=0.0.0.0`: corregge il healthcheck su 127.0.0.1, prima irraggiungibile perché Next si legava al solo hostname/IP Docker.

## Web e immagini generate (2026-09-13)

- Pubblicati: ricerca web facoltativa (Tavily) con “Cerca nel web” e apertura di link incollati sempre protetta da SSRF; generazione immagini via endpoint OpenAI-compatible con galleria in chat e limite giornaliero separato. Nessuna chiamata AI per generare immagini; il provider riceve solo il prompt.
- **Ricerca web attiva via OpenRouter:** `WEB_SEARCH_PROVIDER=openrouter`, `OPENROUTER_WEB_MODEL=google/gemini-3.8-flash` con reasoning spento, stessa chiave delle immagini, limite 10 ricerche/giorno per utente (contatore atomico `myai_consume_web`, migrazione `202609130002_web_quota.sql` applicata con backup `20260912T211330Z`). Costo osservato ≈ 0,028 USD/ricerca; il plugin restituisce risposta sintetica e fonti, che entrano nel contesto di DeepSeek come materiale non attendibile. Tavily resta supportata (`WEB_SEARCH_PROVIDER=tavily`). Collaudo reale: chat con web attivo → DeepSeek ha risposto citando il dato aggiornato e ricordando di verificarlo. 
- **Provider immagini attivo:** OpenRouter (`IMAGE_BASE_URL=https://openrouter.ai/api/v1`) con `IMAGE_MODEL=openai/gpt-5-image`, 1024×1024, limite 5 immagini/giorno. Costo osservato in collaudo ≈ 0,17 USD a immagine; `gpt-5-image-mini` e `gemini-3.1-flash-image` sono alternative più economiche sullo stesso endpoint (una riga nel `.env`). `black-forest-labs/flux.2-pro` richiesto inizialmente ma **non più presente nel catalogo OpenRouter** (445 modelli, nessun Black Forest Labs): per Flux servirebbe un altro provider con chiave dedicata e un piccolo adattatore. La chiave OpenRouter vive solo in `/opt/my-ai/.env` (600); backup del file precedente `.env.bak-web-images-*` accanto. Poiché la chiave è stata condivisa in chat, valutarne la rotazione su OpenRouter.
- Collaudo reale: generazione attraverso l’API dell’app verificata (201, stato `ready`, PNG valido ~2,9 MB, anteprima privata 200, accesso esterno 401, messaggi user+assistant in chat, pulizia completa). Due chiamate di collaudo fatturate (~0,33 USD) più una per la verifica del payload (~0,17 USD).
- **Migrazione** `202609130001_web_images.sql` applicata allo stack dedicato dopo backup (colonna `origin` su `myai_documents`, colonna `images` su `myai_daily_usage`, funzione `myai_consume_image`). Nessuna modifica ai dati esistenti; `origin` ha default `upload`.
- Chiavi: `OPENROUTER_API_KEY` condivisa da ricerca web e immagini; `IMAGE_API_KEY` + `IMAGE_BASE_URL`/`IMAGE_MODEL`/`IMAGE_SIZE` per le immagini. Aggiungere chiavi a `/opt/my-ai/.env` (600) e ricreare con `docker compose up -d`; nessuna migrazione aggiuntiva.
- Collaudo prima della promozione: candidato verificato con 15 prove Playwright desktop/mobile (allegati, isole, web/immagini non configurati) su database reale; dopo la promozione le stesse 15 prove sul dominio pubblico + health HTTPS su entrambi i domini. 73 test unitari/SQL passati, inclusi SSRF e adattatori provider con servizi simulati.
- **Patch stato immagini:** le immagini generate erano salvate con stato `processing` (mai aggiornato): ora inserite direttamente con `ready`. La build della patch ha nuovamente appeso il LXC per pressione memoria (load ~235, swap pieno); processi di build terminati, RAM alzata temporaneamente a 6144 MB per completare la build e ripristinata a 4096 MB. Il container di produzione è rimasto online per tutta la finestra. Rollback disponibili: `my-ai:before-image-status-patch`, `my-ai:before-web-images`; backup sorgenti in `/opt/my-ai-release-backups/`; backup Supabase pre-migrazione `20260912T193226Z`.

## Correzione mobile e icona Home (2026-09-13)

- Logo bussola in PNG opaco (Apple 180 px, Android 192/512 px e maskable), manifest standalone e metadati Apple. Nessun service worker, nessuna cache offline dei dati privati. Per vecchi collegamenti senza logo, rimuovere solo il collegamento e aggiungerlo di nuovo dopo il refresh.
- Composer compatto con **Strumenti** a richiesta per Web, Approfondisci e Immagini; solo una modalità attiva, mostrata sul selettore. Il cambio strumento preserva bozza/allegati e non avvia servizi. Invio accessibile da 320 px, controlli touch da 44 px, input da 16 px, safe area e zoom non bloccato.
- Verifiche locali: typecheck/lint/build, **78 test unitari/SQL**, **61 e2e passati e 2 test AI opt-in saltati**. **42 prove UI/metadati sul candidato Docker e 42 sul dominio pubblico**, Chromium + Pixel 7 + WebKit/iPhone 13 simulato, viewport 320–1280 px. Aggiunte 3 prove pubbliche con login reale e navigazione mobile. I test UI usano fixture sintetiche/provider simulati, senza ricerche o immagini a pagamento; installazione Home reale da confermare sul telefono.
- Build in builder temporaneo `docker-container` con hard cap **2 GiB senza swap aggiuntivo e 2 CPU** (`memory=2g,memory-swap=2g,cpu-quota=200000,cpu-period=100000`). Dopo verifica del margine sul nodo, RAM LXC temporaneamente a 6144 MB, poi **ripristinata a 4096 MB**. Builder rimosso. Non dedurre dalla sola disponibilità di swap che ci sia margine per compilare; gli heap Node non sono un limite complessivo.
- Candidato su porta loopback, accessibile solo dal tunnel SSH, rimosso dopo il collaudo. Nessuna modifica a `.env`, schema/database o altri servizi. Entrambi i domini rispondono e il container è `healthy`.
- Rollback immagine **`my-ai:before-mobile-ui`**. Backup sorgenti senza segreti `/opt/my-ai-release-backups/source-before-mobile-ui-20260913T071801Z.tar.gz`. Per ripristinare il runtime, ritaggare il rollback come `my-ai:local` e usare il comando Compose `--no-build` sopra; per le build successive ripristinare anche i sorgenti dal backup.

## Indicatori in fondo, salvataggio automatico e video (2026-09-14)

- Pubblicati su LXC 110: indicatori analogici spostati **sotto la chat**, salvataggio e catalogazione automatica di richieste e risposte, quarto strumento **Genera video** (disattivato), streaming MP4 con `Range` dal BFF, privacy aggiornata. Codice allineato al database già migrato lo stesso giorno (`202609140001`, `202609140002`).
- Flusso: tag rollback `my-ai:before-autosave-video` (immagine precedente `2efec8273eb0`), backup sorgenti senza segreti `/opt/my-ai-release-backups/source-before-autosave-video-20260914T064124Z.tar.gz`, copia di 105 file con manifest SHA-256 verificato e confronto elenco in ordine C, build in builder temporaneo con hard cap 2 GiB/2 CPU, candidato su loopback `127.0.0.1:3311`, promozione con `docker compose -f docker-compose.prod.yml up -d --no-build --wait --wait-timeout 90`. RAM del LXC alzata temporaneamente a 6144 MB e **ripristinata a 4096 MB**; builder e candidato rimossi; solo `my-ai` ricreato, gli altri 25 container intatti.
- **Nessuna modifica a `.env`**: video spenti perché `VIDEO_ENABLED` è assente. Per abilitarli servono `VIDEO_ENABLED=true` (la chiave arriva da `OPENROUTER_API_KEY`, o da `IMAGE_API_KEY` quando `IMAGE_BASE_URL` punta a OpenRouter), quindi `docker compose up -d`.
- Collaudo candidato: **59 passati, 2 saltati** (prove AI a pagamento) su database reale con AI simulata in un contenitore collegato al namespace del candidato, quindi raggiungibile solo su `127.0.0.1`. Chiavi `IMAGE`, `OPENROUTER`, `TAVILY` e `OLLAMA` azzerate nel solo candidato: nessun provider esterno raggiungibile.
- Dopo la promozione: **71 passati, 10 saltati, 0 falliti** sul dominio pubblico (desktop, Pixel 7, WebKit/iPhone 13 simulato) e health HTTPS su entrambi i domini. I 10 saltati sono le prove che richiedono AI reale o il runner simulato locale.
- Dati invariati: 2 utenti, 2 ricordi, 22 conversazioni, 2 documenti, 2 oggetti storage, 0 job video. Backup Supabase pre-migrazione `20260914T053145Z`, copia sul Mac in `deploy/supabase/backups/`.
- Rollback runtime: ritaggare `my-ai:before-autosave-video` come `my-ai:local` ed eseguire il comando Compose `--no-build`; per tornare anche ai sorgenti precedenti usare il tarball in `/opt/my-ai-release-backups/`. Le due migrazioni **non hanno un rollback** (colonne, trigger e tabella restano): il codice precedente continua a funzionare su quello schema.
- La generazione video reale **non è ancora stata collaudata a pagamento**: prima di abilitarla verificare modello e listino con una singola richiesta controllata.
- La generazione video è stata abilitata con il modello predefinito e collaudata **davvero** su OpenRouter: una generazione da 4 s, 720p, 16:9, senza audio completata in meno di un minuto, costo segnalato dal provider **0,12 USD**, MP4 da 3,8 MB archiviato nel bucket privato e servito con `Range` (206 corretto), ricordo collegato trovato dalla ricerca, chat con i due messaggi attesi. Contenuti di collaudo eliminati; contatori tornati al livello di partenza (resta solo `video_oggi = 1` per l’account di test).
- Abilitazione: copia di sicurezza `.env.bak-video-20260914T070949Z` (600) e nuova riga `VIDEO_ENABLED=true` in `/opt/my-ai/.env`, ricreazione del solo container `my-ai` con `docker compose up -d --wait`.
- Per tornare indietro: rimettere il `.env` precedente (o togliere `VIDEO_ENABLED`), `docker compose up -d`, e se serve ritaggare `my-ai:before-autosave-video` come `my-ai:local`.

## File di testo e artefatti (2026-09-16)

- Pubblicati su LXC 110: strumento **Genera file di testo** (documento `.md`/`.txt` completo generato da DeepSeek con output JSON strutturato), editor manuale di titolo e contenuto, revisione AI su richiesta con anteprima e salvataggio solo dopo conferma, “Salva come file di testo” dalle risposte della chat, copia/download dal BFF autenticato, allegati `.md` accettati. **Nessuna migrazione** e **nessuna modifica a `/opt/my-ai/.env`**: la funzione usa la chiave DeepSeek già presente; senza chiave lo strumento resta dichiarato non configurato.
- Flusso: tag rollback `my-ai:before-artifacts` (immagine precedente `3617ac71fc69`), backup sorgenti senza segreti `/opt/my-ai-release-backups/source-before-artifacts-20260916T093210Z.tar.gz` (600) con symlink `source-latest-before-artifacts.tar.gz`, copia di 109 file con manifest SHA-256 verificato, build nel builder temporaneo `myai-builder` (driver docker-container, hard cap 2 GiB / 2 CPU), candidato `my-ai:artifacts-candidate` su `127.0.0.1:3311` con AI simulata nello stesso namespace di rete (web, immagini e video disattivati, chiavi provider azzerate), promozione con `docker compose -f docker-compose.prod.yml up -d --no-build --wait --wait-timeout 90`. RAM del LXC alzata temporaneamente a 6144 MB e **ripristinata a 4096 MB**; builder, candidato, stub e tunnel SSH rimossi; solo `my-ai` ricreato, gli altri contenitori intatti.
- Collaudo del candidato su database reale: **63 passati, 2 saltati, 0 falliti**, AI simulata raggiungibile solo su loopback (nessun provider a pagamento). Durante il collaudo l’account di test ha raggiunto il limite giornaliero AI (50 chiamate): i test sono proseguiti con `AI_DAILY_CALL_LIMIT=100` **solo nel contenitore candidato**, poi rimosso; la produzione mantiene il valore di `.env`.
- Dopo la promozione: **77 passati, 13 saltati, 0 falliti** sul dominio pubblico (desktop, Pixel 7, WebKit/iPhone 13), health HTTPS su entrambi i domini, capabilities invariate (`deepseek-flash`, web, immagini, video `veo-3.1-lite`, OCR). Dati invariati e Supabase non toccato: 2 utenti, 6 ricordi, 23 conversazioni, 3 documenti, 3 oggetti storage.
- Rollback runtime: ritaggare `my-ai:before-artifacts` come `my-ai:local` ed eseguire il comando Compose `--no-build`; per tornare anche ai sorgenti usare il tarball in `/opt/my-ai-release-backups/`. Non ci sono migrazioni da annullare né variabili d’ambiente da ripristinare.
- La generazione reale via DeepSeek non è stata eseguita in collaudo (quota giornaliera dell’account di test già esaurita e nessuna spesa ulteriore necessaria): il contratto JSON è già usato in produzione dagli agenti ed è coperto dai test unitari. La prima generazione reale dall’account dell’utente consuma la quota AI giornaliera come le altre chiamate.

## Isole dinamiche ed emergenti — Inside Out (2026-09-16)

- Pubblicati su LXC 105 e LXC 110: **Arcipelago Dinamico a Isole della Conoscenza**. Macro-isole (`myai_islands`), territori/distretti (`myai_island_districts`), motore di consolidamento notturno/serale via DeepSeek (`src/server/consolidation.ts`), richiamo attivo della memoria e dello stile appreso nella chat, resa grafica procedurale SVG parametrata sui temi (*ancient*, *botanical*, *observatory*, *workshop*, *coastal*). Pulsante manuale per avviare il consolidamento in qualsiasi momento.
- **Database Supabase dedicato (LXC 105)**: backup preventivo `/opt/myai-supabase/backups/20260916T163908Z`. Applicata migrazione `202609160001_dynamic_islands.sql` con vincoli FK `on delete set null (island_id)` e reload schema PostgREST. RLS attivo e isolato tra account.
- **App Docker (LXC 110)**: tag rollback `my-ai:before-dynamic-islands`, backup sorgenti senza segreti `/opt/my-ai-release-backups/source-before-dynamic-islands-20260916T165255Z.tar.gz`. Sorgenti sincronizzati, LXC 110 RAM temporaneamente a 6144 MB su Proxmox, compilazione immagine `my-ai:dynamic-islands-candidate`, promozione come `my-ai:local` e riavvio container `my-ai` (status `healthy`). RAM LXC 110 ripristinata a 4096 MB.
- Verifica: health HTTPS 200 su `https://myai.terraleonum.com` e `https://myai.terraleonum.duckdns.org`.

## Riorganizzazione design Home e Memoria (2026-09-16)

- Pubblicati su LXC 110: Home focalizzata su Chat e Indicatori analogici sottostanti; Isole dell'Arcipelago posizionate nella sezione Memoria integrate con tutta la memoria catalogata.
- **Database Supabase dedicato (LXC 105)**: non modificato (nessuna migrazione necessaria).
- **App Docker (LXC 110)**: tag rollback `my-ai:before-design-update`, backup sorgenti senza segreti in `/opt/my-ai-release-backups/`. Sorgenti sincronizzati, RAM LXC 110 temporaneamente a 6144 MB per la build `my-ai:design-candidate`, promozione come `my-ai:local` e riavvio container `my-ai` (`healthy`). RAM LXC 110 ripristinata a 4096 MB.
- Verifica: health HTTPS 200 su `https://myai.terraleonum.com` e `https://myai.terraleonum.duckdns.org`.

## Principio

L'app è un contenitore stateless: i dati vivono nello stack Supabase dedicato, mai nel volume del contenitore. Si può ricreare il container senza perdere nulla. Il LXC 105 resta riservato ai database; il frontend vive su LXC 110 (docker).

## Alternative sull'infrastruttura

- **Coolify (VM 120)**: possibile, ma non usato: il flusso Docker Compose + NPM su LXC 110 è già operativo.
- **VM 101 (windows11)**: non consigliata.
- **Vercel/Netlify/CF Workers**: possibile per il Next.js, ma il parsing DOCX/PDF è server-side, servono timeout adeguati, il dominio va consentito nello stack e i cookie restano su HTTPS.

## Sicurezza di base

- `.env` dell'app e dello stack con permessi 600, mai nel repository (`.dockerignore` esclude `.env*`, `.auth`, artefatti).
- Container `my-ai` non root (`USER myai`), `read_only` con `tmpfs /tmp`, `no-new-privileges`.
- La chiave `SUPABASE_SERVICE_ROLE_KEY` serve SOLO per l'eliminazione account ed è abilitata solo sullo stack dedicato.
