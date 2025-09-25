import { useState, useEffect } from 'react';
import { Service, ServiceClosure } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { useServiceTransformer } from '../services/useServiceTransformer';
import { calculateClosureTotal } from '@/utils/serviceValueCalculations';

interface UseEditClosureProps {
  closure: ServiceClosure;
  onUpdate: (updates: Partial<ServiceClosure>) => void;
}

export const useEditClosure = ({ closure, onUpdate }: UseEditClosureProps) => {
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [currentServices, setCurrentServices] = useState<Service[]>([]);
  const [pendingServices, setPendingServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const { transformRawServiceData } = useServiceTransformer();
  const { toast } = useToast();

  const fetchServicesForEdit = async () => {
    try {
      setLoading(true);
      console.log('Fetching services for closure edit:', closure.id);

      // Get current services in this closure
      const { data: closureServices, error: closureError } = await supabase
        .from('closure_services')
        .select(`
          service_id,
          services!inner(
            *,
            client:clients!services_client_id_fkey(id, name, rut, phone, email, address, is_active),
            third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, is_active),
            cranes!inner(id, license_plate, brand, model, type, is_active),
            operators!inner(id, name, rut, phone, license_number, is_active),
            service_types!inner(id, name, description, is_active)
          )
        `)
        .eq('closure_id', closure.id);

      if (closureError) {
        console.error('Error fetching current closure services:', closureError);
        throw closureError;
      }

      // Get all completed services in the date range
      let completedQuery = supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, is_active),
          third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, is_active),
          cranes!inner(id, license_plate, brand, model, type, is_active),
          operators!inner(id, name, rut, phone, license_number, is_active),
          service_types!inner(id, name, description, is_active)
        `)
        .eq('status', 'completed')
        .gte('service_date', closure.dateRange.from)
        .lte('service_date', closure.dateRange.to)
        .order('folio', { ascending: true });

      // Filter by client if specified
      if (closure.clientId) {
        completedQuery = completedQuery.eq('client_id', closure.clientId);
      }

      const { data: completedServicesData, error: completedError } = await completedQuery;

      if (completedError) {
        console.error('Error fetching completed services:', completedError);
        throw completedError;
      }

      // Get pending services in the date range
      let pendingQuery = supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, is_active),
          third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, is_active),
          cranes!inner(id, license_plate, brand, model, type, is_active),
          operators!inner(id, name, rut, phone, license_number, is_active),
          service_types!inner(id, name, description, is_active)
        `)
        .eq('status', 'pending')
        .gte('service_date', closure.dateRange.from)
        .lte('service_date', closure.dateRange.to)
        .order('folio', { ascending: true });

      if (closure.clientId) {
        pendingQuery = pendingQuery.eq('client_id', closure.clientId);
      }

      const { data: pendingServicesData, error: pendingError } = await pendingQuery;

      if (pendingError) {
        console.error('Error fetching pending services:', pendingError);
        throw pendingError;
      }

      // Get all service IDs that are already in closures (excluding current closure)
      const { data: allClosureServices, error: allClosureError } = await supabase
        .from('closure_services')
        .select('service_id')
        .neq('closure_id', closure.id);

      if (allClosureError) {
        console.error('Error fetching all closure services:', allClosureError);
      }

      const usedServiceIds = new Set(allClosureServices?.map(cs => cs.service_id) || []);

      // Transform current services
      const currentServicesRaw = closureServices?.map(cs => cs.services) || [];
      const transformedCurrentServices = transformRawServiceData(currentServicesRaw);
      setCurrentServices(transformedCurrentServices);
      setSelectedServiceIds(transformedCurrentServices.map(s => s.id));

      // Filter available services (exclude already used ones and current ones)
      const currentServiceIds = new Set(transformedCurrentServices.map(s => s.id));
      const availableCompletedServices = (completedServicesData || []).filter(service => 
        !usedServiceIds.has(service.id) && !currentServiceIds.has(service.id)
      );

      const transformedAvailableServices = transformRawServiceData(availableCompletedServices);
      setAvailableServices(transformedAvailableServices);

      // Transform pending services
      const transformedPendingServices = transformRawServiceData(pendingServicesData || []);
      setPendingServices(transformedPendingServices);

      console.log('Services loaded for edit:', {
        current: transformedCurrentServices.length,
        available: transformedAvailableServices.length,
        pending: transformedPendingServices.length
      });

    } catch (error: any) {
      console.error('Error fetching services for edit:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron cargar los servicios para edición.",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateClosureServices = async (newServiceIds: string[]) => {
    try {
      console.log('Updating closure services:', { closure: closure.id, newServiceIds });

      // Delete existing relationships
      const { error: deleteError } = await supabase
        .from('closure_services')
        .delete()
        .eq('closure_id', closure.id);

      if (deleteError) {
        console.error('Error deleting existing closure services:', deleteError);
        throw deleteError;
      }

      // Insert new relationships
      if (newServiceIds.length > 0) {
        const closureServices = newServiceIds.map(serviceId => ({
          closure_id: closure.id,
          service_id: serviceId
        }));

        const { error: insertError } = await supabase
          .from('closure_services')
          .insert(closureServices);

        if (insertError) {
          console.error('Error inserting new closure services:', insertError);
          throw insertError;
        }
      }

      // Calculate new total using closure-specific value calculation (includes excess)
      const allServices = [...currentServices, ...availableServices];
      const selectedServices = allServices.filter(s => newServiceIds.includes(s.id));
      const newTotal = calculateClosureTotal(selectedServices);

      // Update closure total
      const { error: updateError } = await supabase
        .from('service_closures')
        .update({ 
          total: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', closure.id);

      if (updateError) {
        console.error('Error updating closure total:', updateError);
        throw updateError;
      }

      // Update local state
      setSelectedServiceIds(newServiceIds);
      const updatedCurrentServices = allServices.filter(s => newServiceIds.includes(s.id));
      setCurrentServices(updatedCurrentServices);

      // Notify parent component
      onUpdate({
        serviceIds: newServiceIds,
        total: newTotal,
        updatedAt: new Date().toISOString()
      });

      toast({
        type: "success",
        title: "Servicios actualizados",
        description: "Los servicios del cierre han sido actualizados exitosamente.",
      });

      // Refresh available services
      await fetchServicesForEdit();

    } catch (error: any) {
      console.error('Error updating closure services:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron actualizar los servicios del cierre.",
      });
    }
  };

  const completeService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .eq('id', serviceId);

      if (error) throw error;

      await fetchServicesForEdit();
      
      toast({
        type: "success",
        title: "Servicio completado",
        description: "El servicio ha sido marcado como completado.",
      });
    } catch (error: any) {
      console.error('Error completing service:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo completar el servicio.",
      });
    }
  };

  const completeMultipleServices = async (serviceIds: string[]) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .in('id', serviceIds);

      if (error) throw error;

      await fetchServicesForEdit();
      
      toast({
        type: "success",
        title: "Servicios completados",
        description: `${serviceIds.length} servicio(s) han sido marcados como completados.`,
      });
    } catch (error: any) {
      console.error('Error completing services:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudieron completar los servicios.",
      });
    }
  };

  useEffect(() => {
    fetchServicesForEdit();
  }, [closure.dateRange.from, closure.dateRange.to, closure.clientId]);

  return {
    availableServices,
    currentServices,
    pendingServices,
    loading,
    selectedServiceIds,
    updateClosureServices,
    completeService,
    completeMultipleServices,
    refetch: fetchServicesForEdit
  };
};