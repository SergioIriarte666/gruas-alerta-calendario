import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AdvancedServiceFilters } from './AdvancedServiceFilters';
import { useAdvancedFilters, AdvancedFilters } from '@/hooks/useAdvancedFilters';

interface ServiceFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onAdvancedFiltersChange: (filters: AdvancedFilters | null) => void;
}

const statusLabels: Record<string, string> = {
  all: 'Todos',
  pending: 'Pendientes',
  in_progress: 'En progreso',
  completed: 'Completados',
  cancelled: 'Cancelados',
  invoiced: 'Facturados',
  quoted: 'Cotizados',
  purchase_order_pending: 'Esperando O.C.',
  with_purchase_order: 'Con O.C.',
  failed: 'Fallidos',
};

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
      <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por folio, cliente, patente, origen, destino, cotización u orden de compra..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="h-11 rounded-xl border-border/70 bg-background/70 pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={onStatusChange}>
                <SelectTrigger className="h-11 w-full rounded-xl border-border/70 bg-background/70 md:w-56">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="in_progress">En Progreso</SelectItem>
                  <SelectItem value="completed">Completados</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                  <SelectItem value="invoiced">Facturados</SelectItem>
                  <SelectItem value="quoted">Cotizados</SelectItem>
                  <SelectItem value="purchase_order_pending">Esperando O.C.</SelectItem>
                  <SelectItem value="with_purchase_order">Con Orden de Compra</SelectItem>
                  <SelectItem value="failed">Fallidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(true)}
                className={`relative h-11 rounded-xl border-border/70 bg-background/70 ${
                  hasActiveFilters ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15' : ''
                }`}
              >
                <Filter className="mr-2 size-4" />
                Más filtros
                {hasActiveFilters && (
                  <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary" />
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-11 rounded-xl px-3 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="mr-2 size-4" />
                  Limpiar
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="size-4" />
              Filtros rápidos
            </div>
            <Badge variant={statusFilter === 'all' ? 'outline' : 'secondary'} className="rounded-full">
              Estado: {statusLabels[statusFilter] ?? 'Todos'}
            </Badge>
            {hasActiveFilters && (
              <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-primary">
                Avanzados activos
              </Badge>
            )}
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
