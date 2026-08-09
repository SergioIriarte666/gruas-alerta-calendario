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
  ): Promise<void> => {
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

  const closeService = async (serviceId: string): Promise<{ success: boolean; message?: string }> => {
    const { data, error } = await supabase.rpc('emergency_close_service', {
      p_service_id: serviceId,
    });
    if (error) throw error;
    const result = data as any;
    if (!result?.success) {
      throw new Error(result?.error || 'Error desconocido al cerrar servicio');
    }
    return result;
  };

  return { searchServiceByFolio, deleteServiceCascade, forceServiceStatus, closeService };
}
