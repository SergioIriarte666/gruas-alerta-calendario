import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, UserCheck, UserX, Plus, Users, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Client } from '@/types';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useNavigate } from 'react-router-dom';
import { ClientsMobileView } from './ClientsMobileView';

export type ClientSortField = 'name' | 'rut' | 'department' | 'contactName' | 'email' | 'phone' | 'isActive';
export type SortDirection = 'asc' | 'desc';

interface ClientsTableProps {
  clients: Client[];
  totalClients: number;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onToggleStatus: (client: Client) => void;
  onViewDetails: (client: Client) => void;
  onNewClient: () => void;
  searchTerm: string;
  sortField?: ClientSortField;
  sortDirection?: SortDirection;
  onSort?: (field: ClientSortField) => void;
}

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: ClientSortField; 
  currentSortField?: ClientSortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : 
    <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
};

export const ClientsTable = ({
  clients,
  totalClients,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
  onNewClient,
  searchTerm,
  sortField,
  sortDirection,
  onSort,
}: ClientsTableProps) => {
  const { isMobile } = useDeviceType();
  const navigate = useNavigate();

  const handleViewPipeline = (client: Client) => {
    navigate(`/clients/${client.id}/pipeline`);
  };

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
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron clientes</h3>
          <p className="text-muted-foreground mb-4">
            No hay clientes que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewClient} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (clients.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No hay clientes registrados</h3>
          <p className="text-muted-foreground mb-4">
            Comienza agregando tu primer cliente al sistema
          </p>
          <Button onClick={onNewClient} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Clientes ({totalClients})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th 
                  className="text-left py-3 px-4 font-medium cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('name')}
                >
                  <div className="flex items-center">
                    Nombre
                    <SortIcon field="name" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('rut')}
                >
                  <div className="flex items-center">
                    RUT
                    <SortIcon field="rut" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('department')}
                >
                  <div className="flex items-center">
                    Departamento
                    <SortIcon field="department" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('contactName')}
                >
                  <div className="flex items-center">
                    Contacto
                    <SortIcon field="contactName" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('email')}
                >
                  <div className="flex items-center">
                    Email
                    <SortIcon field="email" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('phone')}
                >
                  <div className="flex items-center">
                    Teléfono
                    <SortIcon field="phone" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-medium cursor-pointer hover:text-primary transition-colors" 
                  onClick={() => onSort?.('isActive')}
                >
                  <div className="flex items-center">
                    Estado
                    <SortIcon field="isActive" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 px-4 font-medium">{client.name}</td>
                  <td className="py-3 px-4">{client.rut}</td>
                  <td className="py-3 px-4">{client.department}</td>
                  <td className="py-3 px-4">{client.contactName || '-'}</td>
                  <td className="py-3 px-4">{client.email}</td>
                  <td className="py-3 px-4">{client.phone}</td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={client.isActive ? "default" : "secondary"}
                    >
                      {client.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewPipeline(client)}
                        className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 border border-purple-400/50"
                        title="Pipeline VIP"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </Button>
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
                        className="text-primary hover:text-primary/80 hover:bg-primary/10 border border-primary/50"
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
