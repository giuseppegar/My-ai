# My ai — Il tuo arcipelago

Chat AI personale in italiano, memoria illustrata a isole, ricerca prima dell'AI e modalità collaborativa "Approfondisci" in cui tu sei il Regista.

**Stato: versione funzionante, collegata a uno stack Supabase DEDICATO.** In mancanza di configurazione l'interfaccia si avvia in **anteprima dimostrativa** (esempi chiaramente marcati, modifiche non persistenti). Senza configurazione **nessuna risposta AI finta** e **nessun finto salvataggio**. I servizi esterni non vengono mai dichiarati collegati se non lo sono.

## Cosa è già implementato

- **Account e isolamento**: Supabase Auth via cookie `HttpOnly`; `auth.getUser()` a ogni richiesta; **RLS su ogni tabella**; file privati con prefisso `uid` e policy sul prefisso. Ricerca e strumenti agenti passano tutti da RLS.
- **Chat**: risposta tramite **DeepSeek** (API server-only, mai nel browser). Risposta ignorata con privacy, non inventa ricordi. Invio = `Invio`, a capo = `Maiusc+Invio` (visibile nella barra). Cronologia automatica, eliminabile anche a singolo messaggio.
- **Salvataggio automatico e catalogazione**: ogni richiesta inviata crea subito un ricordo nell'isola selezionata (in Chat libera la categoria è proposta da regole locali, senza chiamate AI) e la risposta aggiorna lo stesso ricordo, senza duplicati. Il trigger SQL è atomico con il messaggio, rispetta RLS e le chat riservate (allegato chat-only ⇒ nessuna copia derivata e revoca immediata di quelle già create). Se l'AI fallisce, la richiesta resta visibile e conservata. Un ricordo modificato a mano (`auto_update=false`) non viene più sovrascritto; uno eliminato non ricompare a fine generazione. Nessuna preferenza personale viene dedotta: resta necessaria la conferma esplicita. `202609140001_auto_memories.sql`.
- **Ricerca prima dell'AI**: digitando si cerca nella memoria personale (ricordi, conversazioni conservate, testi dei documenti, desideri) senza mai chiamare un LLM; risultati con categoria, estratto, pagina, immagine; "Ripartiamo da qui", filtri per categoria/tipo, navigazione da tastiera. Se non c'è nulla: *"Non c'è ancora nei tuoi ricordi. Chiedi all'AI."* Le bozze non vengono salvate né inviate agli agenti.
- **Ricerca ibrida**: FTS italiana + trigrammi + vettori. Senza embeddings: testo + termini affini (regole esplicite). Modifica ed eliminazione si riflettono subito nella ricerca.
- **Isole**: all’inizio della Home, prima della chat e degli indicatori, cinque schede illustrate con pulsante **Parliamone in chat** ad alto contrasto: Chat libera e le 4 categorie di memoria (studio, cucina con orto, osservatorio, sentiero con tappe). Chat libera è un ingresso alla conversazione, non una nuova categoria persistente. Selezionare un’isola porta il focus alla chat e non avvia l’AI. Le categorie mantengono una raccolta con schede e filtri, vista elenco accessibile, `prefers-reduced-motion`. "Salva nell'isola" propone la categoria (modificabile). **Preferenze**: scheda di conferma obbligatoria, mai ipotesi sul carattere.
- **Documenti**: PDF, DOCX, TXT/Markdown, JPG/PNG/GIF/WebP (max 10 MB, 500 file, 250 MB utente); anteprima e rimozione prima del caricamento; caricare **non** avvia l’AI; scelta "Solo per questa chat" (escluso dalla ricerca globale) o "Conserva nella memoria" (indicizzato). Un allegato chat-only rende non ricercabile anche la conversazione che lo contiene; eliminando la chat si eliminano i suoi allegati esclusivi. I testi estratti restano collegati al file con la pagina. Fino a **500 pagine PDF / 1.000.000 caratteri**; oltre il limite, testo parziale con avviso invece di scartare tutto. Il contesto cerca i passaggi pertinenti anche nelle pagine finali e negli allegati chat-only, dichiarando gli estratti incompleti. **OCR locale** italiano/inglese per foto e scansioni: massimo 20 pagine scansionate, 45 secondi e 2 elaborazioni simultanee; GIF solo primo fotogramma. Le immagini sono validate anche decodificando i pixel (max 40 MP). Gli esiti di lettura restano visibili nella chat: "conservato" non equivale a "letto". Originali e anteprime sono serviti dal BFF autenticato anche fuori LAN. I documenti sono materiale da analizzare, non istruzioni da eseguire.
- **Indicatori analogici** (Passioni, Idee, Curiosità, Scoperte): quadranti con tacche, criterio, periodo (30 giorni) e scala espliciti; derivano solo da attività/ricordi reali, mai da punteggi AI; stato iniziale piacevole; tocco → spiegazione + contenuti collegati. Dalla Home stanno **in fondo alla pagina, sotto la chat**: la lettura parte da chat e isole, i numeri non occupano più la prima schermata.
- **Desideri**: titolo, immagine, motivazione, risultato, tempi, risorse/vincoli (distinti dalle stime), informazioni mancanti, tappe confermate, prossima azione, ostacoli/risposte "se…allora…", decisioni. Il progresso dipende solo dalle tappe spuntate; pausa e abbandono senza penalità.
- **Mobile**: allegati, selettore **Strumenti** e invio su una barra compatta. Web, Approfondisci, Immagini e Video si aprono a richiesta, una modalità alla volta, con obiettivi touch di almeno 44 px. Il selettore mostra lo strumento attivo; selezionarlo di nuovo torna alla chat semplice. Nessuna chiamata AI al cambio modalità. Testi di input da 16 px e margini per notch/barra Home, senza disabilitare lo zoom.
- **Schermata Home**: logo bussola in PNG per iPhone (180 px) e Android (192/512 px, anche maskable), manifest con avvio standalone. Richiede connessione: nessun service worker o cache offline dei contenuti privati.
- **Web (facoltativo)**: seleziona **Strumenti → Cerca nel web**, poi invia la domanda al servizio di ricerca configurato (OpenRouter o Tavily) solo su richiesta esplicita; i link incollati nel messaggio vengono aperti dal server con protezione della rete locale (SSRF: mai risorse private, loopback, metadata o indirizzi riservati), limite di dimensione, tempo e reindirizzamenti. I risultati web sono materiale da analizzare, non istruzioni da eseguire; senza chiave la ricerca è disattivata ma i link funzionano.
- **Immagini generate (facoltativo)**: “Genera immagine” usa un endpoint OpenAI-compatible (`/images/generations`) configurato; il testo dell’utente è il prompt, il provider riceve solo quello. Risultato salvato nel bucket privato e **catalogato automaticamente nell’isola**; nelle chat riservate resta solo nella chat (trigger `myai_generated_scope`). Galleria nella chat, apribile da Documenti; limite giornaliero atomico separato dalle chiamate AI. Senza chiave la funzione dichiara di non essere configurata.
- **Video generati (facoltativo, a pagamento)**: “Genera video” usa l’API asincrona **OpenRouter** (`POST /videos`, polling `GET /videos/{id}`, download `GET /videos/{id}/content?index=0` — endpoint fisso, mai URL restituiti dal provider). Modello, durata, risoluzione e aspect ratio sono configurabili e **verificati contro il catalogo `/videos/models` prima di ogni nuovo job**; niente audio. Prima dell’invio l’interfaccia mostra un **riquadro di conferma del consumo di credito** e ricorda che ZDR non è supportata per i video. Job durabile in `myai_video_jobs`: lease di invio e di polling, quota/giorno separata, `request_id` idempotente (un retry HTTP non invia un secondo POST), una firma HMAC sul `provider_id` per non manomettere il job, stato `uncertain` se l’esito dell’invio resta ignoto (mai reinvio automatico). Il filmato è salvato nel bucket privato (MP4 ≤ 50 MB) con **streaming e Range** dal BFF, così Safari può riprodurlo; in chat compare il player e il risultato finisce in Documenti. Se l’app è chiusa durante la generazione, il recupero avviene alla riapertura. `202609140002_videos.sql`.
- **File di testo e artefatti**: lo strumento **Genera file di testo** chiede a DeepSeek un documento completo e strutturato (titolo, nome file, contenuto) e lo salva nell’archivio privato, catalogandolo nell’isola come gli altri contenuti. Ogni artefatto è modificabile a mano (titolo e contenuto) o con una revisione AI richiesta esplicitamente: la proposta si vede in anteprima e si salva solo dopo conferma. Anche una risposta della chat si può conservare come file di testo. Nelle chat riservate l’artefatto resta nella chat e fuori dalla ricerca globale; copia, download e apertura passano sempre dal BFF autenticato. Senza chiave DeepSeek lo strumento dichiara di non essere configurato.
- **Approfondisci** (facoltativo, mai automatico): Coordinatore attiva solo i ruoli utili (Progettista, Revisore, Analista degli scenari, Verificatore) fino a 2 cicli di revisione; interfaccia Proposta / Punti da chiarire / La tua scelta; tavolo espandibile con contributi reali; interventi del Regista ("Aggiungo un vincolo", "Proviamo un'alternativa") durante il processo; stop immediato con lease persistente e CAS (un vincolo o uno stop **non possono essere sovrascritti** da un passo in volo); limite di budget/durata configurati e **riservati prima di ogni chiamata**; non si presenta il consenso come prova di correttezza e il Revisore non promette di trovare tutto.
- **Privacy**: esportazione NDJSON (dati + file in base64), eliminazione di singoli contenuti/chat/file, eliminazione account (con service role, **opzionale e solo su istanza dedicata** — fallisce prima di cancellare se non configurata). Nessuno spazio condiviso. Rate limit giornaliero AI atomico lato DB. CSP, no tracking, `robots noindex`.
- **Test**: 111 test unitari/SQL (incluse dimensioni, opacità e area sicura delle icone), inclusi estrazione di PDF lunghi e DOCX/TXT, file di testo e artefatti (generazione JSON, modifica manuale e revisione AI), OCR con processi simulati, contesto pertinente, file privati, contratto video OpenRouter (mai chiamate reali a pagamento) e streaming MP4 con Range. Su **PostgreSQL reale in WASM (PGlite)** - isolamento tra due account (righe, foreign key incrociate, ricerca lessicale e vettoriale, file), scope allegati, salvataggio automatico e revoca nelle chat riservate, idempotenza video, lease/budget/stop, quota atomica - più prove end-to-end Playwright (desktop, Pixel 7 e WebKit/iPhone 13 simulato), layout da 320 a 1280 px, strumenti aperti/chiusi, allegati, invio in corso, tastiera, video simulato e metadati per la schermata Home.

