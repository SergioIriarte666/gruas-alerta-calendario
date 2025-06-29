
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface ClosuresSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const ClosuresSearch = ({ searchTerm, onSearchChange }: ClosuresSearchProps) => {
  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por folio o estado..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ClosuresSearch;
