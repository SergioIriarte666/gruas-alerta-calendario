
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
                                className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400 focus:border-tms-green"
                            />
                        </div>
                    </div>
                    <Button variant="outline" className="border-gray-700 text-gray-300 hover:text-white">
                        <Filter className="w-4 h-4 mr-2" />
                        Filtros
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
