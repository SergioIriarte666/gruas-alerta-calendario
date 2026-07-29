import { describe, expect, it } from 'vitest';
import {
  LocationUploadError,
  isPermanentLocationUploadCode,
  isPermanentUploadError,
} from '@/services/locationUploadErrors';

describe('locationUploadErrors', () => {
  it.each(['22003', '22023', '22P02', '23502', '23503', '23505', '23514'])(
    'considera %s un rechazo permanente del contenido',
    (code) => {
      expect(isPermanentLocationUploadCode(code)).toBe(true);
      expect(isPermanentUploadError(new LocationUploadError('rechazado', code))).toBe(true);
    },
  );

  it.each(['40001', '55P03', '57014', '57P01', '08006', 'PGRST002', '42501', null])(
    'conserva el punto ante el error recuperable o desconocido %s',
    (code) => {
      expect(isPermanentLocationUploadCode(code)).toBe(false);
      expect(isPermanentUploadError(new LocationUploadError('reintentar', code))).toBe(false);
    },
  );
});
