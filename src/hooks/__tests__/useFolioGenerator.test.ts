import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFolioGenerator } from '../useFolioGenerator';

const mockSettings = {
  company: {
    folioFormat: 'SRV-{number}',
    nextServiceFolioNumber: 1050,
  },
};

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: mockSettings,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabase.from(...args),
    rpc: (...args: any[]) => mockSupabase.rpc(...args),
  },
}));

describe('useFolioGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // El folio lo emite la secuencia de Postgres (next_service_folio).
    mockSupabase.rpc.mockResolvedValue({ data: 'SRV-6904', error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'company-uuid',
              next_service_folio_number: 1050,
            },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it('devuelve el folio que emitió la secuencia', async () => {
    const { result } = renderHook(() => useFolioGenerator());

    let folio = '';
    await act(async () => {
      folio = await result.current.generateNextFolio();
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('next_service_folio');
    expect(folio).toBe('SRV-6904');
  });

  it('no calcula el correlativo en el cliente', async () => {
    const { result } = renderHook(() => useFolioGenerator());

    await act(async () => {
      await result.current.generateNextFolio();
    });

    // Leer company_data y escribirlo +1 en dos viajes es lo que permitió que
    // dos formularios sacaran el mismo folio y que borrar reciclara números.
    expect(mockSupabase.from).not.toHaveBeenCalledWith('company_data');
  });

  it('propaga el error en vez de inventar un folio por timestamp', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const { result } = renderHook(() => useFolioGenerator());

    await expect(
      act(async () => {
        await result.current.generateNextFolio();
      }),
    ).rejects.toThrow();
  });

  it('tampoco acepta una respuesta vacía como folio válido', async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    const { result } = renderHook(() => useFolioGenerator());

    await expect(
      act(async () => {
        await result.current.generateNextFolio();
      }),
    ).rejects.toThrow(/no devolvió un folio válido/i);
  });

  it('validates folio uniqueness returns true for unique', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useFolioGenerator());

    let isUnique = false;
    await act(async () => {
      isUnique = await result.current.validateFolioUniqueness('SRV-9999');
    });

    expect(isUnique).toBe(true);
  });

  it('validates folio uniqueness returns false for duplicate', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'existing-id', folio: 'SRV-1050' },
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useFolioGenerator());

    let isUnique = true;
    await act(async () => {
      isUnique = await result.current.validateFolioUniqueness('SRV-1050');
    });

    expect(isUnique).toBe(false);
  });
});
