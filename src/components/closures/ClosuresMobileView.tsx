import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit, Trash2, Eye, FileText, Calendar, DollarSign, FolderOpen } from 'lucide-react';
import { ClosureStatusBadge } from './ClosureStatusBadge';
import { ServiceClosure, Client } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { cn, toTitleCase } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ClosureSortField, SortDirection } from './closureSort';

interface ClosuresMobileViewProps {
  closures: ServiceClosure[];
  clients: Client[];
  onEdit: (closure: ServiceClosure) => void;
  onDelete: (id: string, folio: string) => void;
  onClose: (id: string, folio: string) => void;
  onViewDetails: (closure: ServiceClosure) => void;
  sortField?: ClosureSortField | null;
  sortDirection?: SortDirection;
  onSortSelect?: (field: ClosureSortField, direction: SortDirection) => void;
}

const SORT_OPTIONS: { value: string; label: string; field: ClosureSortField; direction: SortDirection }[] = [
  { value: 'dateFrom-desc', label: 'Período (más reciente)', field: 'dateFrom', direction: 'desc' },
  { value: 'dateFrom-asc', label: 'Período (más antiguo)', field: 'dateFrom', direction: 'asc' },
  { value: 'folio-desc', label: 'Folio (mayor a menor)', field: 'folio', direction: 'desc' },
  { value: 'folio-asc', label: 'Folio (menor a mayor)', field: 'folio', direction: 'asc' },
  { value: 'serviceCount-desc', label: 'Servicios (mayor a menor)', field: 'serviceCount', direction: 'desc' },
  { value: 'serviceCount-asc', label: 'Servicios (menor a mayor)', field: 'serviceCount', direction: 'asc' },
  { value: 'total-desc', label: 'Total (mayor a menor)', field: 'total', direction: 'desc' },
  { value: 'total-asc', label: 'Total (menor a mayor)', field: 'total', direction: 'asc' },
  { value: 'status-asc', label: 'Estado', field: 'status', direction: 'asc' },
];

export const ClosuresMobileView = ({
  closures,
  clients,
  onEdit,
  onDelete,
  onClose,
  onViewDetails,
  sortField,
  sortDirection,
  onSortSelect,
}: ClosuresMobileViewProps) => {
  const { isMobile } = useDeviceType();
  const currentSortValue = sortField ? `${sortField}-${sortDirection ?? 'desc'}` : 'dateFrom-desc';

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clients.find(c => c.id === clientId);
    return client ? toTitleCase(client.name) : 'Cliente desconocido';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  if (closures.length === 0) {
    return (
      <Card className="bg-card border">
        <CardContent className="p-6 text-center">
          <FolderOpen className="mx-auto size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron cierres</h3>
          <p className="text-muted-foreground">
            No hay cierres que mostrar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-lg font-semibold text-foreground">Cierres ({closures.length})</h3>
        {onSortSelect && (
          <Select
            value={currentSortValue}
            onValueChange={(value) => {
              const option = SORT_OPTIONS.find(o => o.value === value);
              if (option) onSortSelect(option.field, option.direction);
            }}
          >
            <SelectTrigger className="h-9 w-[190px] border-border/70 bg-background/70 text-foreground">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent className="bg-background border-border">
              {SORT_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value} className="text-foreground hover:bg-muted">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {closures.map((closure) => (
        <Card key={closure.id} className="bg-card border" onClick={() => onViewDetails(closure)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-lg">{closure.folio}</h4>
                <p className="text-primary text-sm font-medium">{getClientName(closure.clientId)}</p>
              </div>
              <ClosureStatusBadge status={closure.status} />
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-foreground text-sm">
                <Calendar className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>
                  {formatForDisplay(closure.dateRange.from)} - {formatForDisplay(closure.dateRange.to)}
                </span>
              </div>

              <div className="flex items-center text-foreground text-sm">
                <FileText className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>{closure.serviceCount ?? closure.serviceIds.length} servicios</span>
              </div>

              <div className="flex items-center text-foreground text-sm font-medium">
                <DollarSign className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>{formatCurrency(closure.total)}</span>
              </div>
            </div>

            <div className={cn(
              "flex gap-2 mt-4",
              isMobile ? "flex-col" : "flex-wrap"
            )} onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => onViewDetails(closure)}
                className={cn(isMobile ? "w-full" : "flex-1")}
              >
                <Eye className="size-4 mr-1" />
                Ver
              </Button>
              
              {closure.status === 'open' && (
                <Button
                  variant="outline"
                  size={isMobile ? "default" : "sm"}
                  onClick={() => onClose(closure.id, closure.folio)}
                  className={cn(isMobile ? "w-full" : "flex-1")}
                >
                  <FileText className="size-4 mr-1" />
                  Cerrar
                </Button>
              )}
              
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => onEdit(closure)}
                className={cn(isMobile ? "w-full" : "flex-1")}
              >
                <Edit className="size-4 mr-1" />
                Editar
              </Button>
              
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => onDelete(closure.id, closure.folio)}
                className={cn(
                  "text-destructive border-destructive/40 hover:bg-destructive/10",
                  isMobile ? "w-full" : "px-3"
                )}
              >
                <Trash2 className="size-4" />
                {isMobile && <span className="ml-1">Eliminar</span>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
