
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
        return <Badge className="bg-orange-500/20 text-orange-400"><Fuel className="w-3 h-3 mr-1" />Combustible</Badge>;
      case 'Piezas y Repuestos':
        return <Badge className="bg-blue-500/20 text-blue-400"><Wrench className="w-3 h-3 mr-1" />Repuestos</Badge>;
      case 'Mano de obra':
        return <Badge className="bg-green-500/20 text-green-400">Mano de obra</Badge>;
      case 'Servicios externos':
        return <Badge className="bg-purple-500/20 text-purple-400"><Building className="w-3 h-3 mr-1" />Servicios</Badge>;
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
        <div className="text-white">Cargando costos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen de Costos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Total Costos</p>
                <p className="text-white text-2xl font-bold">${totalCosts.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Este Mes</p>
                <p className="text-white text-2xl font-bold">${monthlyTotal.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-tms-green/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Registros</p>
                <p className="text-white text-2xl font-bold">{costs.length}</p>
              </div>
              <FileText className="w-8 h-8 text-tms-green" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por descripción o categoría..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-black border-tms-green/30 text-white"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={filterCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterCategory('all')}
                className={filterCategory === 'all' 
                  ? 'bg-tms-green text-black' 
                  : 'border-tms-green/50 text-tms-green hover:bg-tms-green/10'
                }
              >
                Todos
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={filterCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterCategory(category)}
                  className={filterCategory === category 
                    ? 'bg-tms-green text-black' 
                    : 'border-tms-green/50 text-tms-green hover:bg-tms-green/10'
                  }
                >
                  {category}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Costos */}
      <Card className="bg-white/5 border-tms-green/30">
        <CardHeader>
          <CardTitle className="text-white">Detalle de Costos</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCosts.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No se encontraron costos</h3>
              <p className="text-gray-400">
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
                  className="border border-gray-700 rounded-lg p-4 hover:border-tms-green/50 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">{cost.description}</span>
                        {getCategoryBadge(cost.subcategory)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar className="w-4 h-4" />
                            {formatForDisplay(cost.date)}
                          </div>
                          <div className="text-gray-300">
                            Categoría: {cost.cost_categories?.name || 'Sin categoría'}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          {cost.operators && (
                            <div className="text-gray-300">
                              Operador: {cost.operators.name}
                            </div>
                          )}
                          {cost.services && (
                            <div className="text-gray-300">
                              Servicio: <button
                                onClick={() => handleServiceClick(cost)}
                                className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                              >
                                {cost.services.folio}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {cost.notes && (
                        <div className="text-gray-400 text-sm bg-white/5 p-2 rounded">
                          {cost.notes}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-red-400">
                        ${Number(cost.amount).toLocaleString()}
                      </div>
                      <div className="text-gray-400 text-sm">
                        Monto del costo
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
