
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
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar por folio o estado..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative min-w-[200px]">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 z-10" />
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="pl-10 bg-background border-border text-foreground">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border">
                <SelectItem value="all" className="text-foreground hover:bg-muted">
                  Todos los estados
                </SelectItem>
                <SelectItem value="open" className="text-foreground hover:bg-muted">
                  Abiertos
                </SelectItem>
                <SelectItem value="closed" className="text-foreground hover:bg-muted">
                  Cerrados
                </SelectItem>
                <SelectItem value="invoiced" className="text-foreground hover:bg-muted">
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
