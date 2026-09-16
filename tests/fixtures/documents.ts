// Synthetic fixtures only: no user documents or external resources.
function pdfObjects(objects: (string | Buffer)[]) {
  const parts = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  let size = parts[0].length;
  objects.forEach((object, i) => {
    offsets.push(size);
    const part = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.isBuffer(object) ? object : Buffer.from(object), Buffer.from('\nendobj\n')]);
    parts.push(part); size += part.length;
  });
  parts.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF\n`));
  return Buffer.concat(parts);
}
export function textPdf(texts = ['Documento di prova: il codice e ORCHIDEA42.', 'Seconda pagina: la consegna e prevista venerdi.']) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${texts.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${texts.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  for (const text of texts) {
    const lines = text.match(/.{1,75}/g) || [];
    const stream = text ? `BT /F1 10 Tf 14 TL 50 790 Td ${lines.map(line => `(${line.replace(/[\\()]/g, '\\$&')}) Tj T*`).join(' ')} ET` : '';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${objects.length + 2} 0 R >>`,
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    );
  }
  return pdfObjects(objects);
}
export function imagePdf(jpeg: Buffer, width: number, height: number) {
  const stream = 'q 540 0 0 180 25 600 cm /Photo Do Q';
  return pdfObjects([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Photo 4 0 R >> >> /Contents 5 0 R >>',
    Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, Buffer.from('\nendstream')]),
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]);
}
