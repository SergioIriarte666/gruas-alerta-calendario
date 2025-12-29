import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, UserCheck, UserX, Plus, Users, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Client } from '@/types';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useNavigate } from 'react-router-dom';
import { ClientsMobileView } from './ClientsMobileView';
import { DepartmentBadge } from './DepartmentBadge';
import { useClients } from '@/hooks/useClients';

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
    <ArrowUp className="ml-2 h-4 w-4 text-violet-600" /> : 
    <ArrowDown className="ml-2 h-4 w-4 text-violet-600" />;
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
  const { clients: allClients } = useClients();

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
        allClients={allClients}
      />
    );
  }

  // Desktop view (unchanged functionality)
  if (clients.length === 0 && searchTerm) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron clientes</h3>
          <p className="text-muted-foreground mb-4">
            No hay clientes que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewClient} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No hay clientes registrados</h3>
          <p className="text-muted-foreground mb-4">
            Comienza agregando tu primer cliente al sistema
          </p>
          <Button onClick={onNewClient} className="bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-violet-50 to-purple-50 border-b">
        <CardTitle className="flex items-center justify-between text-foreground">
          <span className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            Clientes ({totalClients})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b">
                <th 
                  className="text-left py-3 px-4 font-semibold text-sm text-foreground cursor-pointer hover:text-violet-600 transition-colors" 
                  onClick={() => onSort?.('name')}
                >
                  <div className="flex items-center">
                    Nombre
                    <SortIcon field="name" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-sm text-foreground cursor-pointer hover:text-violet-600 transition-colors" 
                  onClick={() => onSort?.('rut')}
                >
                  <div className="flex items-center">
                    RUT
                    <SortIcon field="rut" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-sm text-foreground cursor-pointer hover:text-violet-600 transition-colors" 
                  onClick={() => onSort?.('department')}
                >
                  <div className="flex items-center">
                    Departamento
                    <SortIcon field="department" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-sm text-foreground cursor-pointer hover:text-violet-600 transition-colors" 
                  onClick={() => onSort?.('contactName')}
                >
                  <div className="flex items-center">
                    Contacto
                    <SortIcon field="contactName" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-sm text-foreground cursor-pointer hover:text-violet-600 transition-colors" 
                  onClick={() => onSort?.('email')}
                >
                  <div className="flex items-center">
                    Email
                    <SortIcon field="email" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-sm text-foreground cursor-pointer hover:text-violet-600 transition-colors" 
                  onClick={() => onSort?.('phone')}
                >
                  <div className="flex items-center">
                    Teléfono
                    <SortIcon field="phone" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-4 font-semibold text-sm text-foreground cursor-pointer hover:text-violet-600 transition-colors" 
                  onClick={() => onSort?.('isActive')}
                >
                  <div className="flex items-center">
                    Estado
                    <SortIcon field="isActive" currentSortField={sortField} sortDirection={sortDirection} />
                  </div>
                </th>
                <th className="text-center py-3 px-4 font-semibold text-sm text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client, index) => (
                <tr 
                  key={client.id} 
                  className={`border-b hover:bg-violet-50/50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  }`}
                >
                  <td className="py-3 px-4 font-medium text-foreground">{client.name}</td>
                  <td className="py-3 px-4 text-foreground font-mono text-sm">{client.rut}</td>
                  <td className="py-3 px-4">
                    <DepartmentBadge
                      department={client.department}
                      clientRut={client.rut}
                      clientName={client.name}
                      allClients={allClients}
                    />
                  </td>
                  <td className="py-3 px-4 text-foreground">{client.contactName || <span className="text-muted-foreground">-</span>}</td>
                  <td className="py-3 px-4 text-foreground">{client.email || <span className="text-muted-foreground">-</span>}</td>
                  <td className="py-3 px-4 text-foreground">{client.phone || <span className="text-muted-foreground">-</span>}</td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={client.isActive ? "default" : "secondary"}
                      className={client.isActive 
                        ? "bg-green-100 text-green-700 hover:bg-green-100" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                      }
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
                        className="text-purple-500 hover:text-purple-600 hover:bg-purple-50"
                        title="Pipeline VIP"
                      >
                        <TrendingUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onViewDetails(client)}
                        className="text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                        title="Ver detalles"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(client)}
                        className="text-violet-500 hover:text-violet-600 hover:bg-violet-50"
                        title="Editar cliente"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(client)}
                        className={
                          client.isActive 
                            ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50' 
                            : 'text-green-500 hover:text-green-600 hover:bg-green-50'
                        }
                        title={client.isActive ? 'Desactivar cliente' : 'Activar cliente'}
                      >
                        {client.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(client)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
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
