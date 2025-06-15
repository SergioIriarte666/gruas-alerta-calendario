
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Trash2, Power, Eye } from 'lucide-react';
import { Client } from '@/types';

interface ClientsTableProps {
  clients: Client[];
  totalClients: number;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onToggleStatus: (client: Client) => void;
  onViewDetails: (client: Client) => void;
  onNewClient: () => void;
  searchTerm: string;
}

export const ClientsTable = ({
  clients,
  totalClients,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
  onNewClient,
  searchTerm,
}: ClientsTableProps) => {
  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white">
          Clientes Registrados ({totalClients})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {totalClients === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <div className="w-16 h-16 bg-tms-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-tms-green" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda'
                : 'Comienza agregando tu primer cliente'
              }
            </p>
            {!searchTerm && (
              <Button 
                onClick={onNewClient}
                className="bg-tms-green hover:bg-tms-green-dark text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Cliente
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700">
                  <TableHead className="text-gray-300">Cliente</TableHead>
                  <TableHead className="text-gray-300">RUT</TableHead>
                  <TableHead className="text-gray-300">Contacto</TableHead>
                  <TableHead className="text-gray-300">Dirección</TableHead>
                  <TableHead className="text-gray-300">Estado</TableHead>
                  <TableHead className="text-gray-300">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => (
                  <TableRow key={client.id} className="border-gray-700 hover:bg-white/5">
                    <TableCell>
                      <div className="font-medium text-white">{client.name}</div>
                    </TableCell>
                    <TableCell className="text-gray-300">{client.rut}</TableCell>
                    <TableCell>
                      <div className="text-gray-300">
                        <div>{client.phone}</div>
                        <div className="text-sm text-gray-400">{client.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300 max-w-xs truncate">
                      {client.address}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={client.isActive ? "default" : "secondary"}
                        className={client.isActive 
                          ? "bg-tms-green/20 text-tms-green border-tms-green/30" 
                          : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                        }
                      >
                        {client.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(client)}
                          className="text-gray-400 hover:text-white hover:bg-white/10"
                          title="Ver detalles"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(client)}
                          className="text-gray-400 hover:text-white hover:bg-white/10"
                          title="Editar cliente"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onToggleStatus(client)}
                          className="text-gray-400 hover:text-white hover:bg-white/10"
                          title={client.isActive ? 'Desactivar cliente' : 'Activar cliente'}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(client)}
                          className="text-gray-400 hover:text-red-400 hover:bg-red-400/10"
                          title="Eliminar cliente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
