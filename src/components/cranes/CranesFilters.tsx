
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface CranesFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
}

export const CranesFilters = ({ searchTerm, setSearchTerm }: CranesFiltersProps) => {
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Buscar por patente, marca o modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-black border-tms-green/30 text-white placeholder-gray-400 focus:border-tms-green focus:outline-none"
            style={{
              backgroundColor: '#000000',
              borderColor: 'rgba(156, 250, 36, 0.3)',
              color: '#ffffff'
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
};
