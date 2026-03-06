import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Trash2, 
  Download, 
  FileSpreadsheet,
  X,
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import { Invoice } from '@/types';

interface InvoiceBatchActionsProps {
  selectedInvoices: Invoice[];
  onMarkAsPaid: (invoiceIds: string[]) => void;
  onDelete: (invoiceIds: string[]) => void;
  onExport: (invoiceIds: string[]) => void;
  onClearSelection: () => void;
}

const InvoiceBatchActions = ({
  selectedInvoices,
  onMarkAsPaid,
  onDelete,
  onExport,
  onClearSelection
}: InvoiceBatchActionsProps) => {
  const handleMarkAsPaid = () => {
    const unpaidInvoices = selectedInvoices.filter(inv => inv.status !== 'paid');
    if (unpaidInvoices.length === 0) {
      alert('Todas las facturas seleccionadas ya están marcadas como pagadas');
      return;
    }
    
    if (window.confirm(`¿Está seguro de marcar ${unpaidInvoices.length} facturas como pagadas?`)) {
      onMarkAsPaid(unpaidInvoices.map(inv => inv.id));
    }
  };

  const handleDelete = () => {
    if (window.confirm(`¿Está seguro de eliminar ${selectedInvoices.length} facturas? Esta acción no se puede deshacer.`)) {
      onDelete(selectedInvoices.map(inv => inv.id));
    }
  };

  const handleExport = () => {
    onExport(selectedInvoices.map(inv => inv.id));
  };

  if (selectedInvoices.length === 0) return null;

  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  const protectedCount = selectedInvoices.filter(inv => !inv.folio?.startsWith('HIST-')).length;
  const statusCounts = selectedInvoices.reduce((counts, inv) => {
    counts[inv.status] = (counts[inv.status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  return (
    <Card className="glass-card border-tms-green/30">
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-tms-green/20 text-tms-green border-tms-green/40">
                {selectedInvoices.length} facturas seleccionadas
              </Badge>
              <span className="text-white font-medium">
                Total: ${totalAmount.toLocaleString('es-CL')}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {Object.entries(statusCounts).map(([status, count]) => {
                const statusLabels = {
                  draft: 'Borrador',
                  sent: 'Enviada',
                  paid: 'Pagada',
                  overdue: 'Vencida',
                  cancelled: 'Anulada'
                };
                
                const statusColors = {
                  draft: 'bg-gray-600 text-white',
                  sent: 'bg-blue-600 text-white',
                  paid: 'bg-tms-green text-black',
                  overdue: 'bg-red-600 text-white',
                  cancelled: 'bg-gray-800 text-gray-300'
                };
                
                return (
                  <Badge 
                    key={status} 
                    className={`${statusColors[status as keyof typeof statusColors]} text-xs`}
                  >
                    {statusLabels[status as keyof typeof statusLabels]}: {count}
                  </Badge>
                );
              })}
            </div>
            
            {protectedCount > 0 && (
              <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                <ShieldAlert className="w-4 h-4" />
                <span>{protectedCount} factura(s) protegida(s) — requieren confirmación reforzada</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAsPaid}
              className="border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20 hover:border-green-500"
              disabled={selectedInvoices.every(inv => inv.status === 'paid')}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Marcar como Pagadas
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="border-blue-500/50 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Exportar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:border-red-500"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceBatchActions;