
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface InvoicesSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const InvoicesSearch = ({ searchTerm, onSearchChange }: InvoicesSearchProps) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
      <Input
        type="text"
        placeholder="Buscar por folio o cliente..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-10 bg-black border-tms-green/30 text-white placeholder-gray-400 focus:border-tms-green focus:outline-none"
        style={{
          backgroundColor: '#000000',
          borderColor: 'rgba(156, 250, 36, 0.3)',
          color: '#ffffff'
        }}
      />
    </div>
  );
};

export default InvoicesSearch;
