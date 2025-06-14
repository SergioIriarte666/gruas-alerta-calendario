
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
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-tms-green focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger className="w-48 bg-white/5 border-gray-700 text-white">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white hover:bg-gray-700">
                  Todos los estados
                </SelectItem>
                <SelectItem value="pending" className="text-white hover:bg-gray-700">
                  En Curso
                </SelectItem>
                <SelectItem value="closed" className="text-white hover:bg-gray-700">
                  Cerrados
                </SelectItem>
                <SelectItem value="invoiced" className="text-white hover:bg-gray-700">
                  Facturados
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white">
              <Filter className="w-4 h-4 mr-2" />
              Más Filtros
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
