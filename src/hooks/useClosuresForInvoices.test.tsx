
/**
 * Test file for useClosuresForInvoices hook.
 * 
 * Note: To run this test, you need to install the following dev dependencies:
 * npm install -D vitest @testing-library/react @testing-library/react-hooks jsdom
 * 
 * Then run with: npx vitest run src/hooks/useClosuresForInvoices.test.tsx
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useClosuresForInvoices } from './useClosuresForInvoices';
import { supabase } from '@/integrations/supabase/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock supabase
jest.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          }))
        })),
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn().mockResolvedValue({ data: [], error: null })
          }))
        }))
      }))
    }))
  }
}));

// Mock toast
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn()
  }
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('useClosuresForInvoices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('should fetch closures successfully', async () => {
    const mockClosures = [
      { id: '1', folio: 'C-001', status: 'closed', created_at: '2023-01-01' }
    ];

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'service_closures') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: mockClosures, error: null })
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null })
      };
    });

    const { result } = renderHook(() => useClosuresForInvoices(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.closures).toHaveLength(1);
    expect(result.current.closures[0].id).toBe('1');
  });

  it('should filter out invoiced closures when includeInvoiced is false', async () => {
    const mockClosures = [
      { id: '1', status: 'closed', invoice_closures: [{ closure_id: '1' }] },
      { id: '2', status: 'closed', invoice_closures: [] }
    ];

    (supabase.from as jest.Mock).mockImplementation((table) => {
      if (table === 'service_closures') {
        return {
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: mockClosures, error: null })
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: [], error: null })
      };
    });

    const { result } = renderHook(() => useClosuresForInvoices(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.closures).toHaveLength(1);
    expect(result.current.closures[0].id).toBe('2');
  });
});
