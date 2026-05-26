import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Eye, Plus, Users, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal, UserCheck, UserX, Trash2 } from 'lucide-react';
import { Client } from '@/types';
import { useDeviceType } from '@/hooks/useDeviceType';
import { useNavigate } from 'react-router-dom';
import { ClientsMobileView } from './ClientsMobileView';
import { DepartmentBadge } from './DepartmentBadge';
import { useClients } from '@/hooks/useClients';
import { toTitleCase } from '@/lib/utils';
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
  selectedClients: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: () => void;
}

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: ClientSortField; 
  currentSortField?: ClientSortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 size-4 text-primary" /> : 
    <ArrowDown className="ml-2 size-4 text-primary" />;
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
  selectedClients,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
}: ClientsTableProps) => {
  const { isMobile } = useDeviceType();
  const navigate = useNavigate();
  const { clients: allClients } = useClients();

  const handleViewPipeline = (client: Client) => {
    navigate(`/clients/${client.id}/pipeline`);
  };

  const allPageSelected = clients.length > 0 && clients.every(c => selectedClients.has(c.id));
  const somePageSelected = clients.some(c => selectedClients.has(c.id));

  const handleHeaderCheckbox = () => {
    if (allPageSelected) {
      onDeselectAll();
    } else {
      onSelectAll(clients.map(c => c.id));
    }
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
        selectedClients={selectedClients}
        onToggleSelect={onToggleSelect}
      />
    );
  }

  if (clients.length === 0 && searchTerm) {
    return (
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">No se encontraron clientes</h3>
          <p className="mb-4 text-muted-foreground">No hay clientes que coincidan con "{searchTerm}"</p>
          <Button onClick={onNewClient} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="size-4 mr-2" />Agregar Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-8 text-center">
          <Users className="mx-auto mb-4 size-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-medium text-foreground">No hay clientes registrados</h3>
          <p className="mb-4 text-muted-foreground">Comienza agregando tu primer cliente al sistema</p>
          <Button onClick={onNewClient} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="size-4 mr-2" />Agregar Primer Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="flex items-center justify-between">
          <span>Clientes ({totalClients})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                <th className="py-3 px-2 w-10">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={handleHeaderCheckbox}
                    aria-label="Seleccionar todos"
                    className={somePageSelected && !allPageSelected ? 'opacity-50' : ''}
                  />
                </th>
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
                const isSelected = selectedClients.has(client.id);
                return (
                  <tr key={client.id} className={`border-b border-border/60 hover:bg-accent/20 ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="py-3 px-2">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(client.id)}
                        aria-label={`Seleccionar ${client.name}`}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewPipeline(client)}
                          className="text-left font-medium text-primary hover:underline"
                          title="Ir al Pipeline VIP"
                        >
                          {toTitleCase(client.name)}
                        </button>
                        {client.billingType === 'monthly' && (
                          <Badge variant="outline" className="border-info/20 px-1.5 py-0 text-[10px] text-info">
                            Mensual
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-foreground">{client.rut}</td>
                    <td className="py-3 px-4">
                      <DepartmentBadge department={client.department} clientRut={client.rut} clientName={toTitleCase(client.name)} allClients={allClients} />
                    </td>
                    <td className="py-3 px-4 text-foreground">{toTitleCase(client.contactName || '') || <span className="text-muted-foreground">-</span>}</td>
                    <td className="py-3 px-4">
                      {svcCount > 0 ? (
                        <button
                          onClick={() => handleViewPipeline(client)}
                          className="inline-flex items-center gap-1"
                          title="Ver servicios en Pipeline"
                        >
                          <Badge variant="outline" className="border-success/20 bg-success/10 text-success">
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
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-x-1">
                        <Button variant="ghost" size="sm" onClick={() => onViewDetails(client)} className="text-info hover:text-info hover:bg-info/10" title="Ver detalles">
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onEdit(client)} className="text-primary hover:text-primary/80 hover:bg-primary/10" title="Editar cliente">
                          <Edit className="size-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onToggleStatus(client)}>
                              {client.isActive ? (
                                <><UserX className="size-4 mr-2 text-red-500" />Desactivar</>
                              ) : (
                                <><UserCheck className="size-4 mr-2 text-green-500" />Activar</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(client)} className="text-destructive">
                              <Trash2 className="size-4 mr-2" />Eliminar
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
