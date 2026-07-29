/**
 * SQLSTATE que demuestran que el contenido del punto no puede guardarse.
 *
 * La lista es deliberadamente corta. Tener código NO vuelve permanente a un
 * error: PostgreSQL también codifica reinicios, bloqueos, timeouts, falta de
 * recursos y fallos de conexión. Ante cualquier código desconocido se conserva
 * el punto, porque una corrección del servidor o la renovación de la sesión
 * puede volverlo subible.
 */
const PERMANENT_LOCATION_UPLOAD_CODES = new Set([
  '22003', // numeric_value_out_of_range
  '22023', // invalid_parameter_value (también relaciones de sesión inválidas)
  '22P02', // invalid_text_representation
  '23502', // not_null_violation
  '23503', // foreign_key_violation
  '23505', // unique_violation no cubierta por la idempotencia de la RPC
  '23514', // check_violation
]);

export const isPermanentLocationUploadCode = (
  code: string | null | undefined,
): boolean => Boolean(code && PERMANENT_LOCATION_UPLOAD_CODES.has(code));

export class LocationUploadError extends Error {
  readonly code: string | null;
  readonly permanent: boolean;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'LocationUploadError';
    this.code = code;
    this.permanent = isPermanentLocationUploadCode(code);
  }
}

export const isPermanentUploadError = (error: unknown): boolean =>
  error instanceof LocationUploadError && error.permanent;
