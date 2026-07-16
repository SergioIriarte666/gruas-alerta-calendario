import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: fromMock },
}));

import { deleteCostRecord } from '@/hooks/useCosts';

describe('deleteCostRecord', () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('desvincula el movimiento antes de borrar el costo', async () => {
    const operations: string[] = [];

    fromMock
      .mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              operations.push('select');
              return {
                data: { service_id: 'service-1', inventory_movement_id: 'movement-1' },
                error: null,
              };
            },
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        update: (payload: unknown) => ({
          eq: async () => {
            operations.push('unlink');
            expect(payload).toEqual({ inventory_movement_id: null });
            return { error: null };
          },
        }),
      }))
      .mockImplementationOnce(() => ({
        delete: () => ({
          eq: async () => {
            operations.push('delete');
            return { error: null };
          },
        }),
      }));

    await expect(deleteCostRecord('cost-1')).resolves.toBe('service-1');

    expect(operations).toEqual(['select', 'unlink', 'delete']);
    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(fromMock).toHaveBeenNthCalledWith(1, 'costs');
    expect(fromMock).toHaveBeenNthCalledWith(2, 'costs');
    expect(fromMock).toHaveBeenNthCalledWith(3, 'costs');
  });

  it('borra directamente un costo sin vínculo a bodega', async () => {
    const operations: string[] = [];

    fromMock
      .mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: async () => {
              operations.push('select');
              return {
                data: { service_id: null, inventory_movement_id: null },
                error: null,
              };
            },
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        delete: () => ({
          eq: async () => {
            operations.push('delete');
            return { error: null };
          },
        }),
      }));

    await expect(deleteCostRecord('cost-2')).resolves.toBeNull();

    expect(operations).toEqual(['select', 'delete']);
    expect(fromMock).toHaveBeenCalledTimes(2);
  });

  it('no intenta borrar si falla la desvinculación', async () => {
    fromMock
      .mockImplementationOnce(() => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { service_id: null, inventory_movement_id: 'movement-1' },
              error: null,
            }),
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        update: () => ({
          eq: async () => ({ error: { message: 'unlink failed' } }),
        }),
      }));

    await expect(deleteCostRecord('cost-3')).rejects.toThrow('unlink failed');
    expect(fromMock).toHaveBeenCalledTimes(2);
  });
});
