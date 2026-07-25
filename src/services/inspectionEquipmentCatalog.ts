import { supabase } from '@/integrations/supabase/client';
import { vehicleEquipment } from '@/data/equipmentData';
import { createLogger } from '@/lib/logger';

const logger = createLogger('inspectionEquipmentCatalog');

export interface EquipmentItem {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

/**
 * Último recurso si la tabla no responde. NO es "el catálogo": el catálogo vive
 * en inspection_equipment_items y crece (hoy 36 ítems contra los 35 de esta
 * lista). Cualquier consumidor que quiera enumerar equipos debe llamar a
 * fetchInspectionEquipmentCatalog, nunca importar vehicleEquipment directo — el
 * acta de inspección omitió "Foco Faenero" precisamente por hacer eso.
 */
export const FALLBACK_EQUIPMENT_ITEMS: EquipmentItem[] = vehicleEquipment[0].items.map((item, index) => ({
  id: item.id,
  name: item.name,
  is_active: true,
  sort_order: index + 1,
}));

let inFlight: Promise<EquipmentItem[]> | null = null;

const loadCatalog = async (): Promise<EquipmentItem[]> => {
  const { data, error } = await supabase
    .from('inspection_equipment_items')
    .select('id, name, is_active, sort_order')
    .order('sort_order');

  if (error || !data?.length) {
    if (error) logger.warn('No se pudo cargar el catálogo de equipos, usando fallback local', error);
    return FALLBACK_EQUIPMENT_ITEMS;
  }

  return data as EquipmentItem[];
};

/**
 * Catálogo completo (activos e inactivos), ordenado por sort_order.
 * La promesa se comparte mientras está en vuelo para que el formulario y el
 * generador de PDF no disparen dos consultas por la misma inspección.
 */
export const fetchInspectionEquipmentCatalog = async (): Promise<EquipmentItem[]> => {
  if (!inFlight) {
    inFlight = loadCatalog().finally(() => {
      // Se libera al resolver: la próxima inspección vuelve a leer el catálogo
      // vigente (un ítem agregado en Configuración debe verse sin recargar).
      inFlight = null;
    });
  }
  return inFlight;
};

/** Solo los ítems que deben evaluarse hoy. */
export const fetchActiveInspectionEquipment = async (): Promise<EquipmentItem[]> =>
  (await fetchInspectionEquipmentCatalog()).filter((item) => item.is_active);

/**
 * Estado explícito {item_id: true|false} de TODOS los ítems activos del
 * catálogo, a partir de la lista de presentes marcada en el formulario.
 * Un ítem revisado-y-ausente queda como `false`, distinguible de uno nunca
 * evaluado (ausente del objeto).
 */
export const buildEquipmentStatus = (
  activeItems: EquipmentItem[],
  selectedIds: string[] | undefined,
): Record<string, boolean> => {
  const selected = new Set((selectedIds || []).map(String));
  return Object.fromEntries(activeItems.map((item) => [item.id, selected.has(String(item.id))]));
};