## Da configurare (integrazioni esterne)

| Cosa | Stato | Note |
|---|---|---|
| Stack Supabase dedicato | collegato | autogestito (`deploy/supabase/`), identità `myai_instance_id` verificata dal server prima di Auth/dati |
| Chiave DeepSeek | da aggiungere | `DEEPSEEK_API_KEY`; modello configurabile |
| Embeddings | **opzionale, non inclusi** | DeepSeek non offre endpoint embeddings: usiamo un modello `bge-m3` (1024) su un servizio Ollama **di tua fiducia**; niente fallback a provider non configurati; senza, la ricerca resta testuale + termini affini |
| Visione immagini | disattivata di default | `DEEPSEEK_VISION=true` **solo** se il modello/endpoint supporta immagini; in chat normale si inviano foto normalizzate, non URL LAN irraggiungibili |
| Generazione video | **attiva dal 14 settembre 2026** | OpenRouter con `VIDEO_ENABLED=true`; `VIDEO_MODEL=google/veo-3.1-lite`, 4 s, 720p, 16:9, **senza audio**, `VIDEO_DAILY_LIMIT=2`. Costo reale osservato nella prima generazione di collaudo: **0,12 USD** (3,8 MB di MP4, completata in meno di un minuto). Il listino cambia con modello, durata e risoluzione: verificarlo prima di modificare i parametri. La chiave arriva da `OPENROUTER_API_KEY`, oppure da `IMAGE_API_KEY` se `IMAGE_BASE_URL` punta a OpenRouter |
| Ricerca web | **attiva** | OpenRouter plugin web (`WEB_SEARCH_PROVIDER=openrouter`, `OPENROUTER_WEB_MODEL=google/gemini-3.8-flash`): una sola chiave per immagini e ricerca; costo osservato ≈ 0,028 USD/ricerca; limite `WEB_DAILY_LIMIT` (default 10). Tavily resta supportata con `WEB_SEARCH_PROVIDER=tavily` e `TAVILY_API_KEY`; l’apertura dei link incollati funziona anche senza provider |
| Generazione immagini | **attiva** | OpenRouter `openai/gpt-5-image` (`IMAGE_API_KEY` + `IMAGE_BASE_URL=https://openrouter.ai/api/v1`); costo osservato ≈ 0,17 USD/immagine 1024×1024. Il modello è una riga nel `.env`: `gpt-5-image-mini` (≈ 0,01) o `gemini-3.1-flash-image` (≈ 0,06) costano meno. Il catalogo cambia: verificare sempre la disponibilità del modello. Limite `IMAGE_DAILY_LIMIT` (default 5) |
| OCR | locale, incluso nel Docker | Tesseract `ita+eng` + Poppler; `DOCUMENT_OCR_ENABLED=true`. In locale servono gli strumenti installati; nessun servizio OCR remoto |
| Eliminazione account | disattivata | richiede `SUPABASE_SERVICE_ROLE_KEY` + `ALLOW_AUTH_ACCOUNT_DELETION=true` |
| Dominio/HTTPS | da configurare | vedi `deploy/proxmox.md` |

