
import { Edit, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceClosure } from '@/types';
import { Client } from '@/types';

interface ClosuresTableProps {
  closures: ServiceClosure[];
  clients: Client[];
  onDelete: (id: string, folio: string) => void;
  onClose: (id: string, folio: string) => void;
}

const ClosuresTable = ({ closures, clients, onDelete, onClose }: ClosuresTableProps) => {
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
      currency: 'CLP'
    }).format(amount);
  };

  const formatDateRange = (dateRange: { from: string; to: string }) => {
    const fromDate = new Date(dateRange.from).toLocaleDateString('es-CL');
    const toDate = new Date(dateRange.to).toLocaleDateString('es-CL');
    return `${fromDate} - ${toDate}`;
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white">
          Lista de Cierres ({closures.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700">
              <TableHead className="text-gray-300">Folio</TableHead>
              <TableHead className="text-gray-300">Período</TableHead>
              <TableHead className="text-gray-300">Cliente</TableHead>
              <TableHead className="text-gray-300">Servicios</TableHead>
              <TableHead className="text-gray-300">Total</TableHead>
              <TableHead className="text-gray-300">Estado</TableHead>
              <TableHead className="text-gray-300 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {closures.map((closure) => (
              <TableRow key={closure.id} className="border-gray-700 hover:bg-white/5">
                <TableCell className="text-white font-medium">
                  {closure.folio}
                </TableCell>
                <TableCell className="text-gray-300">
                  {formatDateRange(closure.dateRange)}
                </TableCell>
                <TableCell className="text-gray-300">
                  {getClientName(closure.clientId)}
                </TableCell>
                <TableCell className="text-gray-300">
                  {closure.serviceIds.length} servicios
                </TableCell>
                <TableCell className="text-gray-300 font-medium">
                  {formatCurrency(closure.total)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(closure.status)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    {closure.status === 'open' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onClose(closure.id, closure.folio)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-400 hover:text-white"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(closure.id, closure.folio)}
                      className="text-red-400 hover:text-red-300"
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
