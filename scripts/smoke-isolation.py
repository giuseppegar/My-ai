#!/usr/bin/env python3
"""Smoke test sul SOLO backend dedicato: due account di test, file, RLS, cancellazione.
Non stampa password, cookie, token o URL firmati. Mantiene un account per Playwright.
"""
import http.cookiejar
import json
from pathlib import Path
import secrets
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]


def load(path):
    if not path.exists():
        return {}
    return {k.strip(): v.strip().strip('"') for line in path.read_text().splitlines()
            if '=' in line and not line.lstrip().startswith('#') for k, v in [line.split('=', 1)]}


def main():
    env = load(ROOT / '.env.local')
    base = env.get('APP_URL', 'http://localhost:3000').rstrip('/')
    expected = env['SUPABASE_INSTANCE_ID']
    req = urllib.request.Request(env['SUPABASE_URL'] + '/rest/v1/rpc/myai_instance_id', data=b'{}', headers={
        'apikey': env['SUPABASE_ANON_KEY'], 'Authorization': 'Bearer ' + env['SUPABASE_ANON_KEY'],
        'Content-Type': 'application/json',
    })
    with urllib.request.urlopen(req, timeout=10) as response:
        assert json.load(response) == expected, 'Istanza errata: interrotto prima di modifiche.'

    def client():
        jar = http.cookiejar.CookieJar()
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)), jar

    def call(opener, path, method='GET', data=None, content_type='application/json'):
        body = json.dumps(data).encode() if data is not None and content_type == 'application/json' else data
        request = urllib.request.Request(base + '/api/' + path, data=body, method=method,
                                         headers={'Origin': base, 'Content-Type': content_type})
        try:
            with opener.open(request, timeout=30) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            return error.code, json.load(error)

    primary, jar = client()
    saved = load(ROOT / '.env.test')
    if saved.get('TEST_SUPABASE_INSTANCE_ID') == expected:
        creds = {'email': saved['TEST_USER_EMAIL'], 'password': saved['TEST_USER_PASSWORD']}
        status, _ = call(primary, 'auth/login', 'POST', creds)
        assert status == 200, 'Accesso test primario fallito.'
    else:
        creds = {'email': 'test-user@myai.local', 'password': secrets.token_urlsafe(24)}
        status, _ = call(primary, 'auth/signup', 'POST', creds)
        assert status == 200, 'Registrazione test primario fallita.'
        path = ROOT / '.env.test'
        path.write_text('# Solo account tecnico sullo stack dedicato My ai.\n'
                        + 'TEST_USER_EMAIL=' + creds['email'] + '\n'
                        + 'TEST_USER_PASSWORD=' + creds['password'] + '\n'
                        + 'TEST_SUPABASE_INSTANCE_ID=' + expected + '\n')
        path.chmod(0o600)
    status, boot = call(primary, 'bootstrap')
    assert status == 200 and boot.get('user'), 'Bootstrap autenticato fallito.'
    assert any(c.name.startswith(env['SUPABASE_AUTH_COOKIE_NAME']) and c.has_nonstandard_attr('HttpOnly') for c in jar)
    print('Registrazione/accesso e cookie HttpOnly dedicato: OK')

    secondary, _ = client()
    second_creds = {'email': 'altra-persona@myai.local', 'password': secrets.token_urlsafe(24)}
    status, _ = call(secondary, 'auth/signup', 'POST', second_creds)
    assert status == 200, 'Registrazione secondo account di test fallita.'
    memory_id = document_id = None
    try:
        status, memory = call(primary, 'memories', 'POST', {
            'title': 'Test isolamentocristallo', 'content': 'Ricordo tecnico isolamentocristallo.',
            'category': 'capire', 'kind': 'content',
        })
        assert status == 201, 'Creazione memoria fallita.'
        memory_id = memory['id']
        status, results = call(primary, 'search', 'POST', {'query': 'isolamentocristallo'})
        assert status == 200 and any(r['id'] == memory_id for r in results['results'])
        status, results = call(secondary, 'search', 'POST', {'query': 'isolamentocristallo'})
        assert status == 200 and not results['results']
        status, _ = call(secondary, 'content/memory/' + memory_id)
        assert status == 404
        print('Memorie, ricerca e lettura diretta tra account: isolate')

        boundary = 'myai-' + secrets.token_hex(12)
        fields = {'scope': 'memory', 'category': 'capire'}
        parts = [f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n' for k, v in fields.items()]
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="isolamento.txt"\r\nContent-Type: text/plain\r\n\r\nDocumento tecnico isolamentocristallo.\r\n--{boundary}--\r\n')
        status, document = call(primary, 'documents', 'POST', ''.join(parts).encode(), 'multipart/form-data; boundary=' + boundary)
        assert status == 201 and document.get('status') == 'ready', 'Upload/indicizzazione falliti.'
        document_id = document['id']
        status, signed = call(primary, 'documents/' + document_id)
        assert status == 200
        with urllib.request.urlopen(signed['url'], timeout=15) as response:
            assert b'isolamentocristallo' in response.read()
        status, _ = call(secondary, 'documents/' + document_id)
        assert status == 404
        print('Upload TXT, indicizzazione, download firmato e diniego ad altro account: OK')
    finally:
        if document_id:
            assert call(primary, 'documents/' + document_id, 'DELETE')[0] == 200
        if memory_id:
            assert call(primary, 'memories/' + memory_id, 'DELETE')[0] == 200
        status, _ = call(secondary, 'account', 'DELETE', {'confirmation': 'ELIMINA IL MIO ACCOUNT', 'password': second_creds['password']})
        assert status == 200, 'Pulizia account temporaneo fallita.'
        print('Account temporaneo e fixture rimossi SOLO dal nuovo stack')


if __name__ == '__main__':
    main()
