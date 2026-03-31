const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
};

export const buildVipPdfImportError = (remoteError: unknown, localError?: unknown) => {
  const remoteMessage = getErrorMessage(remoteError);
  const localMessage = getErrorMessage(localError);
  const isGatewayCredentialError = /Invalid API key format|Error de autenticación con el gateway de IA/i.test(remoteMessage);

  if (localMessage) return localMessage;
  if (localError) return 'No se pudo leer el PDF localmente.';
  if (isGatewayCredentialError) return 'El análisis asistido no está disponible en este momento.';
  return remoteMessage || 'No se pudo procesar el PDF';
};
