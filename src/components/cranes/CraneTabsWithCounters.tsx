import { CraneServices } from './CraneServices';
import { CraneCosts } from './CraneCosts';
import { CraneParts } from './CraneParts';
import { CraneMaintenanceTab } from './CraneMaintenanceTab';
import { CraneMetricsOverview } from './CraneMetricsOverview';
import { CraneInventoryTab } from './CraneInventoryTab';
import { Crane } from '@/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Wrench, DollarSign, Package, Settings, Warehouse } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CraneTabsWithCountersProps {
  crane: Crane;
}

type CraneTabId = 'overview' | 'services' | 'costs' | 'parts' | 'maintenance' | 'inventory';

export const CraneTabsWithCounters = ({ crane }: CraneTabsWithCountersProps) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CraneTabId>('overview');

  useEffect(() => {
    if (!crane?.id) return;
    // Topic único por montaje: con un topic fijo, supabase-js reutiliza la
    // instancia del canal si el modal se reabre antes de que removeChannel
    // termine, y el segundo .subscribe() lanza "tried to subscribe multiple times"
    const channel = supabase
      .channel(`crane-counters-${crane.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services', filter: `crane_id=eq.${crane.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-counters', crane.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'costs', filter: `crane_id=eq.${crane.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-counters', crane.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crane_parts', filter: `crane_id=eq.${crane.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-counters', crane.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_movements', filter: `crane_id=eq.${crane.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-counters', crane.id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crane_maintenance', filter: `crane_id=eq.${crane.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['crane-counters', crane.id] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [crane?.id, queryClient]);

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

      // 3. Piezas (consumos de inventario por grúa)
      const { count: consumptionsCount } = await supabase
        .from('inventory_movements')
        .select('id', { count: 'exact' })
        .eq('crane_id', crane.id)
        .eq('movement_type', 'exit')
        .eq('status', 'active');

      // 4. Mantenimientos
      const { count: maintenanceCount } = await supabase
        .from('crane_maintenance')
        .select('id', { count: 'exact' })
        .eq('crane_id', crane.id);

      return {
        services: servicesCount || 0,
        costs: operationalCostsCount || 0,
        parts: consumptionsCount || 0,
        maintenance: maintenanceCount || 0
      };
    }
  });

  const navItems = [
    { id: 'overview'     as const, label: 'Resumen',    Icon: BarChart3,  count: null },
    { id: 'services'     as const, label: 'Servicios',  Icon: Wrench,     count: counters?.services ?? 0 },
    { id: 'costs'        as const, label: 'Costos',     Icon: DollarSign, count: counters?.costs ?? 0 },
    { id: 'parts'        as const, label: 'Piezas',     Icon: Package,    count: counters?.parts ?? 0 },
    { id: 'maintenance'  as const, label: 'Mantención', Icon: Settings,   count: counters?.maintenance ?? 0 },
    { id: 'inventory'    as const, label: 'Inventario', Icon: Warehouse,  count: null },
  ];

  return (
    <div className="flex flex-1 min-w-0 min-h-0">
      {/* Sidebar nav */}
      <nav className="w-44 flex-shrink-0 border-r border-border/70 flex flex-col py-3 px-2">
        <div className="flex flex-col gap-0.5 flex-1">
          {navItems.map(({ id, label, Icon, count }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-sm transition-colors text-left',
                  isActive
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4 flex-shrink-0" />
                <span className="flex-1 leading-none">{label}</span>
                {count !== null && (
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full leading-none font-medium tabular-nums',
                    isActive
                      ? 'bg-white/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Contenido activo */}
      <div className="flex-1 min-w-0 overflow-y-auto p-6">
        {activeTab === 'overview'    && <CraneMetricsOverview crane={crane} />}
        {activeTab === 'services'    && <CraneServices crane={crane} />}
        {activeTab === 'costs'       && <CraneCosts crane={crane} />}
        {activeTab === 'parts'       && <CraneParts crane={crane} />}
        {activeTab === 'maintenance' && <CraneMaintenanceTab crane={crane} />}
        {activeTab === 'inventory'   && <CraneInventoryTab crane={crane} />}
      </div>
    </div>
  );
};
