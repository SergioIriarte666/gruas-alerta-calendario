import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface VehicleFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  placeholder: string;
}

export const VehicleFilters = ({ searchTerm, setSearchTerm, placeholder }: VehicleFiltersProps) => {
  return (
    <Card className="border-border/70 bg-gradient-to-br from-card to-muted/20 shadow-sm">
      <CardContent className="p-4 md:p-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-11 rounded-xl border-border/70 bg-background/90 pl-10 shadow-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
};
