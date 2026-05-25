
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface CranesFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export const CranesFilters = ({ searchTerm, setSearchTerm }: CranesFiltersProps) => {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
          <Input
            type="text"
            placeholder="Buscar por patente, marca o modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardContent>
    </Card>
  );
};
