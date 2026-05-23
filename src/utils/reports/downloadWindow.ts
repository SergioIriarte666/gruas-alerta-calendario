const DOWNLOAD_WINDOW_TITLE = 'Preparando descarga';

export const openDownloadWindow = (): Window | null => {
  const downloadWindow = window.open('', '_blank');

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
  downloadWindow.document.body.innerHTML = `
    <h1>PDF listo</h1>
    <p>Si la descarga no inicia automáticamente, usa el botón de abajo.</p>
    <div id="download-actions"></div>
    <iframe title="Vista previa PDF" style="width:100%;height:75vh;margin-top:20px;border:1px solid #d1d5db;border-radius:8px;"></iframe>
  `;
  const actions = downloadWindow.document.getElementById('download-actions');
  const link = downloadWindow.document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.textContent = `Descargar PDF`;
  link.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:8px;background:#7c3aed;color:white;text-decoration:none;font:600 16px system-ui,sans-serif;';
  actions?.appendChild(link);
  const iframe = downloadWindow.document.querySelector('iframe');
  if (iframe) iframe.src = url;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
};
