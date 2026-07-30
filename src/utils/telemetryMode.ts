export const TELEMETRY_MODES = ['none', 'operator', 'crane', 'external'] as const;

export type TelemetryMode = (typeof TELEMETRY_MODES)[number];

export const TELEMETRY_MODE_OPTIONS: Array<{
  value: TelemetryMode;
  label: string;
  description: string;
}> = [
  {
    value: 'crane',
    label: 'GPS de grúa',
    description: 'Servicio operativo ejecutado con una grúa y un operador propios.',
  },
  {
    value: 'operator',
    label: 'GPS de operador',
    description: 'Servicio en terreno que usa la ubicación del operador, sin exigir una grúa.',
  },
  {
    value: 'external',
    label: 'Proveedor externo',
    description: 'El servicio no forma parte de la cobertura GPS interna, salvo integración explícita.',
  },
  {
    value: 'none',
    label: 'Sin telemetría',
    description: 'Servicio administrativo, custodia, venta u otra actividad que no debe generar GPS.',
  },
];

export const getTelemetryModeLabel = (mode: TelemetryMode): string => (
  TELEMETRY_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode
);

export const isInternalTelemetryMode = (mode: TelemetryMode): boolean => (
  mode === 'crane' || mode === 'operator'
);
