import { businessClock } from '@/utils/businessClock';
import { supabase } from '@/integrations/supabase/client';
import { ServiceClosure } from '@/types';
import { toast } from 'sonner';
import { formatClosureData, generateClosureFolio } from '@/utils/closureUtils';
import { EXCESS_ROW_SUFFIX, ClosureValueType } from '@/hooks/useServicesForClosures';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useClosureOperations");

interface ClosureServiceEntry {
  serviceId: string;
  valueType: ClosureValueType;
}

// Traduce ids (reales o virtuales `${id}::excess`) a entradas service_id + value_type
export const parseClosureServiceIds = (serviceIds: string[]): ClosureServiceEntry[] =>
  serviceIds.map(raw => {
    const isExcess = raw.endsWith(EXCESS_ROW_SUFFIX);
    return {
      serviceId: isExcess ? raw.slice(0, -EXCESS_ROW_SUFFIX.length) : raw,
      valueType: isExcess ? 'excess' : 'covered',
    };
  });
export const useClosureOperations = () => {

  const createClosure = async (closureData: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      
      
      // Get current user for created_by
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate folio by finding the highest CIE-XXX folio
      // Optimization: Order by created_at instead of folio string to avoid ASCII sorting issues with CIE-1000 vs CIE-999
      const { data: lastClosure } = await supabase
        .from('service_closures')
        .select('folio')
        .like('folio', 'CIE-%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let nextNumber = 1;
      if (lastClosure?.folio) {
        const match = lastClosure.folio.match(/CIE-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const folio = `CIE-${String(nextNumber).padStart(3, '0')}`;
      logger.debug('Generating new closure with folio:', folio);

      // Resolver entradas (covered/excess) y montos por servicio desde BD
      const entries = parseClosureServiceIds(closureData.serviceIds);
      const uniqueServiceIds = [...new Set(entries.map(e => e.serviceId))];

      const servicesById = new Map<string, any>();
      if (uniqueServiceIds.length > 0) {
        const { data: serviceRows, error: servicesError } = await supabase
          .from('services')
          .select('id, value, has_excess, client_covered_amount, excess_amount, custody_total_amount')
          .in('id', uniqueServiceIds);

        if (servicesError) {
          logger.error('Error fetching services for closure amounts:', servicesError);
          throw servicesError;
        }
        (serviceRows || []).forEach(row => servicesById.set(row.id, row));
      }

      const amountForEntry = (entry: { serviceId: string; valueType: 'covered' | 'excess' }): number => {
        const svc = servicesById.get(entry.serviceId);
        if (!svc) return 0;
        if (entry.valueType === 'excess') {
          return Math.round(Number(svc.excess_amount || 0));
        }
        // Cubierto: monto cubierto si hay excedente, si no el valor completo (base + custodia)
        if (svc.has_excess && svc.client_covered_amount != null && Number(svc.client_covered_amount) > 0) {
          return Math.round(Number(svc.client_covered_amount));
        }
        return Math.round(Number(svc.value || 0) + Number(svc.custody_total_amount || 0));
      };

      const closureServicesPayload = entries.map(entry => ({
        service_id: entry.serviceId,
        value_type: entry.valueType,
        amount: amountForEntry(entry),
      }));

      // Total del cierre = suma de los amounts de sus closure_services
      const computedTotal = closureServicesPayload.reduce((sum, cs) => sum + (cs.amount || 0), 0);
      const closureTotal = closureServicesPayload.length > 0
        ? computedTotal
        : Math.round(closureData.total);

      // Un cierre es homogéneo: 'excess' solo si todos sus servicios son excedentes
      const closureType: 'covered' | 'excess' =
        entries.length > 0 && entries.every(e => e.valueType === 'excess') ? 'excess' : 'covered';

      const { data, error } = await supabase
        .from('service_closures')
        .insert({
          folio,
          date_from: closureData.dateRange.from,
          date_to: closureData.dateRange.to,
          client_id: closureData.clientId || null,
          total: closureTotal,
          status: closureData.status,
          purchase_order: closureData.purchaseOrder || null,
          closure_type: closureType,
          created_by: user?.id || null
        })
        .select()
        .single();

      if (error) {
        logger.error('Supabase error creating closure:', error);
        throw error;
      }

      logger.debug('Closure created successfully, ID:', data.id);

      // Create closure-service relationships
      if (closureServicesPayload.length > 0) {
        logger.debug(`Linking ${closureServicesPayload.length} services to closure...`);
        const closureServices = closureServicesPayload.map(cs => ({
          closure_id: data.id,
          ...cs
        }));

        // Batch inserts to avoid payload limits or timeouts
        const BATCH_SIZE = 50;
        for (let i = 0; i < closureServices.length; i += BATCH_SIZE) {
          const batch = closureServices.slice(i, i + BATCH_SIZE);
          const { error: relationError } = await supabase
            .from('closure_services')
            .insert(batch);

          if (relationError) {
            logger.error('Error creating closure-service relationships (batch):', relationError);
            if ((relationError as any).code === '23505') {
              toast.error('Este servicio ya está incluido en otro cierre con el mismo tipo de monto');
            }
            // Evitar cierre huérfano sin servicios vinculados
            await supabase.from('service_closures').delete().eq('id', data.id);
            throw relationError;
          }
        }
        logger.debug('Services linked successfully');
      }

      const newClosure: ServiceClosure = formatClosureData(data);
      newClosure.serviceIds = closureData.serviceIds;
      
      toast.success("Cierre creado", {
        description: `Cierre ${folio} creado exitosamente.`,
      });

      return newClosure;
    } catch (error: any) {
      logger.error('Error creating closure:', error);
      toast.error("Error", {
        description: "No se pudo crear el cierre.",
      });
      throw error;
    }
  };

  const updateClosure = async (id: string, closureData: Partial<ServiceClosure>) => {
    try {
      const updateData: any = {};
      
      if (closureData.dateRange) {
        updateData.date_from = closureData.dateRange.from;
        updateData.date_to = closureData.dateRange.to;
      }
      if (closureData.clientId !== undefined) {
        updateData.client_id = closureData.clientId;
      }
      if (closureData.total !== undefined) {
        updateData.total = closureData.total;
      }
      if (closureData.status !== undefined) {
        updateData.status = closureData.status;
      }
      if (closureData.purchaseOrder !== undefined) {
        updateData.purchase_order = closureData.purchaseOrder;
      }

      const { error } = await supabase
        .from('service_closures')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      toast.success("Cierre actualizado", {
        description: "El cierre ha sido actualizado exitosamente.",
      });

      return { ...closureData, updatedAt: businessClock.nowISO() };
    } catch (error: any) {
      logger.error('Error updating closure:', error);
      toast.error("Error", {
        description: "No se pudo actualizar el cierre.",
      });
      throw error;
    }
  };

  const deleteClosure = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_closures')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success("Cierre eliminado", {
        description: "El cierre ha sido eliminado exitosamente.",
      });
    } catch (error: any) {
      logger.error('Error deleting closure:', error);
      toast.error("Error", {
        description: "No se pudo eliminar el cierre.",
      });
      throw error;
    }
  };

  const closeClosure = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_closures')
        .update({ status: 'closed' })
        .eq('id', id);

      if (error) throw error;

      toast.success("Cierre procesado", {
        description: "El cierre ha sido procesado exitosamente.",
      });

      return { status: 'closed' as const, updatedAt: businessClock.nowISO() };
    } catch (error: any) {
      logger.error('Error closing closure:', error);
      toast.error("Error", {
        description: "No se pudo procesar el cierre.",
      });
      throw error;
    }
  };

  return {
    createClosure,
    updateClosure,
    deleteClosure,
    closeClosure
  };
};