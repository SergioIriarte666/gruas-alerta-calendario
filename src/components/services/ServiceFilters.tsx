
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter, X } from 'lucide-react';
import { AdvancedServiceFilters } from './AdvancedServiceFilters';
import { useAdvancedFilters, AdvancedFilters } from '@/hooks/useAdvancedFilters';
import { Service } from '@/types';

interface ServiceFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  onAdvancedFiltersChange: (hasFilters: boolean, filterFunction: (services: Service[]) => Service[]) => void;
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
    applyAdvancedFilters,
    clearFilters,
    updateFilters
  } = useAdvancedFilters();

  const handleApplyFilters = () => {
    const filterFunction = (services: Service[]) => 
      applyAdvancedFilters(services, { searchTerm, statusFilter });
    onAdvancedFiltersChange(hasActiveFilters, filterFunction);
  };

  const handleClearFilters = () => {
    clearFilters();
    const filterFunction = (services: Service[]) => services;
    onAdvancedFiltersChange(false, filterFunction);
  };

  return (
    <>
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por folio, cliente, patente, marca..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-black placeholder-gray-400 focus:border-tms-green focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Select value={statusFilter} onValueChange={onStatusChange}>
                <SelectTrigger 
                  className="w-48 bg-white border-gray-300 text-black"
                >
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent 
                  className="bg-white border-gray-300 text-black z-50"
                >
                  <SelectItem 
                    value="all" 
                    className="text-black hover:bg-gray-100 focus:bg-gray-100"
                  >
                    Todos los estados
                  </SelectItem>
                  <SelectItem 
                    value="pending" 
                    className="text-black hover:bg-gray-100 focus:bg-gray-100"
                  >
                    En Curso
                  </SelectItem>
                  <SelectItem 
                    value="closed" 
                    className="text-black hover:bg-gray-100 focus:bg-gray-100"
                  >
                    Cerrados
                  </SelectItem>
                  <SelectItem 
                    value="invoiced" 
                    className="text-black hover:bg-gray-100 focus:bg-gray-100"
                  >
                    Facturados
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(true)}
                className={`border-gray-400 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-black relative ${
                  hasActiveFilters ? 'border-tms-green bg-green-50 text-green-700' : ''
                }`}
              >
                <Filter className="w-4 h-4 mr-2" />
                Más Filtros
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-tms-green rounded-full"></span>
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
