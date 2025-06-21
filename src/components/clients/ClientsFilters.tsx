
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter } from 'lucide-react';

interface ClientsFiltersProps {
    searchTerm: string;
    setSearchTerm: (value: string) => void;
}

export const ClientsFilters = ({ searchTerm, setSearchTerm }: ClientsFiltersProps) => {
    return (
        <Card className="glass-card">
            <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                                placeholder="Buscar por nombre, RUT o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 bg-black/80 border-tms-green/30 text-white placeholder-white/70 focus:border-tms-green focus:ring-tms-green"
                            />
                        </div>
                    </div>
                    <Button 
                        variant="outline" 
                        className="border-tms-green/50 text-white hover:bg-tms-green hover:text-black transition-colors"
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filtros
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
