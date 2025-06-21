
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface ClientsFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export const ClientsFilters = ({ searchTerm, setSearchTerm }: ClientsFiltersProps) => {
  return (
    <Card className="glass-card tms-text-white">
      <CardContent className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar por nombre, RUT o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-black border-tms-green/30 text-white placeholder:text-white/70 focus:border-tms-green focus:outline-none"
          />
        </div>
      </CardContent>
    </Card>
  );
};
