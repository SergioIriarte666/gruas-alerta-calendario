import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiberationSearchResult {
  type: 'invoice' | 'closure';
  id: string;
  folio: string;
  clientName: string;
  clientId: string | null;
  total: number;
  status: string;
  services: Array<{
    id: string;
    folio: string;
    status: string;
    total: number;
  }>;
  // For invoices: linked closures
  linkedClosures: Array<{
    id: string;
    folio: string;
    status: string;
  }>;
  // For closures: linked invoices
  linkedInvoices: Array<{
    id: string;
    folio: string;
  }>;
}

export const useServiceLiberation = () => {
  const [searching, setSearching] = useState(false);
  const [liberating, setLiberating] = useState(false);
  const [result, setResult] = useState<LiberationSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchByFolio = async (folio: string) => {
    setSearching(true);
    setError(null);
    setResult(null);

    try {
      const trimmed = folio.trim().toUpperCase();

      if (trimmed.startsWith('FACT-')) {
        await searchInvoice(trimmed);
      } else if (trimmed.startsWith('CIE-')) {
        await searchClosure(trimmed);
      } else {
        setError('El folio debe comenzar con FACT- o CIE-');
      }
    } catch (e: any) {
      setError(e.message || 'Error inesperado al buscar');
    } finally {
      setSearching(false);
    }
  };

  const searchInvoice = async (folio: string) => {
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, folio, total, status, client_id, client:clients!invoices_client_id_fkey(name)')
      .eq('folio', folio)
      .maybeSingle();

    if (invErr) throw invErr;
    if (!invoice) { setError(`No se encontró factura con folio ${folio}`); return; }

    // Get linked services
    const { data: invServices } = await supabase
      .from('invoice_services')
      .select('service_id')
      .eq('invoice_id', invoice.id);

    const serviceIds = (invServices || []).map(s => s.service_id);
    let services: LiberationSearchResult['services'] = [];

    if (serviceIds.length > 0) {
      const { data: svcData } = await supabase
        .from('services')
        .select('id, folio, status, value')
        .in('id', serviceIds);
      services = (svcData || []).map(s => ({
        id: s.id,
        folio: s.folio || 'Sin folio',
        status: s.status || 'unknown',
        total: s.value || 0,
      }));
    }

    // Get linked closures
    const { data: invClosures } = await supabase
      .from('invoice_closures')
      .select('closure_id')
      .eq('invoice_id', invoice.id);

    const closureIds = (invClosures || []).map(c => c.closure_id);
    let linkedClosures: LiberationSearchResult['linkedClosures'] = [];

    if (closureIds.length > 0) {
      const { data: closureData } = await supabase
        .from('service_closures')
        .select('id, folio, status')
        .in('id', closureIds);
      linkedClosures = (closureData || []).map(c => ({
        id: c.id,
        folio: c.folio,
        status: c.status || 'unknown',
      }));
    }

    const clientObj = invoice.client as any;
    setResult({
      type: 'invoice',
      id: invoice.id,
      folio: invoice.folio,
      clientName: clientObj?.name || 'Cliente desconocido',
      clientId: invoice.client_id,
      total: invoice.total,
      status: invoice.status || 'unknown',
      services,
      linkedClosures,
      linkedInvoices: [],
    });
  };

  const searchClosure = async (folio: string) => {
    const { data: closure, error: clErr } = await supabase
      .from('service_closures')
      .select('id, folio, total, status, client_id, client:clients!service_closures_client_id_fkey(name)')
      .eq('folio', folio)
      .maybeSingle();

    if (clErr) throw clErr;
    if (!closure) { setError(`No se encontró cierre con folio ${folio}`); return; }

    // Get linked services
    const { data: clServices } = await supabase
      .from('closure_services')
      .select('service_id')
      .eq('closure_id', closure.id);

    const serviceIds = (clServices || []).map(s => s.service_id);
    let services: LiberationSearchResult['services'] = [];

    if (serviceIds.length > 0) {
      const { data: svcData } = await supabase
        .from('services')
        .select('id, folio, status, value')
        .in('id', serviceIds);
      services = (svcData || []).map(s => ({
        id: s.id,
        folio: s.folio || 'Sin folio',
        status: s.status || 'unknown',
        total: s.value || 0,
      }));
    }

    // Get linked invoices
    const { data: invClosures } = await supabase
      .from('invoice_closures')
      .select('invoice_id')
      .eq('closure_id', closure.id);

    const invoiceIds = (invClosures || []).map(i => i.invoice_id);
    let linkedInvoices: LiberationSearchResult['linkedInvoices'] = [];

    if (invoiceIds.length > 0) {
      const { data: invData } = await supabase
        .from('invoices')
        .select('id, folio')
        .in('id', invoiceIds);
      linkedInvoices = (invData || []).map(i => ({
        id: i.id,
        folio: i.folio,
      }));
    }

    const clientObj = closure.client as any;
    setResult({
      type: 'closure',
      id: closure.id,
      folio: closure.folio,
      clientName: clientObj?.name || 'Cliente desconocido',
      clientId: closure.client_id,
      total: closure.total,
      status: closure.status || 'unknown',
      services,
      linkedClosures: [],
      linkedInvoices,
    });
  };

  const liberateInvoice = async (invoiceId: string, serviceIds: string[], closureIds: string[]) => {
    setLiberating(true);
    try {
      // Recolectar servicios de los cierres vinculados ANTES de borrar relaciones,
      // para garantizar que ningún servicio quede en estado 'invoiced' huérfano.
      const allServiceIds = new Set<string>(serviceIds);
      if (closureIds.length > 0) {
        const { data: clSvcRows } = await supabase
          .from('closure_services')
          .select('service_id')
          .in('closure_id', closureIds);
        (clSvcRows || []).forEach((r: any) => {
          if (r.service_id) allServiceIds.add(r.service_id);
        });
      }

      // 1. Delete invoice_services
      const { error: e1 } = await supabase
        .from('invoice_services')
        .delete()
        .eq('invoice_id', invoiceId);
      if (e1) throw e1;

      // 2. Delete invoice_closures
      const { error: e2 } = await supabase
        .from('invoice_closures')
        .delete()
        .eq('invoice_id', invoiceId);
      if (e2) throw e2;

      // 3. Eliminar en cascada los cierres vinculados (si no están compartidos con otra factura)
      const deletedClosureIds: string[] = [];
      const keptClosureIds: string[] = [];
      if (closureIds.length > 0) {
        // Detectar cierres aún vinculados a otras facturas
        const { data: stillLinked } = await supabase
          .from('invoice_closures')
          .select('closure_id')
          .in('closure_id', closureIds);
        const sharedSet = new Set((stillLinked || []).map((r: any) => r.closure_id));

        for (const cid of closureIds) {
          if (sharedSet.has(cid)) {
            keptClosureIds.push(cid);
          } else {
            deletedClosureIds.push(cid);
          }
        }

        if (deletedClosureIds.length > 0) {
          // 3a. Borrar closure_services
          const { error: e3a } = await supabase
            .from('closure_services')
            .delete()
            .in('closure_id', deletedClosureIds);
          if (e3a) throw e3a;

          // 3b. Borrar service_closures (padres)
          const { error: e3b } = await supabase
            .from('service_closures')
            .delete()
            .in('id', deletedClosureIds);
          if (e3b) throw e3b;
        }

        if (keptClosureIds.length > 0) {
          // Cierres compartidos: solo revertir a 'closed' (fallback seguro)
          const { error: e3c } = await supabase
            .from('service_closures')
            .update({ status: 'closed', updated_at: new Date().toISOString() })
            .in('id', keptClosureIds);
          if (e3c) throw e3c;
        }
      }

      // 4. Delete the invoice
      const { error: e4 } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);
      if (e4) throw e4;

      // 5. Reset services (factura ∪ servicios de cierres eliminados)
      const idsToReset = Array.from(allServiceIds);
      if (idsToReset.length > 0) {
        const { error: e5 } = await supabase
          .from('services')
          .update({ 
            status: 'with_purchase_order', 
            invoice_folio: null,
            invoice_numero_fiscal: null,
            updated_at: new Date().toISOString() 
          })
          .in('id', idsToReset);
        if (e5) throw e5;
      }

      setResult(null);
      return { success: true, deletedClosureIds, keptClosureIds };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      setLiberating(false);
    }
  };

  const liberateClosure = async (closureId: string, serviceIds: string[]) => {
    setLiberating(true);
    try {
      // 1. Delete closure_services
      const { error: e1 } = await supabase
        .from('closure_services')
        .delete()
        .eq('closure_id', closureId);
      if (e1) throw e1;

      // 2. Delete invoice_closures if any
      const { error: e2 } = await supabase
        .from('invoice_closures')
        .delete()
        .eq('closure_id', closureId);
      if (e2) throw e2;

      // 3. Delete the closure
      const { error: e3 } = await supabase
        .from('service_closures')
        .delete()
        .eq('id', closureId);
      if (e3) throw e3;

      // 4. Reset services
      if (serviceIds.length > 0) {
        const { error: e4 } = await supabase
          .from('services')
          .update({ 
            status: 'with_purchase_order', 
            invoice_folio: null,
            invoice_numero_fiscal: null,
            updated_at: new Date().toISOString() 
          })
          .in('id', serviceIds);
        if (e4) throw e4;
      }

      setResult(null);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    } finally {
      setLiberating(false);
    }
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  return {
    searching,
    liberating,
    result,
    error,
    searchByFolio,
    liberateInvoice,
    liberateClosure,
    clearResult,
  };
};
