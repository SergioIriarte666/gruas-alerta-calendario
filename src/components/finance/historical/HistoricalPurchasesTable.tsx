import { businessClock } from '@/utils/businessClock';

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
import { formatCurrency } from '@/lib/utils';
import { Edit, ArrowUpDown, ArrowUp, ArrowDown, FileText, Trash2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useMemo } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toTitleCaseEs } from '@/utils/textNormalization';
import { useSuppliers } from '@/hooks/useSuppliers';
import { normalizeSupplierRut } from '@/utils/supplierIdentity';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SourceBadge } from './SourceBadge';
import { formatRut } from '@/utils/rutFormatter';

const cleanDisplayText = (value?: string | null) =>
  (value || '')
    .replace(/\uFFFD+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatSupplierDisplayName = (value?: string | null) => toTitleCaseEs(cleanDisplayText(value));

const scoreSupplierName = (value?: string | null) => {
  const clean = cleanDisplayText(value);
  if (!clean) return -1000;

  let score = 0;
  if (/[áéíóúñÁÉÍÓÚÑ]/.test(clean)) score += 20;
  if (/\uFFFD/.test(value || '')) score -= 40;
  if (/\?/.test(clean)) score -= 10;
  if (clean === clean.toUpperCase()) score -= 2;
  score += Math.min(clean.length, 60) / 5;
  return score;
};

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
  hideSupplierColumn?: boolean;
  selectedIds?: string[];
  onSelectId?: (id: string, checked: boolean) => void;
  onSelectAll?: (ids: string[], checked: boolean) => void;
}

const statusLabels: Record<string, string> = {
  paid: 'Pagada',
  pending: 'Pendiente',
  overdue: 'Vencida',
  cancelled: 'Anulada',
};

const statusColors: Record<string, string> = {
  paid: 'bg-success-soft text-success-text',
  pending: 'bg-warning-soft text-warning-text',
  overdue: 'bg-danger-soft text-danger-text',
  cancelled: 'bg-muted text-muted-foreground',
};

export const HistoricalPurchasesTable = ({
  invoices,
  invoiceItemsMap,
  sortConfig,
  onSort,
  onEdit,
  onDelete,
  onReceiveInventory,
  hideSupplierColumn = false,
  selectedIds = [],
  onSelectId,
  onSelectAll,
}: HistoricalPurchasesTableProps) => {
  const { suppliers } = useSuppliers();
  const bestSupplierByRut = useMemo(() => {
    const map = new Map<string, { id: string; name: string; rut: string | null }>();
    const scoreMap = new Map<string, number>();

    for (const supplier of suppliers) {
      const key = normalizeSupplierRut(supplier.rut);
      if (!key) continue;
      const score = scoreSupplierName(supplier.name);
      const prevScore = scoreMap.get(key);
      if (prevScore == null || score > prevScore) {
        scoreMap.set(key, score);
        map.set(key, supplier);
      }
    }

    return map;
  }, [suppliers]);

  const emptyColSpan = hideSupplierColumn ? 8 : 10;
  const SortIcon = ({ columnKey }: { columnKey: PurchaseSortKey }) => {
    if (sortConfig.key !== columnKey) return <ArrowUpDown className="ml-2 size-3 opacity-30" />;
    return sortConfig.direction === 'asc' ? 
      <ArrowUp className="ml-2 size-3 text-primary" /> : 
      <ArrowDown className="ml-2 size-3 text-primary" />;
  };

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
            <TableHead className="w-32">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSort('invoice_number')}
                className="-ml-4 h-8 font-semibold hover:bg-transparent hover:text-primary"
              >
                N° Fiscal
                <SortIcon columnKey="invoice_number" />
              </Button>
            </TableHead>
            
            {!hideSupplierColumn && (
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
            )}

            {!hideSupplierColumn && <TableHead className="w-36">RUT</TableHead>}

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

            <TableHead className="text-right w-20">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={emptyColSpan} className="h-32 text-center text-muted-foreground">
                <div className="flex flex-col items-center justify-center gap-2">
                  <FileText className="size-8 text-muted-foreground/30" />
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
                <TableCell className="font-medium font-mono text-xs">
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const num = invoice.invoice_number.toUpperCase();
                      const docType = num.startsWith('NC-') || num.startsWith('NC ') ? 'NC'
                        : num.startsWith('ND-') || num.startsWith('ND ') ? 'ND'
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
                    {invoice.invoice_number}
                    <SourceBadge source={invoice.source} />
                  </div>
                </TableCell>
                
                {!hideSupplierColumn && (
                  <TableCell className="font-medium text-foreground/80 max-w-xs whitespace-nowrap truncate">
                    {(() => {
                      const invoiceSupplierName = invoice.supplier?.name || 'Proveedor Desconocido';
                      const rutKey = normalizeSupplierRut(invoice.supplier?.rut);
                      const canonical = rutKey ? bestSupplierByRut.get(rutKey) : null;
                      const displayName = formatSupplierDisplayName(canonical?.name || invoiceSupplierName);
                      return (
                        <span title={displayName}>
                          {displayName}
                        </span>
                      );
                    })()}
                  </TableCell>
                )}

                {!hideSupplierColumn && (
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {invoice.supplier?.rut ? formatRut(invoice.supplier.rut) : '—'}
                  </TableCell>
                )}

                <TableCell className="max-w-xs text-sm text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => onEdit(invoice)}
                    className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Editar glosa"
                  >
                    <span className="block min-w-0 flex-1 truncate">
                      {invoice.product_service_description || invoice.description || 'Sin glosa registrada'}
                    </span>
                    <Edit className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" />
                  </button>
                </TableCell>

                <TableCell className="text-muted-foreground text-sm">
                  {businessClock.format(invoice.issue_date, 'dd MMM yyyy', { locale: es })}
                </TableCell>

                <TableCell className="text-muted-foreground text-sm">
                  {businessClock.format(invoice.due_date, 'dd MMM yyyy', { locale: es })}
                </TableCell>

                <TableCell className="font-semibold text-sm">
                  {formatCurrency(invoice.amount)}
                </TableCell>
                
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[invoice.status || 'pending'] || 'bg-muted text-foreground'}`}>
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
                            className={`size-8 ${hasInventory ? 'text-success-text hover:text-success-text/80 hover:bg-success/90' : 'text-info-text hover:text-info-text/80 hover:bg-info/90'}`}
                          >
                            <Package className="size-4" />
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
                                     return items.length > 5 ? <li className="list-none pt-1 text-xs italic">... y {items.length - 5} más</li> : null;
                                  })()}
                                </ul>
                                <p className="text-xs text-info-text mt-2 pt-1 border-t border-border">Click para ver/editar detalles</p>
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
                      className="size-8 p-0 text-info-text hover:text-info-text/80 hover:bg-info/90"
                    >
                      <Edit className="size-4" />
                      <span className="sr-only">Editar</span>
                    </Button>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(invoice.id)}
                        className="size-8 p-0 text-danger-text hover:text-danger-text/80 hover:bg-danger/90"
                      >
                        <Trash2 className="size-4" />
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
