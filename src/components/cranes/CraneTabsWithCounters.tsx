
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CraneServices } from './CraneServices';
import { CraneCosts } from './CraneCosts';
import { CraneParts } from './CraneParts';
import { CraneMaintenanceTab } from './CraneMaintenanceTab';
import { CraneMetricsOverview } from './CraneMetricsOverview';
import { CraneInventoryTab } from './CraneInventoryTab';
import { Crane } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CraneTabsWithCountersProps {
  crane: Crane;
}

export const CraneTabsWithCounters = ({ crane }: CraneTabsWithCountersProps) => {
  // Consulta para obtener contadores
  const { data: counters } = useQuery({
    queryKey: ['crane-counters', crane.id],
    queryFn: async () => {
      const [servicesData, costsData, partsData, maintenanceData] = await Promise.all([
        supabase.from('services').select('id', { count: 'exact' }).eq('crane_id', crane.id),
        supabase.from('costs').select('id', { count: 'exact' }).eq('crane_id', crane.id),
        supabase.from('crane_parts').select('id', { count: 'exact' }).eq('crane_id', crane.id),
        supabase.from('crane_maintenance').select('id', { count: 'exact' }).eq('crane_id', crane.id)
      ]);

      return {
        services: servicesData.count || 0,
        costs: costsData.count || 0,
        parts: partsData.count || 0,
        maintenance: maintenanceData.count || 0
      };
    }
  });

  const CounterBadge = ({ count }: { count: number }) => (
    <Badge variant="secondary" className="ml-2 bg-tms-green/20 text-tms-green border-tms-green/50">
      {count}
    </Badge>
  );

  return (
    <Tabs defaultValue="overview" className="w-full h-full flex flex-col">
      <TabsList className="grid w-full grid-cols-5 lg:grid-cols-6 bg-black/50 border-b border-tms-green/30">
        <TabsTrigger value="overview" className="data-[state=active]:bg-tms-green/20 data-[state=active]:text-tms-green">
          Resumen
        </TabsTrigger>
        <TabsTrigger value="services" className="data-[state=active]:bg-tms-green/20 data-[state=active]:text-tms-green">
          Servicios
          <CounterBadge count={counters?.services || 0} />
        </TabsTrigger>
        <TabsTrigger value="costs" className="data-[state=active]:bg-tms-green/20 data-[state=active]:text-tms-green">
          Costos
          <CounterBadge count={counters?.costs || 0} />
        </TabsTrigger>
        <TabsTrigger value="parts" className="data-[state=active]:bg-tms-green/20 data-[state=active]:text-tms-green">
          Piezas
          <CounterBadge count={counters?.parts || 0} />
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="data-[state=active]:bg-tms-green/20 data-[state=active]:text-tms-green">
          Mantenimiento
          <CounterBadge count={counters?.maintenance || 0} />
        </TabsTrigger>
        <TabsTrigger value="inventory" className="data-[state=active]:bg-tms-green/20 data-[state=active]:text-tms-green hidden lg:flex">
          Inventario
        </TabsTrigger>
      </TabsList>

      <div className="flex-1 overflow-hidden">
        <TabsContent value="overview" className="h-full overflow-auto">
          <CraneMetricsOverview crane={crane} />
        </TabsContent>

        <TabsContent value="services" className="h-full overflow-auto">
          <CraneServices crane={crane} />
        </TabsContent>

        <TabsContent value="costs" className="h-full overflow-auto">
          <CraneCosts crane={crane} />
        </TabsContent>

        <TabsContent value="parts" className="h-full overflow-auto">
          <CraneParts crane={crane} />
        </TabsContent>

        <TabsContent value="maintenance" className="h-full overflow-auto">
          <CraneMaintenanceTab crane={crane} />
        </TabsContent>

        <TabsContent value="inventory" className="h-full overflow-auto">
          <CraneInventoryTab crane={crane} />
        </TabsContent>
      </div>
    </Tabs>
  );
};
