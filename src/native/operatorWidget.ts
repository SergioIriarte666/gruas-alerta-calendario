import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Service } from '@/types';
import { createLogger } from '@/lib/logger';

const logger = createLogger('OperatorWidget');

export interface OperatorWidgetService {
  id: string;
  folio: string;
  date: string;
  time: string;
  origin: string;
  destination: string;
  status: Service['status'];
  deepLink: string;
}

export interface OperatorWidgetPayload {
  nextService: OperatorWidgetService | null;
  activeService: OperatorWidgetService | null;
  updatedAt: string;
}

interface OperatorWidgetPlugin {
  sync(options: OperatorWidgetPayload): Promise<void>;
  clear(): Promise<void>;
}

const OperatorWidget = registerPlugin<OperatorWidgetPlugin>('OperatorWidget');

const toWidgetService = (service: Service, deepLink: string): OperatorWidgetService => ({
  id: service.id,
  folio: service.folio,
  date: service.serviceDate || '',
  time: service.startTime || '',
  origin: service.origin || 'Origen pendiente',
  destination: service.destination || 'Destino pendiente',
  status: service.status,
  deepLink,
});

const serviceSortKey = (service: Service): string =>
  `${service.serviceDate || '9999-12-31'}T${service.startTime || '23:59'}`;

export const buildOperatorWidgetPayload = (
  services: Service[],
  updatedAt = new Date().toISOString(),
): OperatorWidgetPayload => {
  const nextService = [...services]
    .filter((service) => service.status === 'pending')
    .sort((left, right) => serviceSortKey(left).localeCompare(serviceSortKey(right)))[0] ?? null;
  const activeService = services.find((service) => service.status === 'in_progress') ?? null;

  return {
    nextService: nextService ? toWidgetService(nextService, 'tmsoperador://operator') : null,
    activeService: activeService ? toWidgetService(activeService, 'tmsoperador://operator/active') : null,
    updatedAt,
  };
};

export const syncOperatorWidgets = async (services: Service[]): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await OperatorWidget.sync(buildOperatorWidgetPayload(services));
  } catch (error) {
    logger.warn('No se pudieron actualizar los widgets nativos', error);
  }
};

export const clearOperatorWidgets = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await OperatorWidget.clear();
  } catch (error) {
    logger.warn('No se pudieron limpiar los widgets nativos', error);
  }
};
