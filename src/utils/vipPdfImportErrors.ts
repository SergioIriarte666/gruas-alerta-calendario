const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
};

export const buildVipPdfImportError = (remoteError: unknown, localError?: unknown) => {
  const remoteMessage = getErrorMessage(remoteError);
  const localMessage = getErrorMessage(localError);
  const isGatewayCredentialError = /Invalid API key format|Error de autenticación con el gateway de IA/i.test(remoteMessage);

  const normalizedRemote = isGatewayCredentialError
    ? 'No se pudo analizar el PDF en este momento.'
    : remoteMessage;

  const normalizedLocal = localMessage || (localError ? 'No se pudo leer el PDF localmente.' : '');

  if (normalizedLocal) return normalizedLocal;

  if (normalizedRemote) {
    return isGatewayCredentialError ? normalizedRemote : normalizedRemote;
  }

  return 'No se pudo procesar el PDF';
};
