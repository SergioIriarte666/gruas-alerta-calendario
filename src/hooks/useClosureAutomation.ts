import { businessClock } from '@/utils/businessClock';
import { useState, useEffect, useCallback } from 'react';
import { Service, Client } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';
import { useServiceTransformer } from './services/useServiceTransformer';
import { startOfMonth, endOfMonth } from 'date-fns';

import { toLocalDateString } from '@/utils/timezoneUtils';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ClosureAutomation');

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
  const [selectedMonth, setSelectedMonth] = useState<Date>(businessClock.now());
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
      

      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Fetch services for the selected month
      // FIXED: Changed service_types!inner to service_types!left to include services without service type
      logger.debug('fetchServices - start');
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          client:clients!services_client_id_fkey(id, name, rut, phone, email, address, department, is_active),
          third_party_client:clients!services_third_party_client_id_fkey(id, name, rut, phone, email, address, department, is_active),
          cranes!left(id, license_plate, brand, model, type, is_active),
          operators!left(id, name, rut, phone, license_number, is_active),
          service_types!left(id, name, description, is_active)
        `)
        .gte('service_date', toLocalDateString(monthStart))
        .lte('service_date', toLocalDateString(monthEnd))
        .in('status', ['completed', 'with_purchase_order', 'pending', 'failed'])
        .order('service_date', { ascending: true })
        .limit(1000); // Add limit to prevent massive payloads
      logger.debug('fetchServices - end');

      if (servicesError) {
        logger.error('Error fetching services:', servicesError);
        throw servicesError;
      }

      if (servicesData && servicesData.length >= 1000) {
        toast({
          type: "warning",
          title: "Límite de servicios alcanzado",
          description: "Se han cargado los primeros 1000 servicios. Puede que algunos no se muestren.",
        });
      }

      logger.debug('transformServices - start');
      // Process in chunks to avoid blocking UI
      const services = transformRawServiceData(servicesData || []);
      logger.debug('transformServices - end');
      
      logger.debug(`Fetched ${services.length} services for automation`);

      // Get only closure links for the candidate service IDs (not full table)
      const candidateIds = services.map(s => s.id);
      let usedServiceIds = new Set<string>();

      if (candidateIds.length > 0) {
        logger.debug('fetchClosureLinks - start');
        
        // Batch requests if there are too many IDs
        const BATCH_SIZE = 200;
        const batches = [];
        
        for (let i = 0; i < candidateIds.length; i += BATCH_SIZE) {
          const batchIds = candidateIds.slice(i, i + BATCH_SIZE);
          batches.push(
            supabase
              .from('closure_services')
              .select('service_id')
              .in('service_id', batchIds)
          );
        }
        
        const results = await Promise.all(batches);
        const closureServices = results.flatMap(r => r.data || []);
        
        logger.debug('fetchClosureLinks - end');

        results.forEach(r => {
          if (r.error) logger.error('Error fetching closure services batch:', r.error);
        });

        usedServiceIds = new Set(closureServices.map(cs => cs.service_id));
      }

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
      logger.debug('Clients closure data prepared:', clientsClosureData.length);
      logger.debug('Clients summary:', clientsClosureData.map(c => ({ 
        name: c.client.name, 
        services: c.services.length,
        completed: c.completedServices,
        total: c.totalAmount
      })));
    } catch (error: any) {
      logger.error('Error fetching clients for month:', error);
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

  const removeServicesFromState = useCallback((serviceIds: string[]) => {
    setClientsData(currentClientsData => {
      const serviceIdsSet = new Set(serviceIds);
      
      const newClientsData = currentClientsData.map(clientData => {
        const newServices = clientData.services.filter(s => !serviceIdsSet.has(s.id));
        
        if (newServices.length === clientData.services.length) {
          return clientData;
        }

        // Recalculate stats for this client
        const completedServices = newServices.filter(s => 
          ['completed', 'with_purchase_order'].includes(s.status)
        ).length;
        
        const pendingServices = newServices.filter(s => 
          s.status === 'pending'
        ).length;

        const totalAmount = newServices.reduce((sum, s) => sum + s.value, 0);
        
        const hasIssues = newServices.some(s => s.issues.length > 0);
        const issues = Array.from(new Set(
          newServices.flatMap(s => s.issues.map(i => i.message))
        ));

        return {
          ...clientData,
          services: newServices,
          completedServices,
          pendingServices,
          totalAmount,
          hasIssues,
          issues
        };
      }).filter(clientData => clientData.services.length > 0); // Remove clients with no services

      return newClientsData;
    });
  }, []);

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
      logger.error('Error completing service:', error);
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
    removeServicesFromState,
    refetch: () => fetchClientsForMonth(selectedMonth)
  };
};