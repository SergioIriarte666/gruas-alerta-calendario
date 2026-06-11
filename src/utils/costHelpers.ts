import { Cost } from '@/types/costs';
import { CreatorInfo, getCreatorDisplayName } from '@/types/common';
import { getCurrentChileDateString } from '@/utils/timezoneUtils';

export const getCostShortId = (costId?: string | null): string => {
  if (!costId) return 'CST-SIN-ID';
  return `CST-${String(costId).replace(/-/g, '').slice(0, 8).toUpperCase()}`;
};

type AuditHistoryActor = {
  changerName?: string | null;
  changerEmail?: string | null;
} | null | undefined;

const getHistoryActorDisplayName = (entry?: AuditHistoryActor): string | null => {
  if (!entry) return null;
  return entry.changerName || entry.changerEmail || null;
};

export const getCostAuditDisplay = ({
  creator,
  createdHistoryEntry,
  latestUpdateEntry,
  hasCreatedInfo,
  hasUpdatedInfo,
  wasUpdatedAfterCreation,
}: {
  creator?: CreatorInfo | null;
  createdHistoryEntry?: AuditHistoryActor;
  latestUpdateEntry?: AuditHistoryActor;
  hasCreatedInfo: boolean;
  hasUpdatedInfo: boolean;
  wasUpdatedAfterCreation: boolean;
}) => {
  const creatorDisplayName =
    creator
      ? getCreatorDisplayName(creator)
      : getHistoryActorDisplayName(createdHistoryEntry) || (hasCreatedInfo ? 'Sistema o historial no disponible' : null);

  const updaterDisplayName =
    getHistoryActorDisplayName(latestUpdateEntry) ||
    (hasUpdatedInfo && wasUpdatedAfterCreation ? 'Sistema o historial no disponible' : null);

  return {
    creatorDisplayName,
    updaterDisplayName,
  };
};

export const matchesCostIdentifier = (costId: string | null | undefined, searchTerm: string): boolean => {
  if (!costId || !searchTerm.trim()) return false;

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const normalizedRawId = String(costId).toLowerCase();
  const normalizedCompactId = normalizedRawId.replace(/-/g, '');
  const normalizedShortId = getCostShortId(costId).toLowerCase();
  const normalizedShortBody = normalizedShortId.replace(/^cst-/, '');

  return (
    normalizedRawId.includes(normalizedSearch) ||
    normalizedCompactId.includes(normalizedSearch.replace(/-/g, '')) ||
    normalizedShortId.includes(normalizedSearch) ||
    normalizedShortBody.includes(normalizedSearch.replace(/^cst-/, '').replace(/-/g, ''))
  );
};

/**
 * Prepara los datos de un costo para ser duplicado.
 * Actualiza la fecha a hoy y marca la descripción como duplicado.
 */
export const prepareCostForDuplication = (cost: Cost) => {
  const currentDate = getCurrentChileDateString();

  return {
    // Copiar campos principales
    description: `[Duplicado] ${cost.description}`,
    amount: Number(cost.amount),
    category_id: cost.category_id,
    subcategory: cost.subcategory || '',

    // Actualizar fecha a hoy
    date: currentDate,

    // Mantener asociaciones
    crane_id: cost.crane_id || 'none',
    operator_id: cost.operator_id || 'none',
    service_id: cost.service_id || 'none',
    service_folio: cost.service_folio || '',
    cost_center_id: cost.cost_center_id || 'none',

    // Copiar notas
    notes: cost.notes ? `[Copia de costo anterior]\n${cost.notes}` : '',

    // Campos de inventario (no duplicar movimientos)
    purchase_quantity: null,
    purchase_unit_cost: null,
    immediate_consumption: false,
    supplier_id: cost.supplier_id || 'none',
  };
};
