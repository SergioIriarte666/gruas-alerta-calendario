
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal } from 'lucide-react';

interface OperatorsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  typeFilter: 'all' | 'crane_operator' | 'administrative';
  setTypeFilter: (value: 'all' | 'crane_operator' | 'administrative') => void;
}

export const OperatorsFilters = ({ 
  searchTerm, 
  setSearchTerm,
  typeFilter,
  setTypeFilter 
}: OperatorsFiltersProps) => {
  const typeLabels = {
    all: 'Todos',
    crane_operator: 'Operadores de Grúa',
    administrative: 'Administrativos',
  } as const;

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
            <Input
              type="text"
              placeholder="Buscar por nombre, RUT o licencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 rounded-xl border-border/70 bg-background/70 pl-10"
            />
          </div>
          
          <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
            <SelectTrigger className="h-11 rounded-xl border-border/70 bg-background/70">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="crane_operator">Operadores de Grúa</SelectItem>
              <SelectItem value="administrative">Personal Administrativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            Filtros activos
          </div>
          <Badge variant={typeFilter === 'all' ? 'outline' : 'secondary'} className="rounded-full">
            Tipo: {typeLabels[typeFilter]}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
