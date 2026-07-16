import type { LowboyContainerRow } from '@/types/lowboyContainers';
import { CONTAINER_SIZE_LABEL } from '@/types/lowboyContainers';
import type { LowboyContainerSaleAssignmentDraft } from '@/types/lowboySales';

export const distributeLowboySaleNet = (netAmount: number, count: number): number[] => {
  if (count <= 0) return [];
  const safeNet = Math.max(0, Math.round(Number(netAmount) || 0));
  const base = Math.floor(safeNet / count);
  const remainder = safeNet - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
};

export const recalculateLowboyAssignmentDefaults = (
  assignments: LowboyContainerSaleAssignmentDraft[],
  netAmount: number,
): LowboyContainerSaleAssignmentDraft[] => {
  const defaults = distributeLowboySaleNet(netAmount, assignments.length);
  return assignments.map((assignment, index) => assignment.manuallyEdited
    ? assignment
    : { ...assignment, sale_net_price: defaults[index] });
};

export const composeLowboyContainerDescription = (containers: LowboyContainerRow[]): string => {
  if (containers.length === 0) return '';
  if (containers.length === 1) {
    const container = containers[0];
    const size = CONTAINER_SIZE_LABEL[container.size as keyof typeof CONTAINER_SIZE_LABEL] ?? container.size;
    return `Contenedor ${size} ${container.serial_number || 'Sin serie'}`;
  }
  const labels = containers.map((container) => container.serial_number || 'Sin serie');
  return `${containers.length} contenedores: ${labels.join(', ')}`;
};
