import { supabase } from '@/integrations/supabase/client';
import { ServiceClosure } from '@/types';
import { toast } from 'sonner';
import { formatClosureData, generateClosureFolio } from '@/utils/closureUtils';

export const useClosureOperations = () => {

  const createClosure = async (closureData: Omit<ServiceClosure, 'id' | 'folio' | 'createdAt' | 'updatedAt'>) => {
    try {
      console.log('Creating closure with data:', closureData);
      
      // Generate folio by finding the highest CIE-XXX folio
      const { data: lastClosure } = await supabase
        .from('service_closures')
        .select('folio')
        .like('folio', 'CIE-%')
        .order('folio', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let nextNumber = 1;
      if (lastClosure?.folio) {
        const match = lastClosure.folio.match(/CIE-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      console.log('Last CIE closure found:', lastClosure?.folio, '-> Next number:', nextNumber);
      
      const folio = `CIE-${String(nextNumber).padStart(3, '0')}`;

      const { data, error } = await supabase
        .from('service_closures')
        .insert({
          folio,
          date_from: closureData.dateRange.from,
          date_to: closureData.dateRange.to,
          client_id: closureData.clientId || null,
          total: closureData.total,
          status: closureData.status,
          purchase_order: closureData.purchaseOrder || null
        })
        .select()
        .single();

      if (error) throw error;

      console.log('Created closure:', data);

      // Create closure-service relationships
      if (closureData.serviceIds.length > 0) {
        const closureServices = closureData.serviceIds.map(serviceId => ({
          closure_id: data.id,
          service_id: serviceId
        }));

        const { error: relationError } = await supabase
          .from('closure_services')
          .insert(closureServices);

        if (relationError) {
          console.error('Error creating closure-service relationships:', relationError);
          throw relationError;
        }
      }

      const newClosure: ServiceClosure = formatClosureData(data);
      newClosure.serviceIds = closureData.serviceIds;
      
      toast.success("Cierre creado", {
        description: `Cierre ${folio} creado exitosamente.`,
      });

      return newClosure;
    } catch (error: any) {
      console.error('Error creating closure:', error);
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

      return { ...closureData, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error updating closure:', error);
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
      console.error('Error deleting closure:', error);
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

      return { status: 'closed' as const, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('Error closing closure:', error);
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