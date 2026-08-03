import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { describeCrane } from '@/utils/checklists/checklistLogic';

const logger = createLogger('Checklists');

export interface ChecklistOperator {
  id: string;
  name: string;
  rut: string;
}

export interface ChecklistCraneOption {
  id: string;
  license_plate: string;
  brand: string | null;
  model: string | null;
  type: string | null;
  label: string;
}

export interface ChecklistServiceOption {
  id: string;
  folio: string;
  license_plate: string | null;
}

/**
 * Datos de contexto para arrancar un checklist: quién lo llena, con qué grúa y,
 * opcionalmente, contra qué folio.
 *
 * Los checklists son independientes del flujo de servicio: la lista de folios y
 * la grúa sugerida son ayudas de prellenado. Si el operador no tiene ningún
 * servicio, el checklist se crea igual — el selector de grúa lista TODAS las
 * grúas activas, no solo la del servicio en curso.
 */
export const useOperatorChecklistContext = (userId?: string | null) => {
  const operatorQuery = useQuery({
    queryKey: ['checklist-operator', userId],
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ChecklistOperator | null> => {
      const { data, error } = await supabase
        .from('operators')
        .select('id, name, rut')
        .eq('user_id', userId as string)
        .maybeSingle();

      if (error) {
        logger.error('Error resolviendo el operador del checklist:', error);
        throw error;
      }
      return data ?? null;
    },
  });

  const operatorId = operatorQuery.data?.id ?? null;

  const cranesQuery = useQuery({
    queryKey: ['checklist-cranes'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<ChecklistCraneOption[]> => {
      const { data, error } = await supabase
        .from('cranes')
        .select('id, license_plate, brand, model, type')
        .eq('status', 'active')
        .order('license_plate');

      if (error) {
        logger.error('Error cargando grúas para el checklist:', error);
        throw error;
      }

      // La grúa es la fuente de verdad de patente y tipo: se trae la ficha
      // completa para poder derivar el encabezado sin que el operador teclee
      // datos que ya están en el catálogo.
      return (data ?? []).map((crane) => ({
        id: crane.id,
        license_plate: crane.license_plate,
        brand: crane.brand ?? null,
        model: crane.model ?? null,
        type: crane.type ?? null,
        label: describeCrane(crane),
      }));
    },
  });

  /**
   * Folios abiertos del operador, SOLO para el selector opcional y para sugerir
   * la grúa. Si esta consulta falla, el módulo sigue funcionando: se degrada a
   * lista vacía en vez de propagar el error.
   */
  const servicesQuery = useQuery({
    queryKey: ['checklist-operator-services', operatorId],
    enabled: Boolean(operatorId),
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ChecklistServiceOption[]> => {
      const { data, error } = await supabase
        .from('services')
        .select('id, folio, license_plate, crane_id, service_date')
        .eq('operator_id', operatorId as string)
        .in('status', ['pending', 'in_progress', 'inspection_completed'])
        .order('service_date', { ascending: false })
        .limit(20);

      if (error) {
        logger.warn('No se pudieron cargar folios para el checklist (opcional):', error);
        return [];
      }

      return (data ?? []).map((service) => ({
        id: service.id,
        folio: service.folio,
        license_plate: service.license_plate ?? null,
        crane_id: service.crane_id ?? null,
      })) as ChecklistServiceOption[];
    },
  });

  // Grúa sugerida: la del servicio abierto más reciente del operador. Es solo el
  // valor inicial del selector; el operador puede cambiarla siempre.
  const suggestedCraneId =
    ((servicesQuery.data ?? []) as Array<{ crane_id?: string | null }>).find((s) => s.crane_id)
      ?.crane_id ?? null;

  return {
    operator: operatorQuery.data ?? null,
    operatorId,
    cranes: cranesQuery.data ?? [],
    services: servicesQuery.data ?? [],
    suggestedCraneId,
    isLoading: operatorQuery.isLoading || cranesQuery.isLoading,
    error: operatorQuery.error ?? cranesQuery.error ?? null,
  };
};
