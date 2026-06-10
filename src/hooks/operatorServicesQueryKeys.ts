export const operatorServicesKeys = {
  all: ['operator-services'] as const,
  byUser: (userId?: string) => ['operator-services', 'user', userId ?? null, 'v3'] as const,
  byOperator: (operatorId?: string) => ['operator-services', 'operator', operatorId ?? null] as const,
};

export const operatorServiceKeys = {
  all: ['operatorService'] as const,
  detail: (serviceId?: string) => ['operatorService', serviceId ?? null] as const,
};
