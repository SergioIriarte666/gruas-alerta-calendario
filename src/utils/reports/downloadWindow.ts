const DOWNLOAD_WINDOW_TITLE = 'Preparando descarga';

export const openDownloadWindow = (): Window | null => {
  const downloadWindow = window.open('', '_blank', 'noopener,noreferrer');

  if (!downloadWindow) {
    return null;
  }

  downloadWindow.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${DOWNLOAD_WINDOW_TITLE}</title>
        <style>
          body { font-family: system-ui, sans-serif; margin: 32px; color: #111827; }
        </style>
      </head>
      <body>
        <h1>${DOWNLOAD_WINDOW_TITLE}</h1>
        <p>El archivo se abrirá aquí cuando termine de generarse.</p>
      </body>
    </html>
  `);
  downloadWindow.document.close();

  return downloadWindow;
};

export const sendBlobToDownloadWindow = (downloadWindow: Window | null | undefined, blob: Blob, fileName: string) => {
  if (!downloadWindow || downloadWindow.closed) {
    return false;
  }

  const url = URL.createObjectURL(blob);
  downloadWindow.location.href = url;
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
};
