/**
 * Recupera la hora REAL de captura desde el nombre del archivo.
 *
 * PhotoProcessor.generateFileName escribe `businessClock.nowISO()` con `:` y `.`
 * reemplazados por `-`, así que el nombre lleva el instante exacto de la toma:
 *   set_fotografico_izquierdo-2026-07-25T15-44-06-04-00-x7k2n.jpg
 *                             └─ 2026-07-25T15:44:06-04:00 ─┘
 *
 * El acta estampaba en cambio la hora de generación del PDF, que es varios
 * minutos posterior y hace ver las 6 fotos tomadas al mismo segundo. El dato
 * bueno siempre estuvo en el nombre del archivo.
 */
const FILENAME_TIMESTAMP = /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?(Z|[+-]\d{2}-\d{2})/;

export const parsePhotoCaptureAt = (fileName: string | null | undefined): Date | null => {
  if (!fileName) return null;

  const match = FILENAME_TIMESTAMP.exec(fileName);
  if (!match) return null;

  const [, date, hours, minutes, seconds, millis, zone] = match;
  // El offset viaja como "-04-00" (los `:` fueron reemplazados al nombrar):
  // se restaura a "-04:00" para que Date lo interprete.
  const offset = zone === 'Z' ? 'Z' : `${zone.slice(0, 3)}:${zone.slice(4)}`;
  const fraction = millis ? `.${millis}` : '';

  const parsed = new Date(`${date}T${hours}:${minutes}:${seconds}${fraction}${offset}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};
