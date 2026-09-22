import { loadPdfJsCompat } from '@/utils/loadPdfJsCompat';

export async function readIssuedInvoicePdf(file: File): Promise<string> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error('El PDF supera el límite de 20 MB.');
  const pdfjs = await loadPdfJsCompat();
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 30) throw new Error('Máximo 30 páginas por factura.');
    const lines: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const rows: { y: number; parts: { x: number; text: string }[] }[] = [];
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue;
        let row = rows.find((r) => Math.abs(r.y - item.transform[5]) < 2);
        if (!row) {
          row = { y: item.transform[5], parts: [] };
          rows.push(row);
        }
        row.parts.push({ x: item.transform[4], text: item.str });
      }
      rows
        .sort((a, b) => b.y - a.y)
        .forEach((r) =>
          lines.push(
            r.parts
              .sort((a, b) => a.x - b.x)
              .map((p) => p.text)
              .join(' '),
          ),
        );
    }
    if (lines.join('').trim().length >= 50) return lines.join('\n');
    // Scanned PDF: OCR all pages; the user must still review every extracted field.
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('spa');
    try {
      const texts: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No se pudo preparar el OCR.');
        await page.render({ canvasContext: context, viewport }).promise;
        texts.push((await worker.recognize(canvas)).data.text);
        canvas.width = 0;
        canvas.height = 0;
      }
      return texts.join('\n');
    } finally {
      await worker.terminate();
    }
  } finally {
    await task.destroy();
  }
}
