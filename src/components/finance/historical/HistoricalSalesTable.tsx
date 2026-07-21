import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Invoice } from '@/types';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Edit, ArrowUpDown, ArrowUp, ArrowDown, FileText, Trash2, Lock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SourceBadge } from './SourceBadge';
import { formatRut } from '@/utils/rutFormatter';

export type SortKey = 'issueDate' | 'total' | 'client' | 'status' | 'folio';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

interface HistoricalSalesTableProps {
  invoices: Invoice[];
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  onEdit: (invoice: Invoice) => void;
  onDelete?: (id: string) => void;
  hideClientColumn?: boolean;
  selectedIds?: string[];
  onSelectId?: (id: string, checked: boolean) => void;
  onSelectAll?: (ids: string[], checked: boolean) => void;
}

const statusColors: Record<string, string> = {
  paid: 'bg-success-soft text-success-text border-success hover:bg-success/90',
  sent: 'bg-info-soft text-info-text border-info hover:bg-info/90',
  overdue: 'bg-danger-soft text-danger-text border-danger hover:bg-danger/90',
  draft: 'bg-muted text-foreground border-border hover:bg-muted/80',
  cancelled: 'bg-muted text-muted-foreground border-border line-through hover:bg-muted/80',
};

const statusLabels: Record<string, string> = {
  paid: 'Pagada',
  sent: 'Enviada',
  overdue: 'Vencida',
  draft: 'Borrador',
  cancelled: 'Anulada',
};

export const HistoricalSalesTable = ({
  invoices,
  sortConfig,
  onSort,
  onEdit,
  onDelete,
  hideClientColumn = false,
  selectedIds = [],
  onSelectId,
  onSelectAll,
}: HistoricalSalesTableProps) => {
  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 size-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="ml-2 size-3 text-primary" /> : 
      <ArrowDown className="ml-2 size-3 text-primary" />;
  };

  const _SortableHead = ({ columnKey, label, className }: { columnKey: SortKey, label: string, className?: string }) => (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(columnKey)}
        className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
      >
        {label}
        <SortIcon columnKey={columnKey} />
      </Button>
    </TableHead>
  );

  return (
    <div className="rounded-md border shadow-sm bg-card overflow-x-auto">
      <Table className="min-w-[56rem]">
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={invoices.length > 0 && invoices.every((inv) => selectedIds.includes(inv.id))}
                onCheckedChange={(checked) => onSelectAll?.(invoices.map((inv) => inv.id), !!checked)}
                aria-label="Seleccionar todo"
              />
            </TableHead>
            <TableHead className="w-36">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('folio')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                N° Fiscal
                <SortIcon columnKey="folio" />
              </Button>
            </TableHead>
            
            {!hideClientColumn && (
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSort('client')}
                  className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
                >
                  Cliente
                  <SortIcon columnKey="client" />
                </Button>
              </TableHead>
            )}

            {!hideClientColumn && <TableHead className="w-36">RUT</TableHead>}

            <TableHead className="min-w-64 max-w-sm whitespace-nowrap">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="-ml-4 h-8 w-full justify-start font-semibold hover:bg-transparent hover:text-primary disabled:opacity-100"
                disabled
                title="Descripción de Producto o Servicio"
              >
                <span className="block truncate">Descripción de Producto o Servicio</span>
              </Button>
            </TableHead>

            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('issueDate')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                Fecha Emisión
                <SortIcon columnKey="issueDate" />
              </Button>
            </TableHead>

            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('total')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                Monto
                <SortIcon columnKey="total" />
              </Button>
            </TableHead>

            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('status')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                Estado
                <SortIcon columnKey="status" />
              </Button>
            </TableHead>

            <TableHead className="text-right w-20">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hideClientColumn ? 7 : 9} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileText className="size-8 text-muted-foreground/30" />
                  <p>No se encontraron registros.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice, index) => (
              <TableRow 
                key={invoice.id} 
                className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(invoice.id)}
                    onCheckedChange={(checked) => onSelectId?.(invoice.id, !!checked)}
                    aria-label={`Seleccionar factura ${invoice.folio}`}
                  />
                </TableCell>
                <TableCell className="font-medium font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const docType = invoice.folio.startsWith('HIST-NC-') ? 'NC'
                        : invoice.folio.startsWith('HIST-ND-') ? 'ND'
                        : 'FE';
                      const badgeStyles = docType === 'NC'
                        ? 'bg-warning-soft text-warning-text border-warning'
                        : docType === 'ND'
                        ? 'bg-warning-soft text-warning-text border-warning'
                        : 'bg-muted text-muted-foreground border-border';
                      return (
                        <Badge variant="outline" className={`${badgeStyles} text-xs px-1.5 py-0 font-semibold`}>
                          {docType}
                        </Badge>
                      );
                    })()}
                    {invoice.numeroFiscal || invoice.folio}
                    <SourceBadge source={invoice.source} />
                  </div>
                </TableCell>
                
                {!hideClientColumn && (
                  <TableCell className="font-medium text-foreground/80">
                      {toTitleCase(invoice.client?.name || 'Cliente Desconocido')}
                  </TableCell>
                )}

                {!hideClientColumn && (
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {invoice.client?.rut ? formatRut(invoice.client.rut) : '—'}
                  </TableCell>
                )}

                <TableCell className="text-muted-foreground text-sm max-w-xs">
                  <span className="block truncate" title={invoice.productServiceDescription}>
                    {invoice.productServiceDescription}
                  </span>
                </TableCell>

                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(invoice.issueDate), 'dd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell className="font-semibold text-sm">
                    {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`${statusColors[invoice.status] || 'bg-muted'} px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide border`}
                  >
                    {statusLabels[invoice.status] || invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right flex items-center justify-end gap-1">
                {invoice.source !== 'historico' && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="size-3.5 text-warning-text mr-1" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-48 text-xs">
                        Factura del sistema — edición limitada a notas y metadatos
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground hover:text-primary"
                  onClick={() => onEdit(invoice)}
                  title="Ver detalles / Editar"
                >
                  <Edit className="size-4" />
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(invoice.id)}
                    title="Eliminar factura"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
