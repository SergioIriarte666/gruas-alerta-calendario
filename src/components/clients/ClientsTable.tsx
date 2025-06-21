import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, UserCheck, UserX, Plus, Users } from 'lucide-react';
import { Client } from '@/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { ClientsMobileView } from './ClientsMobileView';

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
  const isMobile = useIsMobile();

  // Render mobile view if on mobile device
  if (isMobile) {
    return (
      <ClientsMobileView
        clients={clients}
        totalClients={totalClients}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStatus={onToggleStatus}
        onViewDetails={onViewDetails}
        onNewClient={onNewClient}
        searchTerm={searchTerm}
      />
    );
  }

  // Desktop view (unchanged functionality)
  if (clients.length === 0 && searchTerm) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No se encontraron clientes</h3>
          <p className="text-gray-400 mb-4">
            No hay clientes que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewClient} className="bg-tms-green hover:bg-tms-green/80 text-black">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">No hay clientes registrados</h3>
          <p className="text-gray-400 mb-4">
            Comienza agregando tu primer cliente al sistema
          </p>
          <Button onClick={onNewClient} className="bg-tms-green hover:bg-tms-green/80 text-black">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span>Clientes ({totalClients})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 font-medium text-white">Nombre</th>
                <th className="text-left py-3 px-4 font-medium text-white">RUT</th>
                <th className="text-left py-3 px-4 font-medium text-white">Email</th>
                <th className="text-left py-3 px-4 font-medium text-white">Teléfono</th>
                <th className="text-left py-3 px-4 font-medium text-white">Estado</th>
                <th className="text-center py-3 px-4 font-medium text-white">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-gray-800 hover:bg-white/5">
                  <td className="py-3 px-4 text-white font-medium">{client.name}</td>
                  <td className="py-3 px-4 text-white">{client.rut}</td>
                  <td className="py-3 px-4 text-white">{client.email}</td>
                  <td className="py-3 px-4 text-white">{client.phone}</td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={client.isActive ? "default" : "secondary"}
                      className={client.isActive 
                        ? "bg-tms-green text-black" 
                        : "bg-gray-600 text-white"
                      }
                    >
                      {client.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(client)}
                        className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 border border-blue-400/50"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(client)}
                        className="text-tms-green hover:text-tms-green/80 hover:bg-tms-green/10 border border-tms-green/50"
                        title="Editar cliente"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(client)}
                        className={`border ${
                          client.isActive 
                            ? 'text-red-400 hover:text-red-300 hover:bg-red-400/10 border-red-400/50' 
                            : 'text-green-400 hover:text-green-300 hover:bg-green-400/10 border-green-400/50'
                        }`}
                        title={client.isActive ? 'Desactivar cliente' : 'Activar cliente'}
                      >
                        {client.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(client)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
