
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, SlidersHorizontal } from 'lucide-react';

interface CranesFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export const CranesFilters = ({ searchTerm, setSearchTerm }: CranesFiltersProps) => {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
          <Input
            type="text"
            placeholder="Buscar por patente, marca o modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 rounded-xl border-border/70 bg-background/70 pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="size-4" />
            Vista actual
          </div>
          <Badge variant="outline" className="rounded-full">
            {searchTerm ? `Búsqueda: ${searchTerm}` : 'Mostrando todo el parque'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};
