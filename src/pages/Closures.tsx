
import { useState } from 'react';
import { Plus, Search, Edit, Trash2, FileText, Calendar, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useServiceClosures } from '@/hooks/useServiceClosures';
import { useClients } from '@/hooks/useClients';
import { ServiceClosure } from '@/types';
import { toast } from '@/hooks/use-toast';

const Closures = () => {
  const { closures, loading, createClosure, deleteClosure, closeClosure } = useServiceClosures();
  const { clients } = useClients();
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar cierres por término de búsqueda
  const filteredClosures = closures.filter(closure =>
    closure.folio.toLowerCase().includes(searchTerm.toLowerCase()) ||
    closure.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente desconocido';
  };

  const handleDelete = (id: string, folio: string) => {
    if (window.confirm(`¿Está seguro de eliminar el cierre "${folio}"?`)) {
      deleteClosure(id);
      toast({
        title: "Cierre eliminado",
        description: "El cierre ha sido eliminado exitosamente.",
      });
    }
  };

  const handleClose = (id: string, folio: string) => {
    if (window.confirm(`¿Está seguro de cerrar el periodo "${folio}"?`)) {
      closeClosure(id);
      toast({
        title: "Cierre procesado",
        description: "El cierre ha sido procesado exitosamente.",
      });
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Cargando cierres...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Cierres de Servicios</h1>
          <p className="text-gray-400 mt-1">Gestión de cierres por períodos</p>
        </div>
        <Button
          className="bg-tms-green hover:bg-tms-green/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Cierre
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Cierres Abiertos</p>
                <p className="text-2xl font-bold text-white">
                  {closures.filter(c => c.status === 'open').length}
                </p>
              </div>
              <FileText className="w-8 h-8 text-tms-green" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Cierres Cerrados</p>
                <p className="text-2xl font-bold text-white">
                  {closures.filter(c => c.status === 'closed').length}
                </p>
              </div>
              <Calendar className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Facturado</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(closures.filter(c => c.status === 'invoiced').reduce((sum, c) => sum + c.total, 0))}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por folio o estado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-gray-700 text-white placeholder-gray-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-white">
            Lista de Cierres ({filteredClosures.length})
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
              {filteredClosures.map((closure) => (
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
                          onClick={() => handleClose(closure.id, closure.folio)}
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
                        onClick={() => handleDelete(closure.id, closure.folio)}
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

          {filteredClosures.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-400">No se encontraron cierres</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Closures;
