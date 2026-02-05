import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Tipos para duplicados de costos
export interface CostDuplicateResult {
  index: number;
  matchType: 'exact' | 'folio' | 'similar' | null;
  existingCost?: {
    id: string;
    date: string;
    description: string;
    amount: number;
    service_folio?: string;
    created_at: string;
  };
}

// Tipos para duplicados de facturas de proveedores
export interface SupplierInvoiceDuplicateResult {
  index: number;
  matchType: 'exact_folio' | 'similar' | null;
  existingPayment?: {
    id: string;
    reference_number: string;
    supplier_name: string;
    supplier_rut: string;
    amount: number;
    due_date: string;
    created_at: string;
  };
}

// Tipos para duplicados de proveedores
export interface SupplierDuplicateResult {
  index: number;
  matchType: 'exact_rut' | 'exact_name' | 'similar_name' | null;
  existingSupplier?: {
    id: string;
    name: string;
    rut: string;
    email?: string;
    phone?: string;
    is_active: boolean;
    created_at: string;
  };
}

export const useCostDuplicateCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<CostDuplicateResult[]>([]);

  const checkDuplicates = useCallback(async (
    items: Array<{
      date: string;
      amount: number;
      description: string;
      folio?: string;
    }>
  ): Promise<CostDuplicateResult[]> => {
    setIsChecking(true);
    const duplicateResults: CostDuplicateResult[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const { data, error } = await supabase.rpc('check_cost_duplicates', {
          p_date: item.date,
          p_amount: item.amount,
          p_description: item.description,
          p_folio: item.folio || null,
          p_tolerance_percent: 5
        });

        if (error) {
          console.error('Error checking cost duplicates:', error);
          continue;
        }

        if (data && data.length > 0) {
          const firstMatch = data[0];
          duplicateResults.push({
            index: i,
            matchType: firstMatch.match_type as 'exact' | 'folio' | 'similar',
            existingCost: {
              id: firstMatch.id,
              date: firstMatch.date,
              description: firstMatch.description,
              amount: firstMatch.amount,
              service_folio: firstMatch.service_folio,
              created_at: firstMatch.created_at
            }
          });
        }
      }

      setResults(duplicateResults);
      return duplicateResults;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { checkDuplicates, isChecking, results, clearResults };
};

export const useSupplierInvoiceDuplicateCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<SupplierInvoiceDuplicateResult[]>([]);

  const checkDuplicates = useCallback(async (
    items: Array<{
      folio: string;
      supplier_rut?: string;
      amount?: number;
    }>
  ): Promise<SupplierInvoiceDuplicateResult[]> => {
    setIsChecking(true);
    const duplicateResults: SupplierInvoiceDuplicateResult[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const { data, error } = await supabase.rpc('check_supplier_invoice_duplicates', {
          p_folio: item.folio,
          p_supplier_rut: item.supplier_rut || null,
          p_amount: item.amount || null,
          p_tolerance_percent: 5
        });

        if (error) {
          console.error('Error checking invoice duplicates:', error);
          continue;
        }

        if (data && data.length > 0) {
          const firstMatch = data[0];
          duplicateResults.push({
            index: i,
            matchType: firstMatch.match_type as 'exact_folio' | 'similar',
            existingPayment: {
              id: firstMatch.id,
              reference_number: firstMatch.reference_number,
              supplier_name: firstMatch.supplier_name,
              supplier_rut: firstMatch.supplier_rut,
              amount: firstMatch.amount,
              due_date: firstMatch.due_date,
              created_at: firstMatch.created_at
            }
          });
        }
      }

      setResults(duplicateResults);
      return duplicateResults;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { checkDuplicates, isChecking, results, clearResults };
};

export const useSupplierDuplicateCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<SupplierDuplicateResult[]>([]);

  const checkDuplicates = useCallback(async (
    items: Array<{
      rut: string;
      name?: string;
    }>
  ): Promise<SupplierDuplicateResult[]> => {
    setIsChecking(true);
    const duplicateResults: SupplierDuplicateResult[] = [];

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        const { data, error } = await supabase.rpc('check_supplier_duplicates', {
          p_rut: item.rut,
          p_name: item.name || null
        });

        if (error) {
          console.error('Error checking supplier duplicates:', error);
          continue;
        }

        if (data && data.length > 0) {
          const firstMatch = data[0];
          duplicateResults.push({
            index: i,
            matchType: firstMatch.match_type as 'exact_rut' | 'exact_name' | 'similar_name',
            existingSupplier: {
              id: firstMatch.id,
              name: firstMatch.name,
              rut: firstMatch.rut,
              email: firstMatch.email,
              phone: firstMatch.phone,
              is_active: firstMatch.is_active,
              created_at: firstMatch.created_at
            }
          });
        }
      }

      setResults(duplicateResults);
      return duplicateResults;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
  }, []);

  return { checkDuplicates, isChecking, results, clearResults };
};
