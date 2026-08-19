
import { Search, Filter, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Client } from '@/types';
import { getClientDisplayName } from '@/utils/clientDisplayName';

interface ClosuresSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  clientFilter: string;
  onClientFilterChange: (clientId: string) => void;
  clients: Client[];
}

const ClosuresSearch = ({ searchTerm, onSearchChange, statusFilter, onStatusFilterChange, clientFilter, onClientFilterChange, clients }: ClosuresSearchProps) => {
  const sortedClients = [...clients].filter(c => c.isActive).sort((a, b) => a.name.localeCompare(b.name));
  const statusLabels: Record<string, string> = {
    all: 'Todos',
    open: 'Abiertos',
    closed: 'Cerrados',
    invoiced: 'Facturados',
  };

  return (
    <Card className="finance-filter-panel border-border/70 bg-card/80 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              placeholder="Buscar por folio, estado o cliente..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-11 rounded-xl border-border/70 bg-background/70 pl-10 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative min-w-[12.5rem]">
            <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4 z-10" />
            <Select value={clientFilter} onValueChange={onClientFilterChange}>
              <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background/70 pl-10 text-foreground">
                <SelectValue placeholder="Filtrar por cliente" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border max-h-[18.75rem]">
                <SelectItem value="all" className="text-foreground hover:bg-muted">
                  Todos los clientes
                </SelectItem>
                {sortedClients.map((client) => (
                  <SelectItem key={client.id} value={client.id} className="text-foreground hover:bg-muted">
                    {getClientDisplayName(client)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative min-w-[12.5rem]">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4 z-10" />
            <Select value={statusFilter} onValueChange={onStatusFilterChange}>
              <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background/70 pl-10 text-foreground">
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
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <Badge variant={statusFilter === 'all' ? 'outline' : 'secondary'} className="rounded-full">
            Estado: {statusLabels[statusFilter] ?? 'Todos'}
          </Badge>
          <Badge variant={clientFilter === 'all' ? 'outline' : 'secondary'} className="rounded-full">
            Cliente: {clientFilter === 'all' ? 'Todos' : 'Filtrado'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClosuresSearch;
