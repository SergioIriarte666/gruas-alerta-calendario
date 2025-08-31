
import { Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClosuresSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

const ClosuresSearch = ({ searchTerm, onSearchChange, statusFilter, onStatusFilterChange }: ClosuresSearchProps) => {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por folio o estado..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="pl-10 bg-white/5 border-gray-700 text-white">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all" className="text-white hover:bg-gray-700">
                  Todos los estados
                </SelectItem>
                <SelectItem value="open" className="text-white hover:bg-gray-700">
                  Abiertos
                </SelectItem>
                <SelectItem value="closed" className="text-white hover:bg-gray-700">
                  Cerrados
                </SelectItem>
                <SelectItem value="invoiced" className="text-white hover:bg-gray-700">
                  Facturados
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClosuresSearch;
