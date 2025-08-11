
import { Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';

// Safe number conversion with fallback
const safeNumber = (value: any, fallback: number = 0): number => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// Safe string extraction with validation
const safeString = (value: any, fallback: string = ''): string => {
  return value != null ? String(value) : fallback;
};

// Safe date formatting with validation
const safeDate = (value: any): string | null => {
  if (!value) return null;
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  } catch {
    return null;
  }
};

export const formatInvoiceData = (data: any): Invoice => {
  // Validate required data
  if (!data || typeof data !== 'object') {
    throw new Error('Datos de factura inválidos o faltantes');
  }

  // Validate required fields
  if (!data.id) throw new Error('ID de factura es requerido');
  if (!data.folio) throw new Error('Folio de factura es requerido');
  if (!data.client_id) throw new Error('ID de cliente es requerido');

  return {
    id: safeString(data.id),
    folio: safeString(data.folio),
    closureId: data.invoice_closures?.[0]?.closure_id || '',
    clientId: safeString(data.client_id),
    issueDate: safeDate(data.issue_date) || new Date().toISOString().split('T')[0],
    dueDate: safeDate(data.due_date) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subtotal: safeNumber(data.subtotal),
    vat: safeNumber(data.vat),
    total: safeNumber(data.total),
    status: (['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(data.status) 
      ? data.status 
      : 'draft') as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled',
    paymentDate: safeDate(data.payment_date),
    numeroFiscal: safeString(data.numero_fiscal) || null,
    createdAt: safeString(data.created_at),
    updatedAt: safeString(data.updated_at)
  };
};

export const generateInvoiceFolio = async (): Promise<string> => {
  try {
    // Validate connection to Supabase before attempting RPC call
    const { data, error } = await supabase.rpc('preview_next_invoice_folio');
    
    if (error) {
      console.error('Error in generateInvoiceFolio RPC call:', error);
      throw new Error(`Error generando folio: ${error.message}`);
    }
    
    if (!data) {
      throw new Error('No se recibió folio del servidor');
    }
    
    // Validate folio format
    if (typeof data !== 'string' || data.length === 0) {
      throw new Error('Formato de folio inválido recibido del servidor');
    }
    
    console.log('✅ Generated invoice folio:', data);
    return data;
  } catch (error: any) {
    console.error('❌ Error generating invoice folio:', error);
    
    // Provide specific error messages
    if (error.message?.includes('network')) {
      throw new Error('Error de conexión al generar folio. Verifique su conexión a internet.');
    } else if (error.message?.includes('permission')) {
      throw new Error('Permisos insuficientes para generar folio de factura.');
    } else {
      throw new Error(error.message || 'Error desconocido al generar folio de factura');
    }
  }
};

// Enhanced billable amount calculation with validation
export const getBillableAmount = (service: any): number => {
  // Validate input
  if (!service || typeof service !== 'object') {
    console.warn('Invalid service object provided to getBillableAmount');
    return 0;
  }

  try {
    // Check if service has excess and client covered amount is defined
    if (service.has_excess === true && service.client_covered_amount !== undefined && service.client_covered_amount !== null) {
      const clientAmount = safeNumber(service.client_covered_amount);
      if (clientAmount < 0) {
        console.warn('Negative client covered amount detected, using service value instead');
        return safeNumber(service.value);
      }
      return clientAmount;
    }
    
    // Return standard service value
    return safeNumber(service.value);
  } catch (error) {
    console.error('Error calculating billable amount:', error);
    return 0;
  }
};

// Additional utility functions for invoice operations
export const validateInvoiceData = (invoiceData: Partial<Invoice>): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (invoiceData.issueDate && invoiceData.dueDate) {
    const issueDate = new Date(invoiceData.issueDate);
    const dueDate = new Date(invoiceData.dueDate);
    
    if (isNaN(issueDate.getTime())) errors.push('Fecha de emisión inválida');
    if (isNaN(dueDate.getTime())) errors.push('Fecha de vencimiento inválida');
    if (dueDate <= issueDate) errors.push('La fecha de vencimiento debe ser posterior a la fecha de emisión');
  }

  if (invoiceData.subtotal !== undefined && invoiceData.subtotal < 0) {
    errors.push('El subtotal no puede ser negativo');
  }

  if (invoiceData.vat !== undefined && invoiceData.vat < 0) {
    errors.push('El IVA no puede ser negativo');
  }

  if (invoiceData.total !== undefined && invoiceData.total < 0) {
    errors.push('El total no puede ser negativo');
  }

  if (invoiceData.numeroFiscal && !/^\d+$/.test(invoiceData.numeroFiscal)) {
    errors.push('El número fiscal debe contener solo números');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};
