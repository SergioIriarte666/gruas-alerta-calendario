
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface OperatorsFiltersProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
}

export const OperatorsFilters = ({ searchTerm, setSearchTerm }: OperatorsFiltersProps) => {
    return (
        <Card className="glass-card">
            <CardContent className="p-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                        placeholder="Buscar por nombre, RUT, teléfono o licencia..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400"
                    />
                </div>
            </CardContent>
        </Card>
    );
};
