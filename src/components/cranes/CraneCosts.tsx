
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Calendar, 
  DollarSign,
  FileText,
  Filter,
  TrendingUp,
  TrendingDown,
  Fuel,
  Wrench,
  Building
} from 'lucide-react';
import { Crane } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { useCraneCosts } from '@/hooks/useCraneCosts';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { MetricCard } from '@/components/ui/metric-card';
import { SectionCard } from '@/components/ui/section-card';
import { StatusBadge } from '@/components/ui/status-badge';

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
      const currentDate = new Date();
      return costDate.getMonth() === currentDate.getMonth() && 
             costDate.getFullYear() === currentDate.getFullYear();
    })
    .reduce((sum, cost) => sum + Number(cost.amount), 0);

  const categories = [...new Set(costs.map(cost => cost.subcategory).filter(Boolean))];

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

      {/* Filtros */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por descripción o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterCategory('all')}
                className={filterCategory === 'all' ? '' : 'border-primary/30 text-primary hover:bg-primary-soft hover:text-primary'}
              >
                Todos
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={filterCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory(category)}
                  className={filterCategory === category ? '' : 'border-primary/30 text-primary hover:bg-primary-soft hover:text-primary'}
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Costos */}
      <SectionCard title="Detalle de Costos">
          {filteredCosts.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
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
                            <Calendar className="w-4 h-4" />
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
      </SectionCard>

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
