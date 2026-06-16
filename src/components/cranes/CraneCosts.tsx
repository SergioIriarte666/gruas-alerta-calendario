
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  Calendar,
  DollarSign,
  FileText,
  TrendingUp,
  Fuel,
  Wrench,
  Building
} from 'lucide-react';
import { Crane } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { businessClock } from '@/utils/businessClock';
import { useCraneCosts } from '@/hooks/useCraneCosts';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { MetricCard } from '@/components/ui/metric-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

interface CraneCostsProps {
  crane: Crane;
}

export const CraneCosts = ({ crane }: CraneCostsProps) => {
  const { data: costs = [], isLoading } = useCraneCosts(crane.id);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  
  // Obtener detalles completos del servicio
  const { data: serviceDetails } = useServiceDetails(selectedServiceId);

  const getCategoryBadge = (subcategory: string | null) => {
    switch (subcategory) {
      case 'Combustible':
        return <StatusBadge tone="pending" icon={Fuel}>Combustible</StatusBadge>;
      case 'Piezas y Repuestos':
        return <StatusBadge tone="info" icon={Wrench}>Repuestos</StatusBadge>;
      case 'Mano de obra':
        return <StatusBadge tone="completed">Mano de obra</StatusBadge>;
      case 'Servicios externos':
        return <StatusBadge tone="neutral" icon={Building}>Servicios</StatusBadge>;
      default:
        return <Badge variant="secondary">{subcategory || 'General'}</Badge>;
    }
  };

  const handleServiceClick = (cost: any) => {
    if (cost.services) {
      setSelectedServiceId(cost.services.id);
      setIsServiceModalOpen(true);
    }
  };

  const filteredCosts = costs.filter(cost => {
    const matchesSearch = cost.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cost.cost_categories?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || cost.subcategory === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
  const monthlyTotal = costs
    .filter(cost => {
      const costDate = new Date(cost.date);
      const currentDate = businessClock.todayDate();
      return costDate.getMonth() === currentDate.getMonth() && 
             costDate.getFullYear() === currentDate.getFullYear();
    })
    .reduce((sum, cost) => sum + Number(cost.amount), 0);

  const categories = [...new Set(costs.map(cost => cost.subcategory).filter(Boolean))];

  // Conteo de registros por categoría para el sidebar
  const categoryCounts = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat!] = costs.filter(c => c.subcategory === cat).length;
    return acc;
  }, {});

  // Monto total por categoría
  const categoryAmounts = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat!] = costs
      .filter(c => c.subcategory === cat)
      .reduce((sum, c) => sum + Number(c.amount), 0);
    return acc;
  }, {});

  // Monto total de la selección actual (para mostrar en header del panel derecho)
  const selectedTotal = filterCategory === 'all'
    ? costs.reduce((sum, c) => sum + Number(c.amount), 0)
    : costs.filter(c => c.subcategory === filterCategory).reduce((sum, c) => sum + Number(c.amount), 0);

  const selectedLabel = filterCategory === 'all' ? 'Todas las categorías' : filterCategory;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando costos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen de Costos */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard title="Total Costos" value={`$${totalCosts.toLocaleString()}`} icon={DollarSign} tone="danger" />
        <MetricCard title="Este Mes" value={`$${monthlyTotal.toLocaleString()}`} icon={TrendingUp} tone="warning" />
        <MetricCard title="Registros" value={costs.length} icon={FileText} tone="primary" />
      </div>

      {/* Layout dos columnas: sidebar categorías + listado */}
      <div className="flex gap-0 rounded-lg border border-border bg-card overflow-hidden">

        {/* Mini-sidebar de categorías */}
        <aside className="w-48 flex-shrink-0 border-r border-border/70 flex flex-col">
          <div className="px-3 pt-3 pb-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Categorías
            </p>
          </div>
          <div className="flex flex-col gap-0.5 px-2 pb-3 flex-1">
            {/* Opción "Todas" */}
            <button
              onClick={() => setFilterCategory('all')}
              className={cn(
                'flex items-center justify-between w-full rounded-md px-2.5 py-2 text-sm transition-colors text-left',
                filterCategory === 'all'
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <span>Todas</span>
                <span className={cn(
                  'text-xs tabular-nums truncate',
                  filterCategory === 'all' ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
                )}>
                  ${costs.reduce((s, c) => s + Number(c.amount), 0).toLocaleString('es-CL')}
                </span>
              </div>
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full leading-none tabular-nums flex-shrink-0 ml-1',
                filterCategory === 'all'
                  ? 'bg-white/20 text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}>
                {costs.length}
              </span>
            </button>

            {/* Una opción por cada categoría */}
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setFilterCategory(category!)}
                className={cn(
                  'flex items-center justify-between w-full rounded-md px-2.5 py-2 text-sm transition-colors text-left',
                  filterCategory === category
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <div className="flex flex-col gap-0.5 flex-1 min-w-0 mr-1">
                  <span className="truncate">{category}</span>
                  <span className={cn(
                    'text-xs tabular-nums truncate',
                    filterCategory === category ? 'text-primary-foreground/70' : 'text-muted-foreground/70'
                  )}>
                    ${(categoryAmounts[category!] ?? 0).toLocaleString('es-CL')}
                  </span>
                </div>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full leading-none tabular-nums flex-shrink-0',
                  filterCategory === category
                    ? 'bg-white/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {categoryCounts[category!] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Panel derecho: buscador + listado */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Buscador */}
          <div className="p-3 border-b border-border/70">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4" />
              <Input
                placeholder="Buscar por descripción o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Resumen selección activa */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/70 bg-muted/30">
            <span className="text-xs text-muted-foreground truncate">
              {selectedLabel}
            </span>
            <span className="text-xs font-medium tabular-nums text-foreground flex-shrink-0 ml-2">
              ${selectedTotal.toLocaleString('es-CL')}
              <span className="text-muted-foreground font-normal ml-1">
                ({filteredCosts.length} registros)
              </span>
            </span>
          </div>

          {/* Listado de costos */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredCosts.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="mx-auto mb-4 size-12 text-muted-foreground" />
                <h3 className="mb-2 text-lg font-medium text-foreground">No se encontraron costos</h3>
                <p className="text-muted-foreground">
                  {searchTerm || filterCategory !== 'all'
                    ? 'Intenta ajustar los filtros de búsqueda'
                    : 'Esta grúa aún no tiene costos registrados'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredCosts.map((cost) => (
                  <div
                    key={cost.id}
                    className="rounded-lg border border-border bg-muted/30 p-4 transition-colors hover:border-primary/30"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-foreground">{cost.description}</span>
                          {getCategoryBadge(cost.subcategory)}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="size-4" />
                              {formatForDisplay(cost.date)}
                            </div>
                            <div className="text-muted-foreground">
                              Categoría: {cost.cost_categories?.name || 'Sin categoría'}
                            </div>
                          </div>

                          <div className="space-y-1">
                            {cost.operators && (
                              <div className="text-muted-foreground">
                                Operador: {cost.operators.name}
                              </div>
                            )}
                            {cost.services && (
                              <div className="text-muted-foreground">
                                Servicio: <button
                                  onClick={() => handleServiceClick(cost)}
                                  className="cursor-pointer text-info underline hover:text-info"
                                >
                                  {cost.services.folio}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {cost.notes && (
                          <div className="rounded bg-muted p-2 text-sm text-muted-foreground">
                            {cost.notes}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-danger">
                          ${Number(cost.amount).toLocaleString()}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Monto del costo
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de detalles del servicio */}
      {selectedServiceId && serviceDetails && (
        <ServiceDetailsModal
          service={serviceDetails}
          isOpen={isServiceModalOpen}
          onClose={() => {
            setIsServiceModalOpen(false);
            setSelectedServiceId(null);
          }}
        />
      )}
    </div>
  );
};
