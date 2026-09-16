import 'server-only';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';

const exec = promisify(execFile);
const maxOcrPages = 20;
let active = 0;
export const ocrEnabled = () => process.env.DOCUMENT_OCR_ENABLED === 'true';
export const imageOptions = { limitInputPixels: 40_000_000, failOn: 'warning' as const };
type OcrResult = { pages: { page: number | null; content: string }[]; note: string };

// No shell, remote OCR service, original filenames or document contents in logs.
// The runtime image supplies Poppler + Tesseract (Italian and English).
export async function recognizeDocument(buffer: Buffer, pdfPages?: number[]): Promise<OcrResult> {
  if (!ocrEnabled()) return { pages: [], note: 'OCR locale non attivo: il testo di foto e scansioni non viene letto. Il file originale resta disponibile.' };
  if (active >= 2) return { pages: [], note: 'OCR locale occupato. Il file è conservato: usa Reindicizza per riprovare.' };
  active++;
  let directory: string | undefined;
  const pages: OcrResult['pages'] = [];
  const notes: string[] = [];
  const deadline = Date.now() + 45_000;
  const run = async (command: string, args: string[]) => {
    if (Date.now() >= deadline) throw new Error('OCR_TIMEOUT');
    return exec(command, args, { timeout: Math.min(15_000, deadline - Date.now()), killSignal: 'SIGKILL', maxBuffer: 2_000_000, env: { ...process.env, OMP_THREAD_LIMIT: '1' } });
  };
  try {
    directory = await mkdtemp(join(tmpdir(), 'myai-ocr-'));
    const input = join(directory, pdfPages ? 'input.pdf' : 'input.png');
    await writeFile(input, pdfPages ? buffer : await sharp(buffer, imageOptions).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).png().toBuffer(), { mode: 0o600 });
    const requested = pdfPages?.slice(0, maxOcrPages) ?? [null];
    for (const page of requested) {
      let image = input;
      if (page !== null) {
        const prefix = join(directory, 'page');
        await run('pdftoppm', ['-f', String(page), '-l', String(page), '-scale-to', '2200', '-singlefile', '-png', input, prefix]);
        image = `${prefix}.png`;
        // Poppler's scale-to bounds each rendered side to 2200 pixels.
      }
      const { stdout } = await run('tesseract', [image, 'stdout', '-l', 'ita+eng']);
      pages.push({ page, content: stdout.trim() });
    }
    if (pdfPages && pdfPages.length > maxOcrPages) notes.push(`OCR parziale: elaborate ${maxOcrPages} di ${pdfPages.length} pagine con poco o nessun testo.`);
  } catch (error) {
    const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
    console.error('document_ocr', missing ? 'tool_unavailable' : 'incomplete');
    notes.push(missing ? 'OCR non disponibile sul server. Il file è conservato; contatta l’amministratore e poi usa Reindicizza.' : 'OCR incompleto o tempo esaurito. Il testo già letto e il file originale sono conservati; puoi riprovare con Reindicizza.');
  } finally {
    try { if (directory) await rm(directory, { recursive: true, force: true }); }
    finally { active--; }
  }
  if (pages.some(p => p.content)) notes.unshift('Testo letto con OCR locale: può contenere errori, verifica l’originale.');
  return { pages, note: notes.join(' ') };
}
