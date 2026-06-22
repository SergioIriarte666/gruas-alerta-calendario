/** Codifica binarios grandes sin expandir todos sus bytes como argumentos de una llamada. */
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8 * 1024;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    let chunkText = '';
    for (let index = 0; index < chunk.length; index += 1) {
      chunkText += String.fromCharCode(chunk[index]);
    }
    binary += chunkText;
  }

  return btoa(binary);
};
