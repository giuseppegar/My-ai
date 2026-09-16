// Supabase reale (account TEST_USER), AI simulata esclusivamente su loopback.
// Richiede una build aggiornata: npm run build && npm run test:e2e:authenticated.
import { createServer, request as proxyRequest } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { spawn, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';

process.umask(0o077);
for (const directory of ['tests/e2e/.auth','tests/e2e/artifacts']) {
  mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
}
if (existsSync('tests/e2e/.auth/user.json')) chmodSync('tests/e2e/.auth/user.json', 0o600);
// Nessun override verso un'app live: i segreti del provider sono neutralizzati nel server locale.
if (process.env.E2E_BASE_URL) throw new Error('Questo runner avvia solo il BFF locale: rimuovi E2E_BASE_URL.');
// Safari richiede HTTPS per cookie Secure: non indebolire i cookie dell'app per il test.
const tlsDirectory = mkdtempSync(join(tmpdir(), 'myai-e2e-https-'));
const keyPath = join(tlsDirectory,'key.pem'), certPath = join(tlsDirectory,'cert.pem');
const certificate = spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyPath,'-out',certPath,'-days','1','-subj','/CN=localhost'],{ stdio:'ignore' });
if (certificate.status !== 0) { rmSync(tlsDirectory,{ recursive:true,force:true }); throw new Error('Certificato temporaneo HTTPS non creato: serve openssl.'); }
const https = createHttpsServer({ key:readFileSync(keyPath),cert:readFileSync(certPath) },(req,res) => {
  const upstream = proxyRequest({ hostname:'127.0.0.1',port:3210,method:req.method,path:req.url,headers:{ ...req.headers,'x-forwarded-proto':'https','x-forwarded-host':'127.0.0.1:3443' } }, response => {
    res.writeHead(response.statusCode || 502,response.headers); response.pipe(res);
  });
  upstream.on('error',() => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.on('error',() => upstream.destroy()); res.on('close',() => upstream.destroy()); req.pipe(upstream);
});
https.listen(3443,'127.0.0.1');
try { await once(https,'listening'); }
catch (error) { rmSync(tlsDirectory,{ recursive:true,force:true }); throw error; }
let calls = 0;
const server = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/chat/completions' || req.headers.authorization !== 'Bearer e2e-local-stub') { res.writeHead(403).end(); return; }
  let bytes = 0;
  try {
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 256_000) { res.writeHead(413).end(); return; }
    }
    // Il contenuto non viene registrato, interpretato o inoltrato ad altri servizi.
    calls++;
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Risposta simulata di collaudo: nessun modello remoto è stato chiamato.' }, finish_reason: 'stop' }], usage: { total_tokens: 0 } }));
  } catch { if (!res.headersSent) res.writeHead(400); res.end(); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const address = server.address();
const child = spawn('npx', ['playwright','test',...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, E2E_STUB_AI: '1', E2E_LOCAL_HTTPS: '1', DEEPSEEK_API_KEY: 'e2e-local-stub', DEEPSEEK_BASE_URL: `http://127.0.0.1:${address.port}`, DEEPSEEK_MODEL: 'e2e-local-stub', DEEPSEEK_VISION: 'false', OPENROUTER_API_KEY: '', IMAGE_API_KEY: '', TAVILY_API_KEY: '', VIDEO_ENABLED: 'false', OLLAMA_BASE_URL: '', TEST_DOCUMENT_AI: '0', TEST_CHAT_AI: '0' },
});
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { child.kill(signal); server.close(); https.close(); });
try {
  const [code] = await once(child, 'exit');
  process.exitCode = code ?? 1;
  console.log(`Chiamate al simulatore AI locale: ${calls}. Nessun provider a pagamento configurato in questo collaudo.`);
} finally {
  server.closeAllConnections(); https.closeAllConnections();
  await Promise.all([new Promise(resolve => server.close(resolve)),new Promise(resolve => https.close(resolve))]);
  rmSync(tlsDirectory,{ recursive:true,force:true });
}
