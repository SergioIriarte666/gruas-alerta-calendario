export interface DownloadTextFileOptions {
  content: string;
  fileName: string;
  contentType: string;
}

const DOWNLOAD_URL_REVOKE_DELAY = 30_000;

export const openDownloadTarget = (): Window | null => {
  if (typeof window === 'undefined') return null;

  const target = window.open('', '_blank');

  if (!target) return null;

  target.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Generando PDF</title>
        <style>
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f8fafc; }
          main { text-align: center; padding: 32px; }
        </style>
      </head>
      <body>
        <main>
          <h1>Generando PDF…</h1>
          <p>Esta ventana mostrará el documento cuando esté listo.</p>
        </main>
      </body>
    </html>
  `);
  target.document.close();

  return target;
};

export const downloadTextFile = ({ content, fileName, contentType }: DownloadTextFileOptions) => {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, DOWNLOAD_URL_REVOKE_DELAY);
};

export const triggerFileDownload = (url: string, fileName: string) => {
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.target = '_blank';
  link.rel = 'noopener';
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const showPdfInDownloadTarget = (target: Window | null, url: string, fileName: string) => {
  if (!target || target.closed) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return false;
  }

  target.document.title = fileName;
  target.document.body.style.margin = '0';
  target.document.body.innerHTML = '';
  target.location.href = url;
  return true;
};