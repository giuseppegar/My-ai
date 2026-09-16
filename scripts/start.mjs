// Avvia la build standalone copiando static e public dove il server li cerca.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const args = process.argv.slice(2);
const port = args.includes('--port') ? args[args.indexOf('--port') + 1] : process.env.PORT || '3000';
const root = fileURLToPath(new URL('../', import.meta.url));
const standalone = `${root}.next/standalone`;
const copy = (src, dst) => { if (existsSync(src)) { rmSync(dst, { recursive: true, force: true }); cpSync(src, dst, { recursive: true }); } };
copy(`${root}.next/static`, `${standalone}/.next/static`);
copy(`${root}public`, `${standalone}/public`);
const child = spawn(process.execPath, ['.next/standalone/server.js'], { stdio: 'inherit', cwd: root, env: { ...process.env, PORT: port, HOSTNAME: '127.0.0.1' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 0));
