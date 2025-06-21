
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Filter } from 'lucide-react';

interface ServiceFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
}

export const ServiceFilters = ({ 
  searchTerm, 
  onSearchChange, 
  statusFilter, 
  onStatusChange 
}: ServiceFiltersProps) => {
  return (
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
                className="w-full pl-10 pr-4 py-2 bg-black border border-tms-green/30 rounded-lg text-white placeholder-gray-400 focus:border-tms-green focus:outline-none"
                style={{
                  backgroundColor: '#000000',
                  borderColor: 'rgba(156, 250, 36, 0.3)',
                  color: '#ffffff'
                }}
              />
            </div>
          </div>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger 
                className="w-48 bg-black border-tms-green/30 text-white"
                style={{
                  backgroundColor: '#000000',
                  borderColor: 'rgba(156, 250, 36, 0.3)',
                  color: '#ffffff'
                }}
              >
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent 
                className="bg-black border-tms-green text-white z-50"
                style={{
                  backgroundColor: '#000000',
                  borderColor: '#9cfa24',
                  color: '#ffffff',
                  zIndex: 50
                }}
              >
                <SelectItem 
                  value="all" 
                  className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                  style={{ color: '#ffffff' }}
                >
                  Todos los estados
                </SelectItem>
                <SelectItem 
                  value="pending" 
                  className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                  style={{ color: '#ffffff' }}
                >
                  En Curso
                </SelectItem>
                <SelectItem 
                  value="closed" 
                  className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                  style={{ color: '#ffffff' }}
                >
                  Cerrados
                </SelectItem>
                <SelectItem 
                  value="invoiced" 
                  className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                  style={{ color: '#ffffff' }}
                >
                  Facturados
                </SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              className="border-gray-400/50 bg-gray-400/10 text-gray-300 hover:bg-gray-400/20 hover:text-white"
              style={{
                borderColor: 'rgba(156, 163, 175, 0.5)',
                backgroundColor: 'rgba(156, 163, 175, 0.1)',
                color: '#d1d5db'
              }}
            >
              <Filter className="w-4 h-4 mr-2" />
              Más Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
