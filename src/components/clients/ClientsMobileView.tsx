
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, UserCheck, UserX, Plus, Users, Phone, Mail, MapPin, User, TrendingUp } from 'lucide-react';
import { Client } from '@/types';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

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
  const { isMobile, isTablet } = useDeviceType();
  const navigate = useNavigate();

  const handleViewPipeline = (client: Client) => {
    navigate(`/clients/${client.id}/pipeline`);
  };
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
              
              {client.contactName && (
                <div className="flex items-center text-white text-sm">
                  <User className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{client.contactName}</span>
                </div>
              )}
              
              {client.address && (
                <div className="flex items-center text-white text-sm">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0" />
                  <span className="text-xs truncate">{client.address}</span>
                </div>
              )}
            </div>

            <div className={cn(
              "flex gap-2",
              isMobile ? "flex-col" : "flex-wrap"
            )}>
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => handleViewPipeline(client)}
                className={cn(
                  "text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 border border-purple-400/50 touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Pipeline VIP
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onViewDetails(client)}
                className={cn(
                  "text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 border border-blue-400/50 touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onEdit(client)}
                className={cn(
                  "text-tms-green hover:text-tms-green/80 hover:bg-tms-green/10 border border-tms-green/50 touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onToggleStatus(client)}
                className={cn(
                  `border touch-target ${
                    client.isActive 
                      ? 'text-red-400 hover:text-red-300 hover:bg-red-400/10 border-red-400/50' 
                      : 'text-green-400 hover:text-green-300 hover:bg-green-400/10 border-green-400/50'
                  }`,
                  isMobile ? "w-full" : "flex-1"
                )}
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
                size={isMobile ? "default" : "sm"}
                onClick={() => onDelete(client)}
                className={cn(
                  "text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50 touch-target",
                  isMobile ? "w-full" : "px-3"
                )}
              >
                <Trash2 className="w-4 h-4" />
                {isMobile && <span className="ml-1">Eliminar</span>}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
