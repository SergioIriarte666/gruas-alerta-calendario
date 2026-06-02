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
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: any[]) => mockSupabase.from(...args),
  },
}));

describe('useFolioGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('generates folio with correct format SRV-XXXX', async () => {
    const { result } = renderHook(() => useFolioGenerator());

    let generatedFolio: string | null = null;

    await act(async () => {
      generatedFolio = await result.current.generateNextFolio();
    });

    await waitFor(() => {
      expect(generatedFolio).toMatch(/^SRV-\d{4}$/);
    });
  });

  it('uses next number from database', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'company-uuid', next_service_folio_number: 2080 },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { result } = renderHook(() => useFolioGenerator());

    let folio = '';
    await act(async () => {
      folio = await result.current.generateNextFolio();
    });

    expect(folio).toBe('SRV-2080');
  });

  it('pads number to 4 digits', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'company-uuid', next_service_folio_number: 42 },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const { result } = renderHook(() => useFolioGenerator());

    let folio = '';
    await act(async () => {
      folio = await result.current.generateNextFolio();
    });

    expect(folio).toBe('SRV-0042');
  });

  it('increments next number after generation', async () => {
    const updateSpy = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'company-uuid', next_service_folio_number: 1050 },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: updateSpy,
      }),
    });

    const { result } = renderHook(() => useFolioGenerator());

    await act(async () => {
      await result.current.generateNextFolio();
    });

    expect(updateSpy).toHaveBeenCalled();
  });

  it('handles fetch error gracefully and returns fallback', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection error' },
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useFolioGenerator());

    let folio = '';
    await act(async () => {
      folio = await result.current.generateNextFolio();
    });

    expect(folio).toMatch(/^SRV-\d{4}$/);
  });

  it('handles update error gracefully and returns fallback', async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: 'company-uuid', next_service_folio_number: 1050 },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: { message: 'Update error' } }),
      }),
    });

    const { result } = renderHook(() => useFolioGenerator());

    let folio = '';
    await act(async () => {
      folio = await result.current.generateNextFolio();
    });

    expect(folio).toMatch(/^SRV-\d{4}$/);
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
