
import { useMemo, useState, useEffect } from 'react';
import { Invoice, InvoiceStatus } from '@/types';

interface UseInvoiceFormDataProps {
  invoice?: Invoice | null;
  preselectedClosureId?: string | null;
}

export const useInvoiceFormData = ({ invoice, preselectedClosureId }: UseInvoiceFormDataProps) => {
  // Use state to track initialization to ensure it persists across renders correctly
  const [isInitialized, setIsInitialized] = useState(false);
  const [prevClosureId, setPrevClosureId] = useState(preselectedClosureId);
  
  // Memoized form data
  const formData = useMemo(() => {
    // console.log('useInvoiceFormData - Creating form data for invoice:', invoice?.id);
    
    if (invoice) {
      return {
        closureId: invoice.closureId || '',
        issueDate: invoice.issueDate || new Date().toISOString().split('T')[0],
        dueDate: invoice.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: invoice.status || 'draft' as InvoiceStatus,
        paymentTermId: invoice.paymentTermId || undefined,
        paymentDate: invoice.paymentDate || '',
        numeroFiscal: invoice.numeroFiscal || ''
      };
    }
    
    return {
      closureId: preselectedClosureId || '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft' as InvoiceStatus,
      paymentTermId: undefined,
      paymentDate: '',
      numeroFiscal: ''
    };
  }, [invoice, preselectedClosureId]); // Removed specific props to be safe, though invoice?.id was fine

  // Determine if reset is needed
  const shouldReset = useMemo(() => {
    // If not initialized yet, we should reset (initial load)
    if (!isInitialized) return true;
    
    // If preselectedClosureId changed, we should reset
    if (preselectedClosureId !== prevClosureId) return true;
    
    return false;
  }, [isInitialized, preselectedClosureId, prevClosureId]);

  // Effect to update tracking state AFTER render/reset
  useEffect(() => {
    if (shouldReset) {
      setIsInitialized(true);
      setPrevClosureId(preselectedClosureId);
    }
  }, [shouldReset, preselectedClosureId]);

  return {
    formData,
    shouldReset
  };
};
