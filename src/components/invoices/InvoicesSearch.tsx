
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

interface InvoicesSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const InvoicesSearch = ({ searchTerm, onSearchChange }: InvoicesSearchProps) => {
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por folio o cliente..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoicesSearch;
