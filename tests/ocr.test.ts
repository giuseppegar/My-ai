import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('node:child_process', async () => {
  const { promisify } = await import('node:util');
  return { execFile: Object.assign(() => undefined, { [promisify.custom]: execute }) };
});
import { recognizeDocument } from '@/server/ocr';

const photo = readFileSync(new URL('./fixtures/photo.png', import.meta.url));
beforeEach(() => { execute.mockReset(); vi.stubEnv('DOCUMENT_OCR_ENABLED', 'true'); });
afterEach(() => vi.unstubAllEnvs());
describe('OCR locale con risorse limitate', () => {
  it('non esegue processi se disattivato', async () => {
    vi.stubEnv('DOCUMENT_OCR_ENABLED', 'false');
    expect((await recognizeDocument(photo)).note).toContain('non attivo');
    expect(execute).not.toHaveBeenCalled();
  });
  it('legge una foto con Tesseract senza shell e ripulisce la directory privata', async () => {
    execute.mockResolvedValue({ stdout: 'ORCHIDEA42\n', stderr: '' });
    const result = await recognizeDocument(photo);
    expect(result.pages).toEqual([{ page: null, content: 'ORCHIDEA42' }]);
    const [command, args, options] = execute.mock.calls[0];
    expect(command).toBe('tesseract');
    expect(args.slice(1)).toEqual(['stdout', '-l', 'ita+eng']);
    expect(options).toMatchObject({ timeout: expect.any(Number), killSignal: 'SIGKILL', maxBuffer: 2_000_000 });
    expect(options.shell).toBeUndefined();
    expect(existsSync(dirname(args[0]))).toBe(false);
  });
  it('limita OCR a 20 pagine e conserva i riferimenti corretti', async () => {
    execute.mockImplementation(async (command, args) => {
      if (command === 'pdftoppm') writeFileSync(`${args.at(-1)}.png`, photo);
      return { stdout: command === 'tesseract' ? 'Contenuto riconosciuto' : '', stderr: '' };
    });
    const result = await recognizeDocument(Buffer.from('synthetic PDF, render mocked'), Array.from({ length: 25 }, (_, i) => i + 5));
    expect(result.pages).toHaveLength(20);
    expect(result.pages[0].page).toBe(5);
    expect(result.pages[19].page).toBe(24);
    expect(result.note).toContain('20 di 25');
    expect(execute.mock.calls.filter(c => c[0] === 'pdftoppm')).toHaveLength(20);
  });
  it('mantiene le pagine già lette se un processo fallisce', async () => {
    let count = 0;
    execute.mockImplementation(async (command, args) => {
      if (command === 'pdftoppm') writeFileSync(`${args.at(-1)}.png`, photo);
      else if (++count > 1) throw new Error('Timeout');
      return { stdout: 'Prima pagina letta', stderr: '' };
    });
    const result = await recognizeDocument(Buffer.from('synthetic'), [1, 2]);
    expect(result.pages).toEqual([{ page: 1, content: 'Prima pagina letta' }]);
    expect(result.note).toContain('incompleto');
  });
  it('dichiara lo strumento mancante invece di fingere di aver letto la foto', async () => {
    execute.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    const result = await recognizeDocument(photo);
    expect(result.pages).toEqual([]);
    expect(result.note).toContain('OCR non disponibile');
  });
});
