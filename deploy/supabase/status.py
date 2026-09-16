#!/usr/bin/env python3
"""Controllo operativo dello stack dedicato My ai senza stampare segreti o dati personali."""
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent


def load_env() -> dict[str, str]:
    path = ROOT / '.env'
    if not path.exists():
        raise RuntimeError(f'Configurazione assente: {path}')
    mode = stat.S_IMODE(path.stat().st_mode)
    if mode & 0o077:
        raise RuntimeError(f'Permessi insicuri su {path}: {mode:o}, atteso 600')
    return {
        key.strip(): value.strip().strip('"').strip("'")
        for line in path.read_text().splitlines()
        if '=' in line and not line.lstrip().startswith('#')
        for key, value in [line.split('=', 1)]
    }


def request_json(url: str, key: str, method: str = 'GET', body: bytes | None = None):
    request = urllib.request.Request(url, method=method, data=body, headers={
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.status, json.load(response) if response.length != 0 else None


def run(*args: str) -> str:
    return subprocess.check_output(args, cwd=ROOT, text=True, stderr=subprocess.STDOUT).strip()


def main() -> int:
    try:
        env = load_env()
        required = ['SUPABASE_PUBLIC_URL', 'ANON_KEY', 'MYAI_INSTANCE_ID']
        if any(not env.get(name) for name in required):
            raise RuntimeError('Variabili obbligatorie mancanti in .env')

        print('=== Container ===')
        print(run('docker', 'compose', 'ps', '--format', '{{.Name}} | {{.Status}}'))

        base = env['SUPABASE_PUBLIC_URL'].rstrip('/')
        status, instance_id = request_json(
            f'{base}/rest/v1/rpc/myai_instance_id', env['ANON_KEY'], 'POST', b'{}'
        )
        if status != 200 or instance_id != env['MYAI_INSTANCE_ID']:
            raise RuntimeError('Marcatore dell’istanza non corrispondente')
        print('Identità istanza dedicata: OK')

        status, auth_health = request_json(f'{base}/auth/v1/health', env['ANON_KEY'])
        if status != 200 or not isinstance(auth_health, dict):
            raise RuntimeError('Auth non disponibile')
        print('Auth API: OK')

        counts = run(
            'docker', 'compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc',
            "select json_build_object('utenti',(select count(*) from auth.users),"
            "'ricordi',(select count(*) from public.myai_memories),"
            "'conversazioni',(select count(*) from public.myai_conversations),"
            "'documenti',(select count(*) from public.myai_documents),"
            "'oggetti_storage',(select count(*) from storage.objects));"
        )
        print('Conteggi non sensibili:', counts)

        try:
            with urllib.request.urlopen('https://myai.terraleonum.com/api/health', timeout=10) as response:
                online = response.status == 200 and json.load(response).get('service') == 'my-ai'
            print('App pubblica HTTPS:', 'OK' if online else 'ERRORE')
        except (urllib.error.URLError, TimeoutError, ValueError):
            print('App pubblica HTTPS: non verificabile da questo host')

        backups = ROOT / 'backups'
        latest = backups / 'latest'
        print('Ultimo backup locale:', latest.resolve().name if latest.exists() else 'NESSUNO')
        return 0
    except Exception as error:
        print(f'ERRORE: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
