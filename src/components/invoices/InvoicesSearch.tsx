
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface InvoicesSearchProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

const InvoicesSearch = ({ searchTerm, onSearchChange }: InvoicesSearchProps) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground size-4" />
      <Input
        type="text"
        placeholder="Buscar por folio, número fiscal o cliente..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-10 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
      />
    </div>
  );
};

export default InvoicesSearch;
