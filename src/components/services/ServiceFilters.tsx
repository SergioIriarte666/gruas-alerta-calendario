import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdvancedServiceFilters } from './AdvancedServiceFilters';
import { useAdvancedFilters, AdvancedFilters } from '@/hooks/useAdvancedFilters';

interface ServiceFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onAdvancedFiltersChange: (filters: AdvancedFilters | null) => void;
}

export const ServiceFilters = ({ 
  searchTerm, 
  onSearchChange, 
  statusFilter, 
  onStatusChange,
  onAdvancedFiltersChange
}: ServiceFiltersProps) => {
  const {
    isOpen,
    setIsOpen,
    filters,
    hasActiveFilters,
    clearFilters,
    updateFilters
  } = useAdvancedFilters();

  const handleApplyFilters = () => {
    onAdvancedFiltersChange(hasActiveFilters ? filters : null);
  };

  const handleClearFilters = () => {
    clearFilters();
    onAdvancedFiltersChange(null);
  };

  return (
    <>
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por folio, cliente, patente, marca, origen, destino, cotización, orden de compra..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={onStatusChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    Todos los estados
                  </SelectItem>
                  <SelectItem value="pending">
                    Pendientes
                  </SelectItem>
                  <SelectItem value="in_progress">
                    En Progreso
                  </SelectItem>
                  <SelectItem value="completed">
                    Completados
                  </SelectItem>
                  <SelectItem value="cancelled">
                    Cancelados
                  </SelectItem>
                  <SelectItem value="invoiced">
                    Facturados
                  </SelectItem>
                  <SelectItem value="quoted">
                    Cotizados
                  </SelectItem>
                  <SelectItem value="purchase_order_pending">
                    Esperando O.C.
                  </SelectItem>
                  <SelectItem value="with_purchase_order">
                    Con Orden de Compra
                  </SelectItem>
                  <SelectItem value="failed">
                    Fallidos
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(true)}
                className={`relative ${
                  hasActiveFilters ? 'border-primary/30 bg-primary-soft text-foreground hover:bg-primary-soft/80' : ''
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Más Filtros
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary"></span>
                )}
              </Button>
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AdvancedServiceFilters
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        filters={filters}
        onFiltersChange={updateFilters}
        onApply={handleApplyFilters}
        onClear={handleClearFilters}
      />
    </>
  );
};
