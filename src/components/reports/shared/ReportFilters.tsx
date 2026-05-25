import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FilterX, ChevronDown } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useCostCategories } from '@/hooks/useCostCategories';
import { ReportFilters as ReportFiltersType } from '@/hooks/useReports';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  onFilterChange: (field: 'clientId' | 'craneId' | 'operatorId' | 'costCategoryId', value: string) => void;
  onUpdate: () => void;
  onClear: () => void;
  serviceReportFilters: ServiceReportFilters;
  onServiceReportDateChange: (field: 'from' | 'to', value: string) => void;
  onServiceReportFilterChange: (field: 'clientId', value: string) => void;
  costReportFilters: CostReportFilters;
  onCostReportDateChange: (field: 'from' | 'to', value: string) => void;
  onCostReportFilterChange: (field: 'categoryId' | 'craneId' | 'operatorId', value: string) => void;
  sections?: ('metrics' | 'services' | 'costs')[];
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
  sections = ['metrics', 'services', 'costs'],
}: ReportFiltersProps) => {
    const { clients, loading: clientsLoading } = useClients();
    const { cranes, loading: cranesLoading } = useCranes();
    const { data: operators = [], isLoading: operatorsLoading } = useOperatorsData();
    const { data: costCategories = [], isLoading: costCategoriesLoading } = useCostCategories();

    return (
      <div className="space-y-3">
        {sections.includes('metrics') && (
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-foreground">Filtros de Métricas</span>
              <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 bg-card border rounded-lg">
                <div>
                  <Label htmlFor="from-date" className="text-foreground text-xs">Fecha Inicio</Label>
                  <DatePickerInput id="from-date" value={filters.dateRange.from} onChange={(value) => onDateChange('from', value)} placeholder="Fecha inicio" />
                </div>
                <div>
                  <Label htmlFor="to-date" className="text-foreground text-xs">Fecha Fin</Label>
                  <DatePickerInput id="to-date" value={filters.dateRange.to} onChange={(value) => onDateChange('to', value)} placeholder="Fecha fin" />
                </div>
                <div>
                  <Label htmlFor="client-filter" className="text-foreground text-xs">Cliente</Label>
                  <Select value={filters.clientId} onValueChange={(v) => onFilterChange('clientId', v)} disabled={clientsLoading}>
                    <SelectTrigger id="client-filter"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {clients.filter(c => c.isActive).map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex flex-col py-0.5">
                            <span className="font-medium">{toTitleCase(client.name)}</span>
                            {client.department && client.department !== 'General' && (
                              <span className="text-xs text-violet-600 dark:text-violet-400">{client.department}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="crane-filter" className="text-foreground text-xs">Grúa</Label>
                  <Select value={filters.craneId} onValueChange={(v) => onFilterChange('craneId', v)} disabled={cranesLoading}>
                    <SelectTrigger id="crane-filter"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las grúas</SelectItem>
                      {cranes.map(crane => (
                        <SelectItem key={crane.id} value={crane.id}>{`${crane.brand} ${crane.model} (${crane.licensePlate})`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="operator-filter" className="text-foreground text-xs">Operador</Label>
                  <Select value={filters.operatorId} onValueChange={(v) => onFilterChange('operatorId', v)} disabled={operatorsLoading}>
                    <SelectTrigger id="operator-filter"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los operadores</SelectItem>
                      {operators.map(operator => (
                        <SelectItem key={operator.id} value={operator.id}>{operator.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={onUpdate} className="flex-1" size="sm">Actualizar</Button>
                  <Button onClick={onClear} variant="outline" size="sm" className="px-3">
                    <FilterX className="size-4" />
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {sections.includes('services') && (
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-foreground">Filtros de Servicios</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end p-4 bg-card border rounded-lg">
                <div>
                  <Label htmlFor="sr-from-date" className="text-foreground text-xs">Fecha Inicio</Label>
                  <DatePickerInput id="sr-from-date" value={serviceReportFilters.dateRange.from} onChange={(value) => onServiceReportDateChange('from', value)} placeholder="Fecha inicio" />
                </div>
                <div>
                  <Label htmlFor="sr-to-date" className="text-foreground text-xs">Fecha Fin</Label>
                  <DatePickerInput id="sr-to-date" value={serviceReportFilters.dateRange.to} onChange={(value) => onServiceReportDateChange('to', value)} placeholder="Fecha fin" />
                </div>
                <div>
                  <Label htmlFor="sr-client-filter" className="text-foreground text-xs">Cliente</Label>
                  <Select value={serviceReportFilters.clientId} onValueChange={(v) => onServiceReportFilterChange('clientId', v)} disabled={clientsLoading}>
                    <SelectTrigger id="sr-client-filter"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los clientes</SelectItem>
                      {clients.filter(c => c.isActive).map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex flex-col py-0.5">
                            <span className="font-medium">{toTitleCase(client.name)}</span>
                            {client.department && client.department !== 'General' && (
                              <span className="text-xs text-violet-600 dark:text-violet-400">{client.department}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {sections.includes('costs') && (
          <Collapsible defaultOpen={false}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-card border rounded-lg hover:bg-muted/50 transition-colors">
              <span className="text-sm font-medium text-foreground">Filtros de Costos</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 bg-card border rounded-lg">
                <div>
                  <Label htmlFor="cr-from-date" className="text-foreground text-xs">Fecha Inicio</Label>
                  <DatePickerInput id="cr-from-date" value={costReportFilters.dateRange.from} onChange={(value) => onCostReportDateChange('from', value)} placeholder="Fecha inicio" />
                </div>
                <div>
                  <Label htmlFor="cr-to-date" className="text-foreground text-xs">Fecha Fin</Label>
                  <DatePickerInput id="cr-to-date" value={costReportFilters.dateRange.to} onChange={(value) => onCostReportDateChange('to', value)} placeholder="Fecha fin" />
                </div>
                <div>
                  <Label htmlFor="cr-category-filter" className="text-foreground text-xs">Categoría</Label>
                  <Select value={costReportFilters.categoryId} onValueChange={(v) => onCostReportFilterChange('categoryId', v)} disabled={costCategoriesLoading}>
                    <SelectTrigger id="cr-category-filter"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {costCategories.map(category => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cr-crane-filter" className="text-foreground text-xs">Grúa</Label>
                  <Select value={costReportFilters.craneId} onValueChange={(v) => onCostReportFilterChange('craneId', v)} disabled={cranesLoading}>
                    <SelectTrigger id="cr-crane-filter"><SelectValue placeholder="Todas" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las grúas</SelectItem>
                      {cranes.map(crane => (
                        <SelectItem key={crane.id} value={crane.id}>{`${crane.brand} ${crane.model} (${crane.licensePlate})`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cr-operator-filter" className="text-foreground text-xs">Operador</Label>
                  <Select value={costReportFilters.operatorId} onValueChange={(v) => onCostReportFilterChange('operatorId', v)} disabled={operatorsLoading}>
                    <SelectTrigger id="cr-operator-filter"><SelectValue placeholder="Todos" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los operadores</SelectItem>
                      {operators.map(operator => (
                        <SelectItem key={operator.id} value={operator.id}>{operator.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    );
};
