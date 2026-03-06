import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { formatCurrency, toTitleCase } from '@/lib/utils';
import { Edit, ArrowUpDown, ArrowUp, ArrowDown, FileText, Trash2, Package } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type PurchaseSortKey = 'invoice_number' | 'supplier' | 'issue_date' | 'due_date' | 'amount' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface PurchaseSortConfig {
  key: PurchaseSortKey;
  direction: SortDirection;
}

interface HistoricalPurchasesTableProps {
  invoices: SupplierInvoiceWithDetails[];
  invoiceItemsMap?: Record<string, string[]>;
  sortConfig: PurchaseSortConfig;
  onSort: (key: PurchaseSortKey) => void;
  onEdit: (invoice: SupplierInvoiceWithDetails) => void;
  onDelete?: (id: string) => void;
  onReceiveInventory?: (invoice: SupplierInvoiceWithDetails) => void;
  selectedIds?: string[];
  onSelectId?: (id: string, checked: boolean) => void;
  onSelectAll?: (checked: boolean) => void;
}

const statusLabels: Record<string, string> = {
  paid: 'Pagada',
  pending: 'Pendiente',
  overdue: 'Vencida',
  cancelled: 'Anulada',
};

const statusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export const HistoricalPurchasesTable = ({
  invoices,
  invoiceItemsMap,
  sortConfig,
  onSort,
  onEdit,
  onDelete,
  onReceiveInventory,
  selectedIds = [],
  onSelectId,
  onSelectAll,
}: HistoricalPurchasesTableProps) => {
  const SortIcon = ({ columnKey }: { columnKey: PurchaseSortKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 h-3 w-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="ml-2 h-3 w-3 text-primary" /> : 
      <ArrowDown className="ml-2 h-3 w-3 text-primary" />;
  };

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
            <TableHead className="w-[120px]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('invoice_number')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                N° Factura
                <SortIcon columnKey="invoice_number" />
              </Button>
            </TableHead>
            
            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('supplier')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                Proveedor
                <SortIcon columnKey="supplier" />
              </Button>
            </TableHead>

            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('issue_date')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                Emisión
                <SortIcon columnKey="issue_date" />
              </Button>
            </TableHead>

            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('due_date')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                Vencimiento
                <SortIcon columnKey="due_date" />
              </Button>
            </TableHead>

            <TableHead>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('amount')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                Monto
                <SortIcon columnKey="amount" />
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
              <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  <p>No se encontraron registros.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice, index) => {
              const hasInventory = invoiceItemsMap ? (() => {
                 const normalizedRef = invoice.invoice_number.trim().toUpperCase();
                 const key = invoice.supplier_id 
                    ? `${invoice.supplier_id}-${normalizedRef}`
                    : normalizedRef;
                 return !!(invoiceItemsMap[key]?.length || invoiceItemsMap[normalizedRef]?.length);
              })() : false;

              return (
              <TableRow 
                key={invoice.id} 
                className={index % 2 === 0 ? "bg-background" : "bg-muted/30"}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(invoice.id)}
                    onCheckedChange={(checked) => onSelectId?.(invoice.id, !!checked)}
                    aria-label={`Seleccionar factura ${invoice.invoice_number}`}
                  />
                </TableCell>
                <TableCell className="font-medium font-mono text-xs">{invoice.invoice_number}</TableCell>
                
                <TableCell className="font-medium text-foreground/80">
                  {toTitleCase(invoice.supplier?.name || 'Proveedor Desconocido')}
                </TableCell>

                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(invoice.issue_date), 'dd MMM yyyy', { locale: es })}
                </TableCell>

                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(invoice.due_date), 'dd MMM yyyy', { locale: es })}
                </TableCell>

                <TableCell className="font-semibold text-sm">
                  {formatCurrency(invoice.amount)}
                </TableCell>
                
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[invoice.status || 'pending'] || 'bg-gray-100 text-gray-800'}`}>
                    {statusLabels[invoice.status || 'pending'] || invoice.status}
                  </span>
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onReceiveInventory?.(invoice)}
                            className={`h-8 w-8 ${hasInventory ? 'text-green-600 hover:text-green-700 hover:bg-green-50' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}
                          >
                            <Package className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {hasInventory ? (
                              <div className="space-y-1">
                                <p className="font-semibold text-xs">Inventario Recibido:</p>
                                <ul className="text-xs list-disc pl-3 space-y-0.5 text-muted-foreground">
                                  {(() => {
                                     const normalizedRef = invoice.invoice_number.trim().toUpperCase();
                                     const key = invoice.supplier_id 
                                        ? `${invoice.supplier_id}-${normalizedRef}`
                                        : normalizedRef;
                                     const items = invoiceItemsMap?.[key] || invoiceItemsMap?.[normalizedRef] || [];
                                     
                                     // Mostrar solo los primeros 5 items únicos (limpiando un poco el string de búsqueda)
                                     return items.slice(0, 5).map((item, i) => (
                                       <li key={i} className="truncate">{item}</li>
                                     ));
                                  })()}
                                  {(() => {
                                     const normalizedRef = invoice.invoice_number.trim().toUpperCase();
                                     const key = invoice.supplier_id 
                                        ? `${invoice.supplier_id}-${normalizedRef}`
                                        : normalizedRef;
                                     const items = invoiceItemsMap?.[key] || invoiceItemsMap?.[normalizedRef] || [];
                                     return items.length > 5 ? <li className="list-none pt-1 text-[10px] italic">... y {items.length - 5} más</li> : null;
                                  })()}
                                </ul>
                                <p className="text-[10px] text-blue-500 mt-2 pt-1 border-t border-border">Click para ver/editar detalles</p>
                              </div>
                            ) : (
                              <p>Registrar recepción de inventario</p>
                            )}
                          </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(invoice)}
                      className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    >
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(invoice.id)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )})
          )}
        </TableBody>
      </Table>
    </div>
  );
};
