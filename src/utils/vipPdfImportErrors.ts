const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
};

export const buildVipPdfImportError = (remoteError: unknown, localError?: unknown) => {
  const remoteMessage = getErrorMessage(remoteError);
  const localMessage = getErrorMessage(localError);

  return localMessage || remoteMessage || 'No se pudo procesar el PDF';
};
