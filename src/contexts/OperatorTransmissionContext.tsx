import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useOperatorServicesTabs } from '@/hooks/useOperatorServicesTabs';
import { useOperatorLocationTracking } from '@/hooks/useOperatorLocationTracking';
import { resolveOperatorServiceSelection } from '@/utils/operatorActiveService';
import { createLogger } from '@/lib/logger';
import type { Service } from '@/types';

const logger = createLogger('OperatorTransmission');

const SELECTED_SERVICE_KEY = 'operator-selected-service-v1';

type TrackingState = ReturnType<typeof useOperatorLocationTracking>;

interface OperatorTransmissionValue extends TrackingState {
  /** Servicio al que se asocia la TRANSMISIÓN (puede ser el próximo asignado). */
  trackingService: Service | null;
  /** Servicio EN CURSO: el único al que pueden colgarse detenciones. */
  activeService: Service | null;
  /** Servicios en vuelo de la jornada, para elegir cuando hay más de uno. */
  candidates: Service[];
  /** true = hay varios en vuelo y nadie eligió: no se asume ninguno. */
  requiresSelection: boolean;
  selectService: (serviceId: string | null) => void;
}

const OperatorTransmissionContext = createContext<OperatorTransmissionValue | null>(null);

/**
 * Dueño único de la transmisión del operador, montado POR ENCIMA del `<Outlet/>`.
 *
 * Antes `useOperatorLocationTracking` vivía dentro de `TransmissionControl`, que
 * se renderiza desde `OperatorDashboard` — una ruta. Cambiar a la pestaña
 * Actividad desmontaba la página, el cleanup del efecto llamaba a
 * `clearCaptureLoop()` y ese `removeWatcher` mataba el GPS. En terreno el 01/08
 * se vio como el badge "Reconectando" y un evento "Ubicación interrumpida" cada
 * vez que el operador tocaba una pestaña.
 *
 * El singleton de módulo del hook impedía watchers HUÉRFANOS, no el desmontaje:
 * son dos problemas distintos. Acá el ciclo de vida queda atado a la sesión de
 * transmisión y no a la pantalla visible — el watcher se registra una vez y se
 * libera sólo al detener la transmisión o cerrar el servicio.
 *
 * También es el dueño ÚNICO de la selección de servicio: dos consumidores del
 * hook abren dos watchers y pelean por la misma sesión, así que la única forma
 * de que eso no vuelva a pasar es que exista un solo lugar donde llamarlo.
 */
export const OperatorTransmissionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const { serviceTabs } = useOperatorServicesTabs();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    () => window.localStorage.getItem(SELECTED_SERVICE_KEY),
  );

  const operatorServices = useMemo(
    () => [
      ...serviceTabs.activos,
      ...serviceTabs.pendientes_entrega,
      ...[...serviceTabs.asignados].sort((a, b) =>
        (a.serviceDate || '').localeCompare(b.serviceDate || '')),
    ],
    [serviceTabs.activos, serviceTabs.pendientes_entrega, serviceTabs.asignados],
  );

  // El operator_id va como tercer argumento a propósito: los controles del
  // servicio —transmisión, detenciones, link del cliente, entrega— pertenecen
  // al operador PRINCIPAL. Un adicional ve el servicio en su jornada, pero no
  // lo maneja.
  const { candidates, requiresSelection, activeService, trackingService } =
    resolveOperatorServiceSelection(operatorServices, selectedServiceId, user?.operator_id);

  // La elección deja de ser válida cuando el servicio elegido sale de la lista.
  useEffect(() => {
    if (!selectedServiceId) return;
    if (!candidates.some((service) => service.id === selectedServiceId)) {
      setSelectedServiceId(null);
      window.localStorage.removeItem(SELECTED_SERVICE_KEY);
    }
  }, [candidates, selectedServiceId]);

  const selectService = useCallback((serviceId: string | null) => {
    setSelectedServiceId(serviceId);
    if (serviceId) {
      window.localStorage.setItem(SELECTED_SERVICE_KEY, serviceId);
    } else {
      window.localStorage.removeItem(SELECTED_SERVICE_KEY);
    }
  }, []);

  const tracking = useOperatorLocationTracking({
    operatorId: user?.operator_id,
    userId: user?.id,
    currentService: trackingService,
  });

  useEffect(() => {
    logger.debug('Transmisión montada sobre el router', { operatorId: user?.operator_id });
  }, [user?.operator_id]);

  const value = useMemo<OperatorTransmissionValue>(() => ({
    ...tracking,
    trackingService,
    activeService,
    candidates,
    requiresSelection,
    selectService,
  }), [tracking, trackingService, activeService, candidates, requiresSelection, selectService]);

  return (
    <OperatorTransmissionContext.Provider value={value}>
      {children}
    </OperatorTransmissionContext.Provider>
  );
};

export const useOperatorTransmission = (): OperatorTransmissionValue => {
  const context = useContext(OperatorTransmissionContext);
  if (!context) {
    throw new Error('useOperatorTransmission debe usarse dentro de OperatorTransmissionProvider');
  }
  return context;
};
