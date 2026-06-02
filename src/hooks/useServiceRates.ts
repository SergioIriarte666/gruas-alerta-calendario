import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ServiceRateWithRelations, ServiceRateFormData } from '@/types/serviceRates';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createLogger } from "@/lib/logger";


const logger = createLogger("useServiceRates");
export const useServiceRates = () => {
  const [rates, setRates] = useState<ServiceRateWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_rates')
        .select(`
          *,
          client:clients!service_rates_client_id_fkey(id, name, department),
          service_type:service_types!service_rates_service_type_id_fkey(id, name),
          creator:profiles!service_rates_created_by_fkey(id, full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRates(data || []);
    } catch (error) {
      logger.error('Error fetching service rates:', error);
      toast.error('Error al cargar las tarifas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const createRate = async (formData: ServiceRateFormData) => {
    try {
      const { data, error } = await supabase
        .from('service_rates')
        .insert({
          client_id: formData.client_id,
          service_type_id: formData.service_type_id || null,
          origin: formData.origin,
          destination: formData.destination || null,
          value: formData.value,
          is_active: formData.is_active,
          notes: formData.notes || null,
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Tarifa creada exitosamente');
      await fetchRates();
      return data;
    } catch (error: any) {
      logger.error('Error creating service rate:', error);
      toast.error(error.message || 'Error al crear la tarifa');
      throw error;
    }
  };

  const updateRate = async (id: string, formData: Partial<ServiceRateFormData>) => {
    try {
      const { data, error } = await supabase
        .from('service_rates')
        .update({
          ...formData,
          service_type_id: formData.service_type_id || null,
          destination: formData.destination || null,
          notes: formData.notes || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Tarifa actualizada exitosamente');
      await fetchRates();
      return data;
    } catch (error: any) {
      logger.error('Error updating service rate:', error);
      toast.error(error.message || 'Error al actualizar la tarifa');
      throw error;
    }
  };

  const deleteRate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('service_rates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Tarifa eliminada exitosamente');
      await fetchRates();
    } catch (error: any) {
      logger.error('Error deleting service rate:', error);
      toast.error(error.message || 'Error al eliminar la tarifa');
      throw error;
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('service_rates')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      toast.success(isActive ? 'Tarifa activada' : 'Tarifa desactivada');
      await fetchRates();
    } catch (error: any) {
      logger.error('Error toggling service rate:', error);
      toast.error(error.message || 'Error al cambiar el estado');
      throw error;
    }
  };

  return {
    rates,
    loading,
    fetchRates,
    createRate,
    updateRate,
    deleteRate,
    toggleActive,
  };
};
