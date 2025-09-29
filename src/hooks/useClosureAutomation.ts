import { useState, useEffect, useCallback } from 'react';
import { Service, Client } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { useServiceTransformer } from './services/useServiceTransformer';
import { startOfMonth, endOfMonth } from 'date-fns';

interface ServiceIssue {
  type: 'warning' | 'error';
  message: string;
  field: string;
}

interface ServiceWithIssues extends Service {
  issues: ServiceIssue[];
  canInclude: boolean;
}

interface ClientClosureData {
  client: Client;
  services: ServiceWithIssues[];
  completedServices: number;
  pendingServices: number;
  totalAmount: number;
  hasIssues: boolean;
  issues: string[];
}

export const useClosureAutomation = () => {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [clientsData, setClientsData] = useState<ClientClosureData[]>([]);
  const [loading, setLoading] = useState(false);
  const { transformRawServiceData } = useServiceTransformer();
  const { toast } = useToast();

  const analyzeService = (service: Service): { issues: ServiceIssue[], canInclude: boolean } => {
    const issues: ServiceIssue[] = [];

    // Check if service is pending
    if (service.status === 'pending') {
      issues.push({
        type: 'error',
        message: 'El servicio está pendiente y debe ser completado antes del cierre',
        field: 'status'
      });
    }

    // Check if service failed
    if (service.status === 'failed') {
      issues.push({
        type: 'error',
        message: 'El servicio falló y debe ser revisado antes del cierre',
        field: 'status'
      });
    }

    // Check for missing purchase order on services that might need it
    if (!service.purchaseOrderNumber && service.value > 100000) {
      issues.push({
        type: 'warning',
        message: 'Servicio de alto valor sin orden de compra',
        field: 'purchaseOrder'
      });
    }

    // Check for missing operator
    if (!service.operator) {
      issues.push({
        type: 'warning',
        message: 'Servicio sin operador asignado',
        field: 'operator'
      });
    }

    // Check for missing crane
    if (!service.crane) {
      issues.push({
        type: 'warning',
        message: 'Servicio sin grúa asignada',
        field: 'crane'
      });
    }

    // Check if value is zero or negative
    if (service.value <= 0) {
      issues.push({
        type: 'error',
        message: 'El servicio tiene un valor inválido (≤ 0)',
        field: 'value'
      });
    }

    const canInclude = !issues.some(issue => issue.type === 'error') && 
                      ['completed', 'with_purchase_order'].includes(service.status);

    return { issues, canInclude };
  };

  const fetchClientsForMonth = useCallback(async (month: Date) => {
    try {
      setLoading(true);
      console.log('Fetching clients data for month:', month);

      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Fetch services for the selected month
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, department, is_active),
          third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, department, is_active),
          cranes!left(id, license_plate, brand, model, type, is_active),
          operators!left(id, name, rut, phone, license_number, is_active),
          service_types!inner(id, name, description, is_active)
        `)
        .gte('service_date', monthStart.toISOString().split('T')[0])
        .lte('service_date', monthEnd.toISOString().split('T')[0])
        .in('status', ['completed', 'with_purchase_order', 'pending', 'failed'])
        .order('service_date', { ascending: true });

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        throw servicesError;
      }

      const services = transformRawServiceData(servicesData || []);
      console.log('Services found for month:', services.length);

      // Get services already in closures to exclude them
      const { data: closureServices, error: closureError } = await supabase
        .from('closure_services')
        .select('service_id');

      if (closureError) {
        console.error('Error fetching closure services:', closureError);
      }

      const usedServiceIds = new Set(closureServices?.map(cs => cs.service_id) || []);

      // Filter out services already in closures
      const availableServices = services.filter(service => !usedServiceIds.has(service.id));

      // Group services by client
      const clientGroups = new Map<string, Service[]>();
      
      availableServices.forEach(service => {
        const clientId = service.client?.id || 'unknown';
        if (!clientGroups.has(clientId)) {
          clientGroups.set(clientId, []);
        }
        clientGroups.get(clientId)!.push(service);
      });

      // Build client closure data
      const clientsClosureData: ClientClosureData[] = [];

      for (const [clientId, clientServices] of clientGroups.entries()) {
        const client = clientServices[0]?.client;
        if (!client) continue;

        const servicesWithIssues: ServiceWithIssues[] = clientServices.map(service => {
          const analysis = analyzeService(service);
          return {
            ...service,
            issues: analysis.issues,
            canInclude: analysis.canInclude
          };
        });

        const completedServices = servicesWithIssues.filter(s => 
          ['completed', 'with_purchase_order'].includes(s.status)
        ).length;
        
        const pendingServices = servicesWithIssues.filter(s => 
          s.status === 'pending'
        ).length;

        const totalAmount = servicesWithIssues.reduce((sum, s) => sum + s.value, 0);
        
        const hasIssues = servicesWithIssues.some(s => s.issues.length > 0);
        const issues = Array.from(new Set(
          servicesWithIssues.flatMap(s => s.issues.map(i => i.message))
        ));

        clientsClosureData.push({
          client,
          services: servicesWithIssues,
          completedServices,
          pendingServices,
          totalAmount,
          hasIssues,
          issues
        });
      }

      // Sort clients by status (ready first, then needs attention)
      clientsClosureData.sort((a, b) => {
        if (a.hasIssues !== b.hasIssues) {
          return a.hasIssues ? 1 : -1;
        }
        return b.completedServices - a.completedServices;
      });

      setClientsData(clientsClosureData);
      console.log('Clients closure data prepared:', clientsClosureData.length);
    } catch (error: any) {
      console.error('Error fetching clients for month:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo cargar la información de clientes para el mes seleccionado.",
      });
      setClientsData([]);
    } finally {
      setLoading(false);
    }
  }, [transformRawServiceData, toast]);

  const completeService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .eq('id', serviceId);

      if (error) throw error;

      // Refresh data after completing service
      await fetchClientsForMonth(selectedMonth);
      
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

  useEffect(() => {
    fetchClientsForMonth(selectedMonth);
  }, [selectedMonth, fetchClientsForMonth]);

  const clientsSummary = {
    total: clientsData.length,
    ready: clientsData.filter(c => !c.hasIssues && c.completedServices > 0).length,
    needsAttention: clientsData.filter(c => c.hasIssues).length
  };

  return {
    selectedMonth,
    setSelectedMonth,
    clientsData,
    loading,
    clientsSummary,
    completeService,
    refetch: () => fetchClientsForMonth(selectedMonth)
  };
};