
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar, FilterX, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCostCategories } from '@/hooks/useCostCategories';
import { ReportFilters as ReportFiltersType } from '@/hooks/useReports';
import { toTitleCase } from '@/lib/utils';

interface ServiceReportFilters {
  dateRange: { from: string; to: string };
  clientId: string;
}

interface CostReportFilters {
  dateRange: { from: string; to: string };
  categoryId: string;
  craneId: string;
  operatorId: string;
}

interface ReportFiltersProps {
  filters: ReportFiltersType;
  onDateChange: (field: 'from' | 'to', value: string) => void;
  onFilterChange: (field: 'clientId' | 'department' | 'craneId' | 'operatorId' | 'costCategoryId', value: string) => void;
  onUpdate: () => void;
  onClear: () => void;
  serviceReportFilters: ServiceReportFilters;
  onServiceReportDateChange: (field: 'from' | 'to', value: string) => void;
  onServiceReportFilterChange: (field: 'clientId', value: string) => void;
  costReportFilters: CostReportFilters;
  onCostReportDateChange: (field: 'from' | 'to', value: string) => void;
  onCostReportFilterChange: (field: 'categoryId' | 'craneId' | 'operatorId', value: string) => void;
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
  costReportFilters,
  onCostReportDateChange,
  onCostReportFilterChange,
}: ReportFiltersProps) => {
    const { clients, loading: clientsLoading } = useClients();
    const { cranes, loading: cranesLoading } = useCranes();
    const { data: operators = [], isLoading: operatorsLoading } = useOperatorsData();
    const { data: costCategories = [], isLoading: costCategoriesLoading } = useCostCategories();
    const departments = React.useMemo(
      () => Array.from(new Set(clients.map(c => c.department).filter(Boolean))).sort(),
      [clients]
    );

    return (
      <>
        <Card className="bg-card border">
            <CardHeader>
                <CardTitle className="text-foreground flex items-center">
                    <Calendar className="w-5 h-5 mr-2" />
                    Filtros de Métricas
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <Label htmlFor="from-date" className="text-foreground">Fecha Inicio</Label>
                        <DatePickerInput
                            id="from-date"
                            value={filters.dateRange.from}
                            onChange={(value) => onDateChange('from', value)}
                            placeholder="Fecha inicio"
                        />
                    </div>
                    <div>
                        <Label htmlFor="to-date" className="text-foreground">Fecha Fin</Label>
                        <DatePickerInput
                            id="to-date"
                            value={filters.dateRange.to}
                            onChange={(value) => onDateChange('to', value)}
                            placeholder="Fecha fin"
                        />
                    </div>
                    
                    <div>
                        <Label htmlFor="client-filter" className="text-foreground">Cliente</Label>
                        <Select value={filters.clientId} onValueChange={(v) => onFilterChange('clientId', v)} disabled={clientsLoading}>
                            <SelectTrigger 
                                id="client-filter" 
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all" 
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                >
                                    Todos los clientes
                                </SelectItem>
                                {clients.map(client => (
                                    <SelectItem 
                                        key={client.id} 
                                        value={client.id}
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                    >
                                        {toTitleCase(client.name)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="department-filter" className="text-white">Departamento</Label>
                        <Select value={filters.department} onValueChange={(v) => onFilterChange('department', v)} disabled={clientsLoading}>
                            <SelectTrigger 
                                id="department-filter" 
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                >
                                    Todos los departamentos
                                </SelectItem>
                                {departments.map(dep => (
                                    <SelectItem 
                                        key={dep} 
                                        value={dep}
                                        className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                    >
                                        {dep}
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
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                >
                                    Todas las grúas
                                </SelectItem>
                                {cranes.map(crane => (
                                    <SelectItem 
                                        key={crane.id} 
                                        value={crane.id}
                                        className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                    >
                                        {`${crane.brand} ${crane.model} (${crane.licensePlate})`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    
                    <div>
                        <Label htmlFor="operator-filter" className="text-foreground">Operador</Label>
                        <Select value={filters.operatorId} onValueChange={(v) => onFilterChange('operatorId', v)} disabled={operatorsLoading}>
                            <SelectTrigger 
                                id="operator-filter" 
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                >
                                    Todos los operadores
                                </SelectItem>
                                {operators.map(operator => (
                                    <SelectItem 
                                        key={operator.id} 
                                        value={operator.id}
                                        className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
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
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                >
                                    Todas las categorías
                                </SelectItem>
                                {costCategories.map(category => (
                                    <SelectItem 
                                        key={category.id} 
                                        value={category.id}
                                        className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
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
                            className="text-foreground border-input hover:bg-muted/50 hover:text-foreground px-3"
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

        <Card className="bg-card border mt-6">
            <CardHeader>
                <CardTitle className="text-foreground flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Filtros para Informe de Servicios
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div>
                        <Label htmlFor="sr-from-date" className="text-foreground">Fecha Inicio</Label>
                        <DatePickerInput
                            id="sr-from-date"
                            value={serviceReportFilters.dateRange.from}
                            onChange={(value) => onServiceReportDateChange('from', value)}
                            placeholder="Fecha inicio"
                        />
                    </div>
                    <div>
                        <Label htmlFor="sr-to-date" className="text-foreground">Fecha Fin</Label>
                        <DatePickerInput
                            id="sr-to-date"
                            value={serviceReportFilters.dateRange.to}
                            onChange={(value) => onServiceReportDateChange('to', value)}
                            placeholder="Fecha fin"
                        />
                    </div>
                    <div>
                        <Label htmlFor="sr-client-filter" className="text-foreground">Cliente</Label>
                        <Select value={serviceReportFilters.clientId} onValueChange={(v) => onServiceReportFilterChange('clientId', v)} disabled={clientsLoading}>
                            <SelectTrigger 
                                id="sr-client-filter" 
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                >
                                    Todos los clientes
                                </SelectItem>
                                {clients.map(client => (
                                    <SelectItem 
                                        key={client.id} 
                                        value={client.id}
                                        className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                    >
                                        {toTitleCase(client.name)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="bg-card border mt-6">
            <CardHeader>
                <CardTitle className="text-foreground flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Filtros para Informe de Costos
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div>
                        <Label htmlFor="cr-from-date" className="text-foreground">Fecha Inicio</Label>
                        <DatePickerInput
                            id="cr-from-date"
                            value={costReportFilters.dateRange.from}
                            onChange={(value) => onCostReportDateChange('from', value)}
                            placeholder="Fecha inicio"
                        />
                    </div>
                    <div>
                        <Label htmlFor="cr-to-date" className="text-foreground">Fecha Fin</Label>
                        <DatePickerInput
                            id="cr-to-date"
                            value={costReportFilters.dateRange.to}
                            onChange={(value) => onCostReportDateChange('to', value)}
                            placeholder="Fecha fin"
                        />
                    </div>
                    <div>
                        <Label htmlFor="cr-category-filter" className="text-foreground">Categoría</Label>
                        <Select value={costReportFilters.categoryId} onValueChange={(v) => onCostReportFilterChange('categoryId', v)} disabled={costCategoriesLoading}>
                            <SelectTrigger 
                                id="cr-category-filter" 
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
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
                    <div>
                        <Label htmlFor="cr-crane-filter" className="text-foreground">Grúa</Label>
                        <Select value={costReportFilters.craneId} onValueChange={(v) => onCostReportFilterChange('craneId', v)} disabled={cranesLoading}>
                            <SelectTrigger 
                                id="cr-crane-filter" 
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todas" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                >
                                    Todas las grúas
                                </SelectItem>
                                {cranes.map(crane => (
                                    <SelectItem 
                                        key={crane.id} 
                                        value={crane.id}
                                        className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                    >
                                        {`${crane.brand} ${crane.model} (${crane.licensePlate})`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="cr-operator-filter" className="text-foreground">Operador</Label>
                        <Select value={costReportFilters.operatorId} onValueChange={(v) => onCostReportFilterChange('operatorId', v)} disabled={operatorsLoading}>
                            <SelectTrigger 
                                id="cr-operator-filter" 
                                className="bg-background border-input text-foreground"
                            >
                                <SelectValue placeholder="Todos" />
                            </SelectTrigger>
                            <SelectContent 
                                className="bg-popover border-input text-foreground z-50"
                            >
                                <SelectItem 
                                    value="all"
                                    className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                >
                                    Todos los operadores
                                </SelectItem>
                                {operators.map(operator => (
                                    <SelectItem 
                                        key={operator.id} 
                                        value={operator.id}
                                        className="text-foreground hover:bg-muted/50 focus:bg-muted/50"
                                    >
                                        {operator.name}
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
