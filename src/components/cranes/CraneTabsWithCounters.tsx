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
import { BarChart3, Wrench, DollarSign, Package, Settings, Warehouse } from 'lucide-react';

interface CraneTabsWithCountersProps {
  crane: Crane;
}

export const CraneTabsWithCounters = ({ crane }: CraneTabsWithCountersProps) => {
  // Consulta para obtener contadores PRECISOS
  const { data: counters } = useQuery({
    queryKey: ['crane-counters', crane.id],
    queryFn: async () => {
      // 1. Total servicios
      const { count: servicesCount } = await supabase
        .from('services')
        .select('id', { count: 'exact' })
        .eq('crane_id', crane.id);

      // 2. Costos operativos (excluyendo comisiones)
      const { data: commissionCategory } = await supabase
        .from('cost_categories')
        .select('id')
        .eq('name', 'Comisión Operador')
        .single();

      const { count: operationalCostsCount } = await supabase
        .from('costs')
        .select('id', { count: 'exact' })
        .eq('crane_id', crane.id)
        .neq('category_id', commissionCategory?.id || '00000000-0000-0000-0000-000000000000');

      // 3. Piezas (directas + consumos)
      const [{ count: directPartsCount }, { count: consumptionsCount }] = await Promise.all([
        supabase
          .from('crane_parts')
          .select('id', { count: 'exact' })
          .eq('crane_id', crane.id),
        supabase
          .from('inventory_movements')
          .select('id', { count: 'exact' })
          .eq('crane_id', crane.id)
          .eq('movement_type', 'exit')
          .eq('status', 'active')
      ]);

      // 4. Mantenimientos
      const { count: maintenanceCount } = await supabase
        .from('crane_maintenance')
        .select('id', { count: 'exact' })
        .eq('crane_id', crane.id);

      return {
        services: servicesCount || 0,
        costs: operationalCostsCount || 0,
        parts: (directPartsCount || 0) + (consumptionsCount || 0),
        maintenance: maintenanceCount || 0
      };
    }
  });

  const CounterBadge = ({ count }: { count: number }) => (
    <Badge variant="secondary" className="ml-2 bg-primary/20 text-black border-primary/50">
      {count}
    </Badge>
  );

  return (
    <Tabs defaultValue="overview" className="w-full h-full flex flex-col">
      <TabsList className="flex w-full overflow-x-auto bg-muted border-b border-border">
        <TabsTrigger value="overview" className="flex-shrink-0 px-3 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
          <BarChart3 className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Resumen</span>
        </TabsTrigger>
        <TabsTrigger value="services" className="flex-shrink-0 px-3 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
          <Wrench className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Servicios</span>
          <CounterBadge count={counters?.services || 0} />
        </TabsTrigger>
        <TabsTrigger value="costs" className="flex-shrink-0 px-3 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
          <DollarSign className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Costos</span>
          <CounterBadge count={counters?.costs || 0} />
        </TabsTrigger>
        <TabsTrigger value="parts" className="flex-shrink-0 px-3 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
          <Package className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Piezas</span>
          <CounterBadge count={counters?.parts || 0} />
        </TabsTrigger>
        <TabsTrigger value="maintenance" className="flex-shrink-0 px-3 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
          <Settings className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Mant.</span>
          <CounterBadge count={counters?.maintenance || 0} />
        </TabsTrigger>
        <TabsTrigger value="inventory" className="flex-shrink-0 px-3 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary hidden lg:flex">
          <Warehouse className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Inventario</span>
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
