/**
 * Las inspecciones pueden quedar en custodia semanas o meses antes del retiro, así que
 * persistir signed URLs (TTL de 7 días) en la base de datos rompe el acceso a la evidencia.
 * Solo se persiste el path del objeto en Storage; la URL firmada se genera al momento de
 * mostrar/descargar. Esta función extrae el path de signed URLs antiguas ya persistidas.
 */
export const extractStoragePath = (
  value: string | null | undefined,
  bucket: string,
): string | null => {
  if (!value) return value ?? null;
  if (!value.startsWith('http')) return value;

  const signMarker = `/object/sign/${bucket}/`;
  const signIndex = value.indexOf(signMarker);
  if (signIndex !== -1) {
    return value.slice(signIndex + signMarker.length).split('?')[0];
  }

  const publicMarker = `/object/public/${bucket}/`;
  const publicIndex = value.indexOf(publicMarker);
  if (publicIndex !== -1) {
    return value.slice(publicIndex + publicMarker.length).split('?')[0];
  }

  return value;
};
