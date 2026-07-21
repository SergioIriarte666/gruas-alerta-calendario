import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Edit, Eye, Plus, Users, Phone, Mail, User, MoreHorizontal, UserCheck, UserX, Trash2, TrendingUp } from 'lucide-react';
import { Client } from '@/types';
import { useNavigate } from 'react-router-dom';
import { DepartmentBadge } from './DepartmentBadge';
import { toTitleCase } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ClientsMobileViewProps {
  clients: Client[];
  totalClients: number;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onToggleStatus: (client: Client) => void;
  onViewDetails: (client: Client) => void;
  onNewClient: () => void;
  searchTerm: string;
  allClients: Client[];
  serviceCountByClient?: Map<string, number>;
  selectedClients?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export const ClientsMobileView = ({
  clients, totalClients, onEdit, onDelete, onToggleStatus, onViewDetails, onNewClient, searchTerm, allClients, serviceCountByClient,
  selectedClients, onToggleSelect,
}: ClientsMobileViewProps) => {
  const navigate = useNavigate();

  const handleViewPipeline = (client: Client) => {
    navigate(`/clients/${client.id}/pipeline`);
  };

  if (clients.length === 0) {
    return (
      <Card className="operations-panel">
        <CardContent className="p-6 text-center">
          <Users className="mx-auto size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes registrados'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? `No hay clientes que coincidan con "${searchTerm}"` : 'Comienza agregando tu primer cliente al sistema'}
          </p>
          <Button onClick={onNewClient} className="dashboard-report-button">
            <Plus className="size-4 mr-2" />{searchTerm ? 'Agregar Cliente' : 'Agregar Primer Cliente'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Clientes ({totalClients})</h3>
      </div>
      
      {clients.map((client) => {
        const svcCount = serviceCountByClient?.get(client.id) || 0;
        const isSelected = selectedClients?.has(client.id) ?? false;
        return (
          <Card key={client.id} className={`operations-panel ${isSelected ? 'ring-2 ring-primary/50' : ''}`}>
            <CardContent className="p-4">
              {/* Header: checkbox + clickable name + status */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  {onToggleSelect && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(client.id)}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1">
                    <button onClick={() => handleViewPipeline(client)} className="font-semibold text-primary text-lg hover:underline text-left">
                      {toTitleCase(client.name)}
                    </button>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <p className="text-foreground text-sm font-medium">{client.rut}</p>
                      <span className="text-muted-foreground">•</span>
                      <DepartmentBadge department={client.department} clientRut={client.rut} clientName={toTitleCase(client.name)} allClients={allClients} className="text-sm" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {svcCount > 0 && (
                    <Badge variant="outline" className="border-success/30 bg-success-soft text-xs text-success">
                      {svcCount} <TrendingUp className="size-3 ml-0.5" />
                    </Badge>
                  )}
                  <Badge variant={client.isActive ? "default" : "secondary"} className={client.isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}>
                    {client.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5 mb-3">
                {client.email && (
                  <div className="flex items-center text-foreground text-sm">
                    <Mail className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center text-foreground text-sm">
                    <Phone className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                )}
                {client.contactName && (
                  <div className="flex items-center text-foreground text-sm">
                    <User className="size-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="truncate">{toTitleCase(client.contactName)}</span>
                  </div>
                )}
              </div>

              {/* Simplified actions: View, Edit, Menu */}
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => onViewDetails(client)} className="flex-1 border border-info/40 text-info hover:bg-info/10 hover:text-info">
                  <Eye className="size-4 mr-1" />Ver
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(client)} className="text-primary hover:text-primary/80 hover:bg-primary/10 border border-primary/50 flex-1">
                  <Edit className="size-4 mr-1" />Editar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground border border-border">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleViewPipeline(client)}>
                      <TrendingUp className="mr-2 size-4 text-primary" />Pipeline VIP
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onToggleStatus(client)}>
                      {client.isActive ? <><UserX className="mr-2 size-4 text-danger" />Desactivar</> : <><UserCheck className="mr-2 size-4 text-success" />Activar</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDelete(client)} className="text-destructive">
                      <Trash2 className="size-4 mr-2" />Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
