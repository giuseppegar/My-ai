#!/usr/bin/env python3
"""Genera credenziali nuove e indipendenti. Non legge né copia altri stack."""
import argparse
import base64
import hashlib
import hmac
import ipaddress
import json
import os
from pathlib import Path
import secrets
import time
from urllib.parse import urlparse
import uuid


def origin(value):
    parsed = urlparse(value)
    if (parsed.scheme not in ('http', 'https') or not parsed.hostname
            or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ('', '/') or any(c in value for c in '\r\n$#')):
        raise argparse.ArgumentTypeError('Usare un origin HTTP(S) senza credenziali.')
    return value.rstrip('/')


def token(role, secret, now):
    def enc(data):
        return base64.urlsafe_b64encode(json.dumps(data, separators=(',', ':')).encode()).rstrip(b'=').decode()
    message = enc({'alg': 'HS256', 'typ': 'JWT'}) + '.' + enc({
        'iss': 'myai-supabase', 'role': role, 'iat': now - 60, 'exp': now + 10 * 365 * 86400,
    })
    signature = base64.urlsafe_b64encode(hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return message + '.' + signature


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument('--bind', type=ipaddress.IPv4Address, default=ipaddress.IPv4Address('127.0.0.1'))
    parser.add_argument('--port', type=int, default=8010)
    parser.add_argument('--public-url', type=origin, required=True)
    parser.add_argument('--app-url', type=origin, default='http://localhost:3000')
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('La porta deve essere tra 1024 e 65535.')
    args.directory.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_hex(32)
    now = int(time.time())
    values = {
        'COMPOSE_PROJECT_NAME': 'myai-supabase',
        'BIND_ADDRESS': str(args.bind), 'API_PORT': str(args.port),
        'SUPABASE_PUBLIC_URL': args.public_url, 'APP_URL': args.app_url,
        'MYAI_INSTANCE_ID': str(uuid.uuid4()),
        'POSTGRES_PASSWORD': secrets.token_hex(32), 'JWT_SECRET': secret,
        'ANON_KEY': token('anon', secret, now), 'SERVICE_ROLE_KEY': token('service_role', secret, now),
    }
    path = args.directory / '.env'
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        raise SystemExit('.env già presente: NON rigenero chiavi di un database esistente.')
    with os.fdopen(fd, 'w') as stream:
        stream.write('# Segreti esclusivi My ai: non stampare né versionare.\n')
        stream.write('\n'.join(f'{key}={value}' for key, value in values.items()) + '\n')
    print('Configurazione dedicata creata con permessi 600. Nessun segreto stampato.')


if __name__ == '__main__':
    main()
