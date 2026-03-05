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
import { Invoice } from '@/types';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Edit, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
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
}

const statusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-800 border-green-200',
  sent: 'bg-blue-100 text-blue-800 border-blue-200',
  overdue: 'bg-red-100 text-red-800 border-red-200',
  draft: 'bg-gray-100 text-gray-800 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-800 border-gray-200 line-through',
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
}: HistoricalSalesTableProps) => {
  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="ml-2 h-4 w-4" /> : 
      <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const SortableHead = ({ columnKey, label, className }: { columnKey: SortKey, label: string, className?: string }) => (
    <TableHead className={className}>
      <Button
        variant="ghost"
        onClick={() => onSort(columnKey)}
        className="-ml-4 h-8 data-[state=open]:bg-accent"
      >
        {label}
        <SortIcon columnKey={columnKey} />
      </Button>
    </TableHead>
  );

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead columnKey="folio" label="Folio" />
            <SortableHead columnKey="client" label="Cliente" />
            <SortableHead columnKey="issueDate" label="Fecha Emisión" />
            <SortableHead columnKey="total" label="Monto" />
            <SortableHead columnKey="status" label="Estado" />
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No se encontraron resultados.
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.folio}</TableCell>
                <TableCell>{toTitleCase(invoice.client?.name || 'Cliente Desconocido')}</TableCell>
                <TableCell>
                  {format(new Date(invoice.issueDate), 'dd/MM/yyyy', { locale: es })}
                </TableCell>
                <TableCell>{formatCurrency(invoice.total)}</TableCell>
                <TableCell>
                  <Badge 
                    variant="outline" 
                    className={statusColors[invoice.status] || 'bg-gray-100'}
                  >
                    {statusLabels[invoice.status] || invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(invoice)}
                    title="Editar detalles"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
