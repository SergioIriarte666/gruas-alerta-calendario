
import { useMemo, useRef } from 'react';
import { Invoice, InvoiceStatus } from '@/types';

interface UseInvoiceFormDataProps {
  invoice?: Invoice | null;
  preselectedClosureId?: string | null;
}

export const useInvoiceFormData = ({ invoice, preselectedClosureId }: UseInvoiceFormDataProps) => {
  const initializedRef = useRef(false);
  const prevClosureIdRef = useRef(preselectedClosureId);
  
  // Memoized form data - only changes when invoice ID or preselectedClosureId changes
  const formData = useMemo(() => {
    console.log('useInvoiceFormData - Creating form data for invoice:', invoice?.id);
    
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
  }, [invoice?.id, preselectedClosureId]);

  // Track if form has been initialized to prevent multiple resets
  const shouldReset = useMemo(() => {
    const shouldResetNow = !initializedRef.current;
    
    // Also reset if preselectedClosureId changes (e.g. navigating between closures)
    const closureIdChanged = preselectedClosureId !== prevClosureIdRef.current;
    
    if (shouldResetNow) {
      initializedRef.current = true;
      prevClosureIdRef.current = preselectedClosureId;
      return true;
    }
    
    if (closureIdChanged) {
      prevClosureIdRef.current = preselectedClosureId;
      return true;
    }
    
    return false;
  }, [invoice?.id, preselectedClosureId]);

  return {
    formData,
    shouldReset
  };
};
