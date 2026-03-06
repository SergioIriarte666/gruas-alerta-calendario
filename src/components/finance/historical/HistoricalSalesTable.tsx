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
import { Edit, ArrowUpDown, ArrowUp, ArrowDown, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
  onSelectAll?: (checked: boolean) => void;
}

const statusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100',
  sent: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100',
  overdue: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
  draft: 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-100',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200 line-through hover:bg-gray-100',
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
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : 
      <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

  const SortableHead = ({ columnKey, label, className }: { columnKey: SortKey, label: string, className?: string }) => (
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
    <div className="rounded-md border shadow-sm bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={invoices.length > 0 && invoices.every((inv) => selectedIds.includes(inv.id))}
                onCheckedChange={(checked) => onSelectAll?.(!!checked)}
                aria-label="Seleccionar todo"
              />
            </TableHead>
            <TableHead className="w-[140px]">
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

            <TableHead className="text-right w-[80px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={hideClientColumn ? 6 : 7} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
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
                    {invoice.folio}
                    {invoice.folio.startsWith('HIST-') ? (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] px-1.5 py-0">
                        Histórica
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0">
                        App
                      </Badge>
                    )}
                  </div>
                </TableCell>
                
                {!hideClientColumn && (
                  <TableCell className="font-medium text-foreground/80">
                      {toTitleCase(invoice.client?.name || 'Cliente Desconocido')}
                  </TableCell>
                )}

                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(invoice.issueDate), 'dd MMM yyyy', { locale: es })}
                </TableCell>
                <TableCell className="font-semibold text-sm">
                    {formatCurrency(invoice.total)}
                </TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={`${statusColors[invoice.status] || 'bg-gray-100'} px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide border`}
                  >
                    {statusLabels[invoice.status] || invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => onEdit(invoice)}
                  title="Ver detalles / Editar"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onDelete(invoice.id)}
                    title="Eliminar factura"
                  >
                    <Trash2 className="h-4 w-4" />
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
