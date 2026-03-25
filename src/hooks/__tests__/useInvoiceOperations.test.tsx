import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useInvoiceOperations } from '../invoices/useInvoiceOperations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('useInvoiceOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateInvoice', () => {
    it('successfully updates invoice notes (audit log)', async () => {
      const mockInvoiceId = 'invoice-123';
      const mockUpdateData = {
        notes: 'Updated notes with audit log',
      };

      // Mock current invoice fetch (step 1 in hook)
      const mockSelectBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockInvoiceId, numero_fiscal: '100', status: 'draft' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };

      // Mock update operation (step 4 in hook)
      const mockUpdateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockInvoiceId, ...mockUpdateData },
          error: null,
        }),
      };

      // Mock invoice_closures fetch
      const mockClosureBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { closure_id: 'closure-123' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { closure_id: 'closure-123' },
          error: null,
        }),
      };

      // Setup supabase mock chain
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'invoices') {
          // Return select builder for first call (fetch current), update builder for second (update)
          // This is a bit tricky with simple mocks, so we'll make it return a flexible object
          // or check the calls.
          // A simpler way is to have the mock return a fresh builder each time, 
          // but we need to control the output based on the operation.
          
          // Let's make a smart mock that checks the method called later
          return {
            select: (cols: string) => {
              if (cols === '*') return mockSelectBuilder.select(cols); // Fetch current
              return mockSelectBuilder.select(cols); // Fallback
            },
            update: (data: any) => mockUpdateBuilder.update(data),
          };
        }
        if (table === 'invoice_closures') {
          return mockClosureBuilder;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        };
      });

      const { result } = renderHook(() => useInvoiceOperations());

      await act(async () => {
        await result.current.updateInvoice(mockInvoiceId, mockUpdateData);
      });

      // Verify update was called with correct data
      expect(mockUpdateBuilder.update).toHaveBeenCalledWith(expect.objectContaining({
        notes: 'Updated notes with audit log',
      }));

      // Verify success toast
      expect(toast.success).toHaveBeenCalledWith('Factura actualizada', expect.any(Object));
    });

    it('handles errors during update', async () => {
      const mockInvoiceId = 'invoice-123';
      const mockUpdateData = { status: 'paid' as const };

      // Mock current invoice fetch success
      const mockSelectBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: mockInvoiceId, status: 'sent' },
          error: null,
        }),
      };
      
      const mockClosureBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { closure_id: 'closure-123' },
          error: null,
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { closure_id: 'closure-123' },
          error: null,
        }),
      };

      // Mock update failure
      const mockUpdateBuilder = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      };

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'invoices') {
          return {
            select: () => mockSelectBuilder.select(),
            update: (data: any) => mockUpdateBuilder.update(data),
          };
        }
        if (table === 'invoice_closures') return mockClosureBuilder;
        return {};
      });

      const { result } = renderHook(() => useInvoiceOperations());

      await expect(
        result.current.updateInvoice(mockInvoiceId, mockUpdateData)
      ).rejects.toThrow('Error actualizando factura: Database error');

      expect(toast.error).toHaveBeenCalledWith('Error al actualizar factura', expect.any(Object));
    });
  });
});
