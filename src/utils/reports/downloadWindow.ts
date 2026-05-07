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
  downloadWindow.document.body.innerHTML = '';
  const title = downloadWindow.document.createElement('h1');
  title.textContent = 'Descarga lista';
  const link = downloadWindow.document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.textContent = `Descargar ${fileName}`;
  link.style.fontFamily = 'system-ui, sans-serif';
  link.style.fontSize = '18px';
  downloadWindow.document.body.appendChild(title);
  downloadWindow.document.body.appendChild(link);
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
};
