export const operatorServicesKeys = {
  all: ['operator-services'] as const,
  // v4: el select pasó a traer origin_lat/lng y destination_lat/lng. Sin subir
  // la versión, una caché v3 dejaría el botón de compartir decidiendo con
  // coordenadas que ese payload nunca tuvo.
  byUser: (userId?: string) => ['operator-services', 'user', userId ?? null, 'v4'] as const,
  byOperator: (operatorId?: string) => ['operator-services', 'operator', operatorId ?? null] as const,
};

export const operatorServiceKeys = {
  all: ['operatorService'] as const,
  detail: (serviceId?: string) => ['operatorService', serviceId ?? null] as const,
};
