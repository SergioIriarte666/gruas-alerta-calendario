
import { Invoice } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';

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

// Check if an invoice should be marked as overdue
const shouldBeOverdue = (status: string, dueDate: string): boolean => {
  if (status !== 'sent') return false;
  
  const today = new Date();
  const due = new Date(dueDate);
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  
  return due < today;
};

// Update overdue invoices in database
export const updateOverdueInvoices = async (invoiceIds: string[]): Promise<void> => {
  if (invoiceIds.length === 0) return;
  
  try {
    const { error } = await supabase
      .from('invoices')
      .update({ status: 'overdue' })
      .in('id', invoiceIds);
      
    if (error) {
      console.error('Error updating overdue invoices:', error);
    } else {
      console.log(`Updated ${invoiceIds.length} invoices to overdue status`);
    }
  } catch (error) {
    console.error('Error updating overdue invoices:', error);
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

  const dueDate = safeDate(data.due_date) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Determine correct status, checking for overdue
  let status = (['draft', 'sent', 'paid', 'overdue', 'cancelled'].includes(data.status) 
    ? data.status 
    : 'draft') as 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
    
  // Override status to overdue if conditions are met
  if (shouldBeOverdue(status, dueDate)) {
    status = 'overdue';
  }

  return {
    id: safeString(data.id),
    folio: safeString(data.folio),
    closureId: data.invoice_closures?.[0]?.closure_id || '',
    clientId: safeString(data.client_id),
    client: data.client ? {
      id: data.client.id,
      name: data.client.name,
      rut: data.client.rut,
      email: data.client.email,
      phone: data.client.phone,
      department: data.client.department
    } : undefined,
    issueDate: safeDate(data.issue_date) || new Date().toISOString().split('T')[0],
    dueDate,
    subtotal: safeNumber(data.subtotal),
    vat: safeNumber(data.vat),
    total: safeNumber(data.total),
    status,
    paidAmount: safeNumber(data.paid_amount),
    remainingAmount: safeNumber(data.remaining_amount),
    paymentDate: safeDate(data.payment_date),
    paymentTermId: data.payment_term_id || undefined,
    numeroFiscal: safeString(data.numero_fiscal) || null,
    notes: safeString(data.notes) || undefined,
    createdAt: safeString(data.created_at),
    updatedAt: safeString(data.updated_at),
    createdBy: data.created_by || undefined,
    creatorName: data.creator?.full_name || data.creator?.email || undefined
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
        return getDisplayServiceValue(service);
      }
      return clientAmount;
    }
    
    // Return standard service value
    return getDisplayServiceValue(service);
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
