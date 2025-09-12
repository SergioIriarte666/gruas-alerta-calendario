
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, DollarSign, FileText, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Invoice } from '@/types';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import InvoiceEmergencyActions from './InvoiceEmergencyActions';


interface InvoicesTableProps {
  invoices: Invoice[];
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
  getInvoiceWithDetails: (invoice: Invoice) => any;
  onRefresh?: () => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string) => void;
  selectedInvoiceIds: string[];
  onInvoiceToggle: (invoiceId: string, checked: boolean) => void;
  onSelectAllToggle: (checked: boolean) => void;
}

// Safe date formatting with validation and fallbacks
const formatSafeDate = (dateValue: any): string => {
  if (!dateValue) return 'Fecha no disponible';
  
  try {
    // Handle both string and Date objects
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    
    if (!isValid(date)) {
      console.warn('Invalid date provided to formatSafeDate:', dateValue);
      return 'Fecha inválida';
    }
    
    return format(date, 'dd/MM/yyyy', { locale: es });
  } catch (error) {
    console.error('Error formatting date:', error, 'Value:', dateValue);
    return 'Error en fecha';
  }
};

// Safe number formatting with validation
const formatSafeAmount = (amount: any): string => {
  const numAmount = Number(amount);
  if (isNaN(numAmount)) {
    console.warn('Invalid amount provided to formatSafeAmount:', amount);
    return '$0';
  }
  return `$${numAmount.toLocaleString('es-CL')}`;
};

// Sort icon component
const SortIcon = ({ field, sortField, sortDirection }: { field: string; sortField?: string; sortDirection?: 'asc' | 'desc' }) => {
  if (sortField !== field) {
    return <ArrowUpDown className="w-4 h-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' 
    ? <ArrowUp className="w-4 h-4 text-primary" />
    : <ArrowDown className="w-4 h-4 text-primary" />;
};

// Sortable header component
const SortableHeader = ({ 
  field, 
  label, 
  sortField, 
  sortDirection, 
  onSort 
}: { 
  field: string; 
  label: string; 
  sortField?: string; 
  sortDirection?: 'asc' | 'desc'; 
  onSort?: (field: string) => void; 
}) => {
  return (
    <th className="text-left py-3 px-4 font-medium text-foreground">
      <button
        onClick={() => onSort?.(field)}
        className="flex items-center gap-2 hover:text-primary transition-colors"
      >
        {label}
        <SortIcon field={field} sortField={sortField} sortDirection={sortDirection} />
      </button>
    </th>
  );
};

// Enhanced status badge with validation
const getStatusBadge = (status: string) => {
  const statusConfig = {
    draft: { label: 'Borrador', className: 'bg-muted text-foreground' },
    sent: { label: 'Enviada', className: 'bg-secondary text-secondary-foreground' },
    paid: { label: 'Pagada', className: 'bg-primary text-primary-foreground' },
    overdue: { label: 'Vencida', className: 'bg-destructive text-destructive-foreground' },
    cancelled: { label: 'Anulada', className: 'bg-muted text-muted-foreground' },
  };
  
  // Validate status and provide fallback
  if (!status || typeof status !== 'string') {
    console.warn('Invalid status provided to getStatusBadge:', status);
    return <Badge className="bg-gray-500 text-white">Estado desconocido</Badge>;
  }
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
  return <Badge className={config.className}>{config.label}</Badge>;
};

const InvoicesTable = ({ 
  invoices, 
  onEdit, 
  onDelete, 
  onMarkAsPaid, 
  getInvoiceWithDetails,
  onRefresh,
  sortField,
  sortDirection,
  onSort,
  selectedInvoiceIds,
  onInvoiceToggle,
  onSelectAllToggle
}: InvoicesTableProps) => {
  const handleInvoiceDeleted = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  if (invoices.length === 0) {
    return (
      <Card className="bg-card border">
        <CardContent className="p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No hay facturas</h3>
          <p className="text-muted-foreground">
            No se encontraron facturas que coincidan con los filtros aplicados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          <span>Facturas ({invoices.length})</span>
          {selectedInvoiceIds.length > 0 && (
            <span className="text-sm bg-primary/15 text-primary px-3 py-1 rounded-full">
              {selectedInvoiceIds.length} seleccionadas
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <SortableHeader field="folio" label="Folio" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="numeroFiscal" label="N° Fiscal" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="client" label="Cliente" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="issueDate" label="Fecha Emisión" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="dueDate" label="Fecha Vencimiento" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="total" label="Total" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <SortableHeader field="status" label="Estado" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
                <th className="text-center py-3 px-4 font-medium text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                // Validate invoice object
                if (!invoice || !invoice.id) {
                  console.warn('Invalid invoice object found:', invoice);
                  return null;
                }

                const invoiceWithDetails = getInvoiceWithDetails(invoice);
                
                const isSelected = selectedInvoiceIds.includes(invoice.id);
                
                return (
                  <tr 
                    key={invoice.id} 
                    className={`border-b border-border hover:bg-muted cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 border-primary/30' : ''
                    }`}
                    onClick={() => onInvoiceToggle(invoice.id, !isSelected)}
                   >
                     <td className="py-3 px-4 text-foreground font-medium">
                       {invoice.folio || 'Sin folio'}
                     </td>
                    <td className="py-3 px-4 text-foreground">
                      {invoice.numeroFiscal ? (
                        <span className="text-violet-600 font-medium">{invoice.numeroFiscal}</span>
                      ) : (
                        <span className="text-muted-foreground italic">Sin asignar</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {invoiceWithDetails?.client?.name || (
                        <span className="text-destructive italic">Cliente no encontrado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {formatSafeDate(invoice.issueDate)}
                    </td>
                    <td className="py-3 px-4 text-foreground">
                      {formatSafeDate(invoice.dueDate)}
                    </td>
                    <td className="py-3 px-4 text-foreground font-medium">
                      {formatSafeAmount(invoice.total)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(invoice.status)}
                        {invoice.status === 'draft' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(invoice)}
                            className="text-xs px-2 py-1"
                            title="Cambiar a Enviada"
                          >
                            → Enviada
                          </Button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!invoice.id) {
                                console.error('Cannot edit invoice: missing ID');
                                return;
                              }
                              console.log('Editing invoice:', invoice.id, invoice);
                              onEdit(invoice);
                            }}
                            className=""
                            title="Editar factura"
                            disabled={!invoice.id}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {invoice.status !== 'paid' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!invoice.id) {
                                  console.error('Cannot mark as paid: missing invoice ID');
                                  return;
                                }
                                console.log('Marking as paid:', invoice.id);
                                onMarkAsPaid(invoice.id);
                              }}
                              className=""
                              title="Marcar como pagada"
                              disabled={!invoice.id}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (!invoice.id) {
                                console.error('Cannot delete invoice: missing ID');
                                return;
                              }
                              onDelete(invoice.id);
                            }}
                            className="text-destructive border-destructive/40 hover:bg-destructive/10"
                            title="Eliminar factura"
                            disabled={!invoice.id}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {invoice.id && invoice.folio && (
                            <InvoiceEmergencyActions
                              invoiceId={invoice.id}
                              invoiceFolio={invoice.folio}
                              onInvoiceDeleted={handleInvoiceDeleted}
                            />
                          )}
                        </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoicesTable;
