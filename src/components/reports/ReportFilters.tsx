
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, FilterX, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCostCategories } from '@/hooks/useCostCategories';
import { ReportFilters as ReportFiltersType } from '@/hooks/useReports';

interface ServiceReportFilters {
  dateRange: { from: string; to: string };
  clientId: string;
}

interface ReportFiltersProps {
  filters: ReportFiltersType;
  onDateChange: (field: 'from' | 'to', value: string) => void;
  onFilterChange: (field: 'clientId' | 'craneId' | 'operatorId' | 'costCategoryId', value: string) => void;
  onUpdate: () => void;
  onClear: () => void;
  serviceReportFilters: ServiceReportFilters;
  onServiceReportDateChange: (field: 'from' | 'to', value: string) => void;
  onServiceReportFilterChange: (field: 'clientId', value: string) => void;
}

export const ReportFilters = ({ 
  filters, 
  onDateChange, 
  onFilterChange, 
  onUpdate, 
  onClear,
  serviceReportFilters,
  onServiceReportDateChange,
  onServiceReportFilterChange,
}: ReportFiltersProps) => {
    const { clients, loading: clientsLoading } = useClients();
    const { cranes, loading: cranesLoading } = useCranes();
    const { data: operators = [], isLoading: operatorsLoading } = useOperatorsData();
    const { data: costCategories = [], isLoading: costCategoriesLoading } = useCostCategories();

    return (
      <>
        <Card className="bg-white/10 border-white/20">
            <CardHeader>
                <CardTitle className="text-white flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Filtros de Métricas
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <Label htmlFor="from-date" className="text-white">Fecha Inicio</Label>
                        <Input
                            id="from-date"
                            type="date"
                            value={filters.dateRange.from}
                            onChange={(e) => onDateChange('from', e.target.value)}
                            className="bg-black border-tms-green/30 text-white"
                            style={{
                                backgroundColor: '#000000',
                                borderColor: 'rgba(156, 250, 36, 0.3)',
                                color: '#ffffff'
                            }}
                        />
                    </div>
                    <div>
                        <Label htmlFor="to-date" className="text-white">Fecha Fin</Label>
                        <Input
                            id="to-date"
                            type="date"
                            value={filters.dateRange.to}
                            onChange={(e) => onDateChange('to', e.target.value)}
                            className="bg-black border-tms-green/30 text-white"
                            style={{
                                backgroundColor: '#000000',
                                borderColor: 'rgba(156, 250, 36, 0.3)',
                                color: '#ffffff'
                            }}
                        />
                    </div>
                    
                    <div>
                        <Label htmlFor="client-filter" className="text-white">Cliente</Label>
                        <Select value={filters.clientId} onValueChange={(v) => onFilterChange('clientId', v)} disabled={clientsLoading}>
                            <SelectTrigger 
                                id="client-filter" 
                                className="bg-black border-tms-green/30 text-white"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: 'rgba(156, 250, 36, 0.3)',
                                    color: '#ffffff'
                                }}
                            >
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-black border-tms-green text-white z-50"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: '#9cfa24',
                                    color: '#ffffff',
                                    zIndex: 50
                                }}
                            >
                                <SelectItem 
                                    value="all" 
                                    className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                    style={{ color: '#ffffff' }}
                                >
                                    Todos los clientes
                                </SelectItem>
                                {clients.map(client => (
                                    <SelectItem 
                                        key={client.id} 
                                        value={client.id}
                                        className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                        style={{ color: '#ffffff' }}
                                    >
                                        {client.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="crane-filter" className="text-white">Grúa</Label>
                        <Select value={filters.craneId} onValueChange={(v) => onFilterChange('craneId', v)} disabled={cranesLoading}>
                            <SelectTrigger 
                                id="crane-filter" 
                                className="bg-black border-tms-green/30 text-white"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: 'rgba(156, 250, 36, 0.3)',
                                    color: '#ffffff'
                                }}
                            >
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-black border-tms-green text-white z-50"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: '#9cfa24',
                                    color: '#ffffff',
                                    zIndex: 50
                                }}
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                    style={{ color: '#ffffff' }}
                                >
                                    Todas las grúas
                                </SelectItem>
                                {cranes.map(crane => (
                                    <SelectItem 
                                        key={crane.id} 
                                        value={crane.id}
                                        className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                        style={{ color: '#ffffff' }}
                                    >
                                        {`${crane.brand} ${crane.model} (${crane.licensePlate})`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div>
                        <Label htmlFor="operator-filter" className="text-white">Operador</Label>
                        <Select value={filters.operatorId} onValueChange={(v) => onFilterChange('operatorId', v)} disabled={operatorsLoading}>
                            <SelectTrigger 
                                id="operator-filter" 
                                className="bg-black border-tms-green/30 text-white"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: 'rgba(156, 250, 36, 0.3)',
                                    color: '#ffffff'
                                }}
                            >
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-black border-tms-green text-white z-50"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: '#9cfa24',
                                    color: '#ffffff',
                                    zIndex: 50
                                }}
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                    style={{ color: '#ffffff' }}
                                >
                                    Todos los operadores
                                </SelectItem>
                                {operators.map(operator => (
                                    <SelectItem 
                                        key={operator.id} 
                                        value={operator.id}
                                        className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                        style={{ color: '#ffffff' }}
                                    >
                                        {operator.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="cost-category-filter" className="text-white">Categoría de Costo</Label>
                        <Select value={filters.costCategoryId} onValueChange={(v) => onFilterChange('costCategoryId', v)} disabled={costCategoriesLoading}>
                            <SelectTrigger 
                                id="cost-category-filter" 
                                className="bg-black border-tms-green/30 text-white"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: 'rgba(156, 250, 36, 0.3)',
                                    color: '#ffffff'
                                }}
                            >
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-black border-tms-green text-white z-50"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: '#9cfa24',
                                    color: '#ffffff',
                                    zIndex: 50
                                }}
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                    style={{ color: '#ffffff' }}
                                >
                                    Todas las categorías
                                </SelectItem>
                                {costCategories.map(category => (
                                    <SelectItem 
                                        key={category.id} 
                                        value={category.id}
                                        className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                        style={{ color: '#ffffff' }}
                                    >
                                        {category.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex gap-2 lg:col-start-4">
                        <Button 
                            onClick={onUpdate} 
                            className="bg-tms-green hover:bg-tms-green/90 text-black flex-1"
                            style={{
                                backgroundColor: '#9cfa24',
                                color: '#000000'
                            }}
                        >
                            Actualizar
                        </Button>
                        <Button 
                            onClick={onClear} 
                            variant="outline" 
                            className="text-white border-white/30 hover:bg-white/10 hover:text-white px-3"
                            style={{
                                color: '#ffffff',
                                borderColor: 'rgba(255, 255, 255, 0.3)'
                            }}
                        >
                            <FilterX className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20 mt-6">
            <CardHeader>
                <CardTitle className="text-white flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Filtros para Informe de Servicios
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div>
                        <Label htmlFor="sr-from-date" className="text-white">Fecha Inicio</Label>
                        <Input
                            id="sr-from-date"
                            type="date"
                            value={serviceReportFilters.dateRange.from}
                            onChange={(e) => onServiceReportDateChange('from', e.target.value)}
                            className="bg-black border-tms-green/30 text-white"
                            style={{
                                backgroundColor: '#000000',
                                borderColor: 'rgba(156, 250, 36, 0.3)',
                                color: '#ffffff'
                            }}
                        />
                    </div>
                    <div>
                        <Label htmlFor="sr-to-date" className="text-white">Fecha Fin</Label>
                        <Input
                            id="sr-to-date"
                            type="date"
                            value={serviceReportFilters.dateRange.to}
                            onChange={(e) => onServiceReportDateChange('to', e.target.value)}
                            className="bg-black border-tms-green/30 text-white"
                            style={{
                                backgroundColor: '#000000',
                                borderColor: 'rgba(156, 250, 36, 0.3)',
                                color: '#ffffff'
                            }}
                        />
                    </div>
                    <div>
                        <Label htmlFor="sr-client-filter" className="text-white">Cliente</Label>
                        <Select value={serviceReportFilters.clientId} onValueChange={(v) => onServiceReportFilterChange('clientId', v)} disabled={clientsLoading}>
                            <SelectTrigger 
                                id="sr-client-filter" 
                                className="bg-black border-tms-green/30 text-white"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: 'rgba(156, 250, 36, 0.3)',
                                    color: '#ffffff'
                                }}
                            >
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-black border-tms-green text-white z-50"
                                style={{
                                    backgroundColor: '#000000',
                                    borderColor: '#9cfa24',
                                    color: '#ffffff',
                                    zIndex: 50
                                }}
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                    style={{ color: '#ffffff' }}
                                >
                                    Todos los clientes
                                </SelectItem>
                                {clients.map(client => (
                                    <SelectItem 
                                        key={client.id} 
                                        value={client.id}
                                        className="text-white hover:bg-tms-green/20 focus:bg-tms-green/20"
                                        style={{ color: '#ffffff' }}
                                    >
                                        {client.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>
      </>
    );
};