## Configurazione Supabase (nuova istanza dedicata)

1. Crea un progetto **dedicato** (stack autogestito con `deploy/supabase/` oppure cloud): non riutilizzare un database con altri dati. Lo stack dedicato include un marcatore `myai_instance_id()`: il server My ai rifiuta di operare su un backend privo di marcatore, proteggendo le altre app da errori di configurazione.
2. Abilita le estensioni `vector` e `pg_trgm` (schema `extensions`).
3. Esegui `supabase/migrations/202609110001_my_ai.sql` (via SQL editor o CLI). Crea tabelle, RLS, funzioni RPC con `security invoker`, trigger e il bucket privato `myai-private`.
4. Auth: lascia il default `auth.users` con `on delete cascade`. Per l'**eliminazione account** dalla app serve il service role.
5. Redirect email di conferma: imposta `APP_URL` al tuo dominio pubblico e usa `http://APP_URL/api/auth/confirm` come redirect. Consiglio: conferma email attiva, reindirizzamento all'app.
6. Token di sessione: per sessioni lunghe, valuta `JWT expiry` > 1h (l'app usa cookie `HttpOnly`). Le scadenze restano comunque gestite da Supabase.

## Avvio locale

```bash
npm install
cp .env.example .env.local   # poi compilalo
npm run dev                  # http://localhost:3000
```

Variabili principali (vedi `.env.example` per tariffe e limiti): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_INSTANCE_ID`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `APP_URL`. Il server avvia solo con `SUPABASE_INSTANCE_ID` e lo verifica via anon key (mai con service-role) prima di leggere cookie o dati; i cookie di sessione hanno nome proprio (`SUPABASE_AUTH_COOKIE_NAME`), così app diverse non si scambiano sessioni. Le tariffe (`AI_INPUT/USD…`) sono **cautelative e configurabili**, non un preventivo del provider: verificare sempre i consumi sul portale DeepSeek.

## Migrazioni successive

**Stato al 14 settembre 2026:** entrambe le migrazioni `202609140001` e `202609140002` sono applicate allo stack dedicato, in un’unica transazione. Backup pre-migrazione `20260914T053145Z`, ripristino di prova e checksum verificati, copia protetta sul Mac in `deploy/supabase/backups/`. Le righe preesistenti sono conservate. Anche il frontend/BFF pubblico è stato aggiornato alla stessa versione (rollback `my-ai:before-autosave-video`) e i video sono **attivi** (`VIDEO_ENABLED=true`, `veo-3.1-lite`, 4 s, 720p, senza audio, 2 al giorno).

Le migrazioni additive si applicano in ordine dopo quella iniziale:

1. `202609130001_web_images.sql` — colonna `origin` su `myai_documents`, contatore `images` e `myai_consume_image`.
2. `202609130002_web_quota.sql` — contatore `web` e `myai_consume_web`.
3. `202609140001_auto_memories.sql` — `reply_to_id`, `auto_conversation_id`, `auto_update`, trigger `myai_auto_memory`, revoca nelle chat riservate, scope dei media generati, sintesi agenti salvata una sola volta.
4. `202609140002_videos.sql` — `myai_video_jobs`, coda e lease video, `myai_consume_video`, trigger del messaggio di esito, limite MP4 e MIME `video/mp4` nel bucket.

**Ordine obbligatorio**: la 4 dipende dalla 3 (trigger e colonne). La 3 allarga il limite del contenuto dei ricordi da 20.000 a 65.000 caratteri e aggiunge la colonna `auto_update`, necessaria a non sovrascrivere un ricordo corretto a mano.
Aggiornare lo stack dedicato prima del codice: con le migrazioni mancanti `bootstrap` risponde 500 (colonne/tabelle assenti) e l’accesso non si completa.

## Test

```bash
npm test                    # unit + SQL di isolamento (PGlite, PostgreSQL in WASM)
npm run typecheck && npm run lint && npm run build
npm run test:e2e:authenticated # Supabase reale + AI simulata sul Mac, HTTPS locale anche per Safari
npx playwright test         # UI; test che consumano AI reale richiedono opt-in
                            # flussi autenticati con account attivato:
                            # TEST_USER_EMAIL/TEST_USER_PASSWORD in .env.test
```

Il runner `scripts/test-authenticated.mjs` avvia un simulatore AI su loopback e un proxy HTTPS locale con certificato temporaneo. Disabilita le chiavi dei provider a pagamento nel BFF di test; non modifica le configurazioni di produzione. I cookie restano `Secure` anche nei test Safari. Il database e l’account `TEST_USER` sono reali: vengono creati e rimossi solo i contenuti sintetici del collaudo; la quota giornaliera del relativo account conta anche queste richieste simulate. `TEST_CHAT_AI=1` e `TEST_DOCUMENT_AI=1` sono opt-in distinti per i test che chiamano davvero un modello. Il runner simulato li disattiva.

Dopo le migrazioni: 79 prove e2e passate in locale sul database reale (Chromium, Pixel 7, WebKit/iPhone 13 simulato), 2 prove AI reale saltate. Sul candidato Docker: 59 passate e 2 saltate. Dopo la pubblicazione: **71 passate, 10 saltate, 0 fallite** sul dominio pubblico, più health HTTPS su entrambi i domini. Nessuna generazione a pagamento.

Rilascio **16 settembre 2026** (file di testo e artefatti): 111 test unitari/SQL verdi, runner autenticato locale **88 passati / 2 saltati**, candidato Docker **63 passati / 2 saltati**, dominio pubblico **77 passati / 13 saltati / 0 falliti** (WebKit/iPhone 13 incluso). Nessuna migrazione, nessuna modifica ai segreti; la produzione mantiene il limite AI giornaliero di `.env`.

Le fixture in `tests/fixtures/` sono sintetiche, senza dati utente. Le prove OCR unità simulano i processi; le prove e2e verificano il testo realmente riconosciuto quando OCR è abilitato. Per collaudare il runtime Docker già avviato con un account di test: `E2E_BASE_URL=https://DOMINIO npx playwright test tests/e2e/documents.spec.ts --project=chromium`. Queste prove rimuovono i propri allegati e conversazioni; non toccano gli altri contenuti.

## Aggiungere l’app alla schermata Home

- **iPhone (Safari)**: apri il sito HTTPS → Condividi → Aggiungi alla schermata Home.
- **Android (Chrome)**: menu ⋮ → Aggiungi alla schermata Home / Installa app (il nome dipende dal browser).
- Se un vecchio collegamento resta senza logo, rimuovi **solo il collegamento** e aggiungilo nuovamente dopo aver ricaricato il sito. Non occorre cancellare l’account o i dati del browser; i contenuti salvati restano nel tuo account.
- Per aggiornare il logo in sviluppo: modifica `src/app/icon.svg`, poi esegui `node scripts/generate-app-icons.mjs`. Il sistema applica il proprio ritaglio all’icona quadrata opaca.
- Le prove automatiche verificano i file e il rendering nei browser simulati; l’aggiunta effettiva alla schermata Home va confermata sul telefono.

## Distribuzione (Proxmox)

**ONLINE:** container `my-ai` su LXC 110 (rete `homelab`, sorgenti `/opt/my-ai`) collegato allo stack Supabase dedicato su LXC 105 (`192.168.1.17:8010`). NPM raggiunge il container tramite DNS Docker stabile `my-ai:3000`. HTTPS attivo su `myai.terraleonum.com` e `myai.terraleonum.duckdns.org`, con Force SSL e certificati Let's Encrypt. Operatività in `deploy/proxmox.md`; accesso, backup e ripristino Supabase in `deploy/supabase/README.md`.

## Architettura

- `src/app/page.tsx` — SPA interna (client), bootstrap unico da `/api/bootstrap`.
- `src/app/api/[...path]/route.ts` — BFF Node: auth, chat, ricerca, file, agenti, account. Mai segreti nel client.
- `src/server/` — core (errori, quote), ai (DeepSeek, embeddings), retrieval (contesto autorizzato), files (estrazione e storage), agents (orchestrazione con lease/CAS).
- `deploy/supabase/` — stack autogestito dedicato, runbook completo e strumenti `status.py`, `backup.sh`, `verify-backup.sh`.
- `supabase/migrations/` — schema, RLS, funzioni RPC (`myai_search` ibrida con `security invoker`, `myai_activity`, `myai_claim_agent`, `myai_consume_call`).
- `scripts/` — avvio standalone e smoke test di isolamento (`smoke-isolation.py`).

## Limiti e note oneste

- Il flusso e2e autenticato richiede un account di test **già attivato** (niente bypass delle conferme email).
- I link ai file restano sul dominio dell’app e richiedono un account autorizzato a ogni apertura; nessun link diretto a Supabase LAN viene emesso dal browser.
- L’OCR legge testo, non descrive le scene nelle foto. La descrizione visiva richiede un modello compatibile configurato esplicitamente; il solo flag non aggiunge capacità a un modello testuale. OCR incompleto, non disponibile o senza testo viene dichiarato e l’originale resta conservato.
- Le immagini generate esistono solo se il servizio immagini è configurato: senza chiave la funzione risponde che non è attiva, non viene simulato nulla. Il provider riceve il prompt; la conservazione lato provider dipende dalle sue condizioni.
- I file di testo si appoggiano a DeepSeek: il contenuto generato entra nel file così com’è (fino a 65.000 caratteri per modifica, 10 MB per file) e resta modificabile a mano; il nome file proposto dal modello viene normalizzato. La revisione AI non salva mai da sola e l’anteprima va confermata. Un artefatto nelle chat riservate non entra nella ricerca globale.
- I video sono **attivi** con `VIDEO_ENABLED=true`, modello `google/veo-3.1-lite`, 4 s, 720p e limite di 2 al giorno per account; la prima generazione reale è stata verificata end-to-end (invio, attesa, archiviazione privata, riproduzione con `Range`, ricerca in memoria, chat con richiesta ed esito) al costo di 0,12 USD. L’invio è sempre confermato dall’utente. OpenRouter e il provider conservano temporaneamente l’output (ZDR non disponibile per i video): il recupero nell’archivio privato avviene mentre l’app è aperta, alla riapertura se era chiusa. Un job con esito d’invio ignoto resta `uncertain` e non viene mai ripetuto da solo. La trascrizione e il riassunto dei video non sono implementati: sono ricercabili per titolo e prompt.
- La ricerca web dipende da un servizio esterno (OpenRouter o Tavily): la domanda viaggia solo quando invii dopo aver scelto “Cerca nel web” in Strumenti, con un limite giornaliero di 10 ricerche. Con OpenRouter il modello di ricerca risponde con dati aggiornati e fonti, a circa 0,028 USD a ricerca; le pagine incollate vengono ridotte a testo con un limite di dimensione e i siti che bloccano i bot producono un avviso, mai contenuti inventati.
- Per PDF già caricati con errore nella versione precedente (limite 100 pagine / 200.000 caratteri), usare **Documenti → Reindicizza**, senza ricaricare l’originale.
- I backup (Supabase/self-host) conservano i dati secondo la policy dell'amministratore: la cancellazione dall'app non li rimuove istantaneamente.
- DeepSeek riceve richiesta, conversazione recente e contesto pertinente solo quando invii (anche dopo aver scelto Approfondisci in Strumenti); la conservazione lato provider dipende dalle sue condizioni.
- Senza embeddings la ricerca semantica non è attiva (nessun servizio non configurato viene contattato).
- "Reindicizza" serve dopo aver cambiato l'ambito di un documento quando gli embeddings sono attivi.
