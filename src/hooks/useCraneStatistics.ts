import { parseDateValue } from '@/utils/calendarDate';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { businessClock } from '@/utils/businessClock';
import { createLogger } from '@/lib/logger';

const _logger = createLogger('useCraneStatistics');

export interface CraneStatistics {
  totalServices: number;
  totalRevenue: number;
  completedServices: number;
  pendingServices: number;
  averageServiceValue: number;
  monthlyServiceCounts: number[];
  monthlyRevenue: number[];
  utilizationRate: number;
  efficiency: number;
  cancelledServices: number;
  averageServiceTime: number;
  customerSatisfaction: number;
  maintenanceCosts: number[];
  fuelConsumption: number[];
  yearOverYearGrowth: number;
}

export const useCraneStatistics = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-statistics', craneId],
    queryFn: async (): Promise<CraneStatistics> => {
      // Obtener servicios de la grúa
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('service_date, status, value, custody_total_amount')
        .eq('crane_id', craneId);

      if (servicesError) throw servicesError;

      // Obtener costos de mantenimiento
      const { data: maintenanceData, error: maintenanceError } = await supabase
        .from('crane_maintenance')
        .select('cost, completed_date')
        .eq('crane_id', craneId)
        .eq('status', 'completed');

      if (maintenanceError) throw maintenanceError;

      // Obtener costos de combustible (asumiendo que hay una categoría de combustible)
      const { data: fuelCosts, error: fuelError } = await supabase
        .from('costs')
        .select('amount, date')
        .eq('crane_id', craneId)
        .ilike('description', '%combustible%');

      if (fuelError) throw fuelError;

      const currentYear = businessClock.todayDate().getFullYear();
      const currentServices = services?.filter(s => 
        parseDateValue(s.service_date).getFullYear() === currentYear
      ) || [];

      const completedServices = currentServices.filter(s => s.status === 'completed');
      const cancelledServices = currentServices.filter(s => s.status === 'cancelled');
      const pendingServices = currentServices.filter(s => s.status === 'pending');

      // Calcular totales
      const totalServices = currentServices.length;
      const totalRevenue = completedServices.reduce((sum, service) => sum + getDisplayServiceValue(service), 0);
      const averageServiceValue = completedServices.length > 0 ? totalRevenue / completedServices.length : 0;

      // Calcular estadísticas mensuales
      const monthlyData = Array(12).fill(0).map((_, month) => {
        const monthServices = currentServices.filter(service => 
          parseDateValue(service.service_date).getMonth() === month
        );
        const monthCompletedServices = monthServices.filter(s => s.status === 'completed');
        const monthRevenue = monthCompletedServices.reduce((sum, service) => sum + getDisplayServiceValue(service), 0);
        
        return {
          services: monthServices.length,
          revenue: monthRevenue
        };
      });

      const monthlyServiceCounts = monthlyData.map(m => m.services);
      const monthlyRevenue = monthlyData.map(m => m.revenue);

      // Calcular costos de mantenimiento por mes
      const maintenanceCosts = Array(12).fill(0).map((_, month) => {
        const monthMaintenance = maintenanceData?.filter(m => 
          m.completed_date && parseDateValue(m.completed_date).getMonth() === month
        ) || [];
        return monthMaintenance.reduce((sum, m) => sum + (m.cost || 0), 0);
      });

      // Estimar consumo de combustible (usando costos de combustible como proxy)
      const fuelConsumption = Array(12).fill(0).map((_, month) => {
        const monthFuel = fuelCosts?.filter(f => 
          parseDateValue(f.date).getMonth() === month
        ) || [];
        const monthFuelCost = monthFuel.reduce((sum, f) => sum + (f.amount || 0), 0);
        // Estimar litros asumiendo $1000 CLP por litro (aproximado)
        return Math.round(monthFuelCost / 1000);
      });

      // Cálculos de eficiencia
      const utilizationRate = totalServices > 0 ? Math.min(95, Math.round((completedServices.length / totalServices) * 100)) : 0;
      const efficiency = totalServices > 0 ? Math.round((completedServices.length / totalServices) * 100) : 0;
      
      // Calcular crecimiento año anterior (simplificado)
      const previousYearServices = services?.filter(s => 
        parseDateValue(s.service_date).getFullYear() === currentYear - 1
      ) || [];
      
      const yearOverYearGrowth = previousYearServices.length > 0 
        ? Math.round(((totalServices - previousYearServices.length) / previousYearServices.length) * 100)
        : 0;

      return {
        totalServices,
        totalRevenue,
        completedServices: completedServices.length,
        pendingServices: pendingServices.length,
        averageServiceValue,
        monthlyServiceCounts,
        monthlyRevenue,
        utilizationRate,
        efficiency,
        cancelledServices: cancelledServices.length,
        averageServiceTime: 4.5, // Placeholder - podría calcularse con timestamps reales
        customerSatisfaction: 4.8, // Placeholder - requeriría sistema de calificaciones
        maintenanceCosts,
        fuelConsumption,
        yearOverYearGrowth
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};
