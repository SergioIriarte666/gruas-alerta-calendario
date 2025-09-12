
import { Edit, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceClosure } from '@/types';
import { Client } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';

interface ClosuresTableProps {
  closures: ServiceClosure[];
  clients: Client[];
  onEdit: (closure: ServiceClosure) => void;
  onDelete: (id: string, folio: string) => void;
  onClose: (id: string, folio: string) => void;
}

const ClosuresTable = ({ closures, clients, onEdit, onDelete, onClose }: ClosuresTableProps) => {
  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente desconocido';
  };

  const getStatusBadge = (status: ServiceClosure['status']) => {
    switch (status) {
      case 'open':
        return <Badge className="status-pending">Abierto</Badge>;
      case 'closed':
        return <Badge className="status-closed">Cerrado</Badge>;
      case 'invoiced':
        return <Badge className="status-active">Facturado</Badge>;
      default:
        return <Badge className="bg-gray-500">Desconocido</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  const formatDateRange = (dateRange: { from: string; to: string }) => {
    const fromDate = formatForDisplay(dateRange.from);
    const toDate = formatForDisplay(dateRange.to);
    return `${fromDate} - ${toDate}`;
  };

  return (
    <Card className="bg-card border">
      <CardHeader>
        <CardTitle className="text-foreground">
          Lista de Cierres ({closures.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-foreground">Folio</TableHead>
              <TableHead className="text-foreground">Período</TableHead>
              <TableHead className="text-foreground">Cliente</TableHead>
              <TableHead className="text-foreground">Servicios</TableHead>
              <TableHead className="text-foreground">Total</TableHead>
              <TableHead className="text-foreground">Estado</TableHead>
              <TableHead className="text-foreground text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closures.map((closure) => (
              <TableRow key={closure.id} className="border-border hover:bg-muted">
                <TableCell className="text-foreground font-medium">
                  {closure.folio}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateRange(closure.dateRange)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {getClientName(closure.clientId)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {closure.serviceIds.length} servicios
                </TableCell>
                <TableCell className="text-foreground font-medium">
                  {formatCurrency(closure.total)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(closure.status)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    {closure.status === 'open' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onClose(closure.id, closure.folio)}
                        className=""
                        title="Cerrar periodo"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(closure)}
                      className=""
                      title="Editar cierre"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(closure.id, closure.folio)}
                      className="text-destructive border-destructive/40 hover:bg-destructive/10"
                      title="Eliminar cierre"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {closures.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-400">No se encontraron cierres</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClosuresTable;
