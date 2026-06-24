import type { Crane, CraneStatus } from '@/types';

export const isCranePermanentlyLocked = (
  crane: Pick<Crane, 'status'> | null | undefined,
): boolean => crane?.status === 'sold' || crane?.status === 'written_off';

export const getCraneStatusLabel = (status: CraneStatus | undefined): string => {
  switch (status) {
    case 'active':
      return 'Activa';
    case 'inactive':
      return 'Inactiva';
    case 'sold':
      return 'Vendida';
    case 'written_off':
      return 'Dada de baja';
    default:
      return 'Activa';
  }
};
