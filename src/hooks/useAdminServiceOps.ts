import { businessClock } from '@/utils/businessClock';
import { supabase } from '@/integrations/supabase/client';
import { ServiceDeleteBlockedError } from '@/hooks/services/useServiceManager';

interface ServiceInfo {
  id: string;
  folio: string;
  status: string;
  value: number;
  clientName: string;
  clientId: string;
  invoiceFolio: string | null;
}

interface ServiceDependencies {
  costs: number;
  inspections: number;
  calendarEvents: number;
  closureLinks: number;
  invoiceLinks: number;
}

interface ServiceWithDeps extends ServiceInfo {
  dependencies: ServiceDependencies;
  hasInvoice: boolean;
  hasClosure: boolean;
}

export function useAdminServiceOps() {
  const searchServiceByFolio = async (folio: string): Promise<ServiceWithDeps | null> => {
    const { data: svc, error: svcErr } = await supabase
      .from('services')
      .select('id, folio, status, value, invoice_folio, client:clients!services_client_id_fkey(id, name)')
      .eq('folio', folio.toUpperCase())
      .maybeSingle();

    if (svcErr) throw svcErr;
    if (!svc) return null;

    const clientObj = svc.client as { id?: string; name?: string } | null;

    const [costsRes, inspRes, calRes, closRes, invRes] = await Promise.all([
      supabase.from('costs').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
      supabase.from('inspections').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
      supabase.from('calendar_events').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
      supabase.from('closure_services').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
      supabase.from('invoice_services').select('id', { count: 'exact', head: true }).eq('service_id', svc.id),
    ]);

    return {
      id: svc.id,
      folio: svc.folio || folio,
      status: svc.status || 'unknown',
      value: svc.value || 0,
      clientName: clientObj?.name || 'Sin cliente',
      clientId: clientObj?.id || '',
      invoiceFolio: svc.invoice_folio,
      hasInvoice: (invRes.count || 0) > 0,
      hasClosure: (closRes.count || 0) > 0,
      dependencies: {
        costs: costsRes.count || 0,
        inspections: inspRes.count || 0,
        calendarEvents: calRes.count || 0,
        closureLinks: closRes.count || 0,
        invoiceLinks: invRes.count || 0,
      },
    };
  };

  const deleteServiceCascade = async (serviceId: string): Promise<void> => {
    // Misma guarda que el flujo normal: ser admin no vuelve recuperable una
    // inspección firmada ni una sesión de GPS.
    const { data: blockReason, error: guardError } = await supabase.rpc(
      'service_delete_block_reason',
      { p_service_id: serviceId },
    );
    if (guardError) throw guardError;
    if (blockReason) {
      throw new ServiceDeleteBlockedError(blockReason);
    }

    const { error } = await supabase.rpc('delete_service_cascade', { p_service_id: serviceId });
    if (error) throw error;
  };

  const forceServiceStatus = async (
    serviceId: string,
    targetStatus: string,
    /** Folio en pantalla: obligatorio para el destino 'completed'. */
    folio?: string,
    /** Estado actual, para distinguir un cierre de una reversión de factura. */
    currentStatus?: string,
  ): Promise<void> => {
    // Cerrar un servicio tiene una sola vía: complete_service, que valida folio,
    // estampa end_time y dispara los efectos de cierre (revocar links de
    // tracking, cerrar sesiones GPS y eventos de parada). Lo único que sigue
    // pasando por UPDATE directo es la reversión de un servicio ya facturado,
    // que es la razón de existir de esta herramienta y que complete_service
    // rechaza por diseño.
    const isInvoiceReversal = currentStatus === 'invoiced' || currentStatus === 'partially_invoiced';
    if (targetStatus === 'completed' && folio && !isInvoiceReversal) {
      const { error } = await supabase.rpc('complete_service', {
        p_service_id: serviceId,
        p_folio_confirmation: folio,
      });
      if (error) throw error;
      return;
    }

    const updateData: Record<string, unknown> = {
      status: targetStatus,
      updated_at: businessClock.nowISO(),
    };

    if (['pending', 'in_progress', 'completed', 'with_purchase_order', 'quoted', 'purchase_order_pending'].includes(targetStatus)) {
      updateData.invoice_folio = null;
    }

    const { error } = await supabase
      .from('services')
      .update(updateData)
      .eq('id', serviceId);

    if (error) throw error;
  };

  /**
   * Cierre administrativo. Pasa por complete_service igual que el operador en
   * terreno: el admin puede cerrar desde cualquier estado no facturado, pero el
   * folio de la pantalla viaja siempre para que el servidor confirme que es
   * este servicio y no otro.
   */
  const closeService = async (
    serviceId: string,
    folio: string,
  ): Promise<{ success: boolean; message?: string }> => {
    const { data, error } = await supabase.rpc('complete_service', {
      p_service_id: serviceId,
      p_folio_confirmation: folio,
    });
    if (error) throw error;
    return {
      success: true,
      message: data === 'already_completed'
        ? 'El servicio ya estaba cerrado'
        : 'El servicio se ha cerrado exitosamente',
    };
  };

  return { searchServiceByFolio, deleteServiceCascade, forceServiceStatus, closeService };
}
