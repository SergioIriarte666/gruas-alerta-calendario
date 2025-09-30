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
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="text"
            placeholder={placeholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardContent>
    </Card>
  );
};
