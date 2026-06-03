/**
 * Descarga un Blob directamente en la pestaña actual sin abrir ventana nueva.
 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/** @deprecated Usar downloadBlob directamente */
export const openDownloadWindow = (): null => null;

/** @deprecated Usar downloadBlob directamente */
export const sendBlobToDownloadWindow = (
  _downloadWindow: Window | null | undefined,
  blob: Blob,
  fileName: string,
): boolean => {
  downloadBlob(blob, fileName);
  return true;
};
