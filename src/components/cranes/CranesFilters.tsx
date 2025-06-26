
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
            className="pl-10 bg-gray-800 border-gray-600 text-white placeholder:text-gray-500 focus:border-tms-green focus:ring-tms-green"
          />
        </div>
      </CardContent>
    </Card>
  );
};
