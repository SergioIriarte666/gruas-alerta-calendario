import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Eye, Plus, Users, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, UserCheck, UserX, Trash2 } from 'lucide-react';
import { Client } from '@/types';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useNavigate } from 'react-router-dom';
import { ClientsMobileView } from './ClientsMobileView';
import { DepartmentBadge } from './DepartmentBadge';
import { useClients } from '@/hooks/useClients';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  serviceCountByClient?: Map<string, number>;
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
  serviceCountByClient,
}: ClientsTableProps) => {
  const { isMobile } = useDeviceType();
  const navigate = useNavigate();
  const { clients: allClients } = useClients();

  const handleViewPipeline = (client: Client) => {
    navigate(`/clients/${client.id}/pipeline`);
  };

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
        serviceCountByClient={serviceCountByClient}
      />
    );
  }

  if (clients.length === 0 && searchTerm) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron clientes</h3>
          <p className="text-muted-foreground mb-4">No hay clientes que coincidan con "{searchTerm}"</p>
          <Button onClick={onNewClient} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />Agregar Cliente
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
          <p className="text-muted-foreground mb-4">Comienza agregando tu primer cliente al sistema</p>
          <Button onClick={onNewClient} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />Agregar Primer Cliente
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
                <th className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => onSort?.('name')}>
                  <div className="flex items-center">Nombre<SortIcon field="name" currentSortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => onSort?.('rut')}>
                  <div className="flex items-center">RUT<SortIcon field="rut" currentSortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => onSort?.('department')}>
                  <div className="flex items-center">Departamento<SortIcon field="department" currentSortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => onSort?.('contactName')}>
                  <div className="flex items-center">Contacto<SortIcon field="contactName" currentSortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th className="text-left py-3 px-4 font-medium text-foreground">Servicios</th>
                <th className="text-left py-3 px-4 font-medium text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => onSort?.('isActive')}>
                  <div className="flex items-center">Estado<SortIcon field="isActive" currentSortField={sortField} sortDirection={sortDirection} /></div>
                </th>
                <th className="text-center py-3 px-4 font-medium text-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const svcCount = serviceCountByClient?.get(client.id) || 0;
                return (
                  <tr key={client.id} className="border-b hover:bg-muted/50">
                    {/* Clickable name -> Pipeline VIP */}
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleViewPipeline(client)}
                        className="font-medium text-violet-600 dark:text-violet-400 hover:underline text-left"
                        title="Ir al Pipeline VIP"
                      >
                        {client.name}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-foreground">{client.rut}</td>
                    <td className="py-3 px-4">
                      <DepartmentBadge department={client.department} clientRut={client.rut} clientName={client.name} allClients={allClients} />
                    </td>
                    <td className="py-3 px-4 text-foreground">{client.contactName || <span className="text-muted-foreground">-</span>}</td>
                    {/* Services in pipeline column */}
                    <td className="py-3 px-4">
                      {svcCount > 0 ? (
                        <button
                          onClick={() => handleViewPipeline(client)}
                          className="inline-flex items-center gap-1"
                          title="Ver servicios en Pipeline"
                        >
                          <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200">
                            {svcCount} activo{svcCount !== 1 ? 's' : ''}
                          </Badge>
                        </button>
                      ) : (
                        <Badge variant="secondary" className="text-muted-foreground">0</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={client.isActive ? "default" : "secondary"}>
                        {client.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    {/* Simplified actions: View, Edit, Menu */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => onViewDetails(client)} className="text-blue-500 hover:text-blue-400 hover:bg-blue-500/10" title="Ver detalles">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(client)} className="text-primary hover:text-primary/80 hover:bg-primary/10" title="Editar cliente">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onToggleStatus(client)}>
                              {client.isActive ? (
                                <><UserX className="w-4 h-4 mr-2 text-red-500" />Desactivar</>
                              ) : (
                                <><UserCheck className="w-4 h-4 mr-2 text-green-500" />Activar</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(client)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
