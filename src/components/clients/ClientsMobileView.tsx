
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, UserCheck, UserX, Plus, Users, Phone, Mail, MapPin } from 'lucide-react';
import { Client } from '@/types';

interface ClientsMobileViewProps {
  clients: Client[];
  totalClients: number;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onToggleStatus: (client: Client) => void;
  onViewDetails: (client: Client) => void;
  onNewClient: () => void;
  searchTerm: string;
}

export const ClientsMobileView = ({
  clients,
  totalClients,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
  onNewClient,
  searchTerm,
}: ClientsMobileViewProps) => {
  if (clients.length === 0 && searchTerm) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6 text-center">
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
        <CardContent className="p-6 text-center">
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
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Clientes ({totalClients})</h3>
      </div>
      
      {clients.map((client) => (
        <Card key={client.id} className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-white text-lg">{client.name}</h4>
                <p className="text-tms-green text-sm font-medium">{client.rut}</p>
              </div>
              <Badge 
                variant={client.isActive ? "default" : "secondary"}
                className={client.isActive 
                  ? "bg-tms-green text-black" 
                  : "bg-gray-600 text-white"
                }
              >
                {client.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              {client.email && (
                <div className="flex items-center text-white text-sm">
                  <Mail className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              
              {client.phone && (
                <div className="flex items-center text-white text-sm">
                  <Phone className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
              
              {client.address && (
                <div className="flex items-center text-white text-sm">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span className="text-xs truncate">{client.address}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(client)}
                className="flex-1 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 border border-blue-400/50"
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(client)}
                className="flex-1 text-tms-green hover:text-tms-green/80 hover:bg-tms-green/10 border border-tms-green/50"
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleStatus(client)}
                className={`flex-1 border ${
                  client.isActive 
                    ? 'text-red-400 hover:text-red-300 hover:bg-red-400/10 border-red-400/50' 
                    : 'text-green-400 hover:text-green-300 hover:bg-green-400/10 border-green-400/50'
                }`}
              >
                {client.isActive ? (
                  <>
                    <UserX className="w-4 h-4 mr-1" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4 mr-1" />
                    Activar
                  </>
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(client)}
                className="text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50 px-3"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
