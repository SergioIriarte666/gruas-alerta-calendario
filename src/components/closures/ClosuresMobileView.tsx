import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, FileText, Calendar, DollarSign, FolderOpen } from 'lucide-react';
import { ServiceClosure, Client } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';

interface ClosuresMobileViewProps {
  closures: ServiceClosure[];
  clients: Client[];
  onEdit: (closure: ServiceClosure) => void;
  onDelete: (id: string, folio: string) => void;
  onClose: (id: string, folio: string) => void;
  onViewDetails: (closure: ServiceClosure) => void;
}

export const ClosuresMobileView = ({
  closures,
  clients,
  onEdit,
  onDelete,
  onClose,
  onViewDetails,
}: ClosuresMobileViewProps) => {
  const { isMobile } = useDeviceType();

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Cliente desconocido';
  };

  const getStatusBadge = (status: ServiceClosure['status']) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-yellow-500 text-white">Abierto</Badge>;
      case 'closed':
        return <Badge className="bg-blue-500 text-white">Cerrado</Badge>;
      case 'invoiced':
        return <Badge className="bg-green-500 text-white">Facturado</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground">Desconocido</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  if (closures.length === 0) {
    return (
      <Card className="bg-card border">
        <CardContent className="p-6 text-center">
          <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron cierres</h3>
          <p className="text-muted-foreground">
            No hay cierres que mostrar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Cierres ({closures.length})</h3>
      </div>
      
      {closures.map((closure) => (
        <Card key={closure.id} className="bg-card border" onClick={() => onViewDetails(closure)}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-lg">{closure.folio}</h4>
                <p className="text-primary text-sm font-medium">{getClientName(closure.clientId)}</p>
              </div>
              {getStatusBadge(closure.status)}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-foreground text-sm">
                <Calendar className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>
                  {formatForDisplay(closure.dateRange.from)} - {formatForDisplay(closure.dateRange.to)}
                </span>
              </div>

              <div className="flex items-center text-foreground text-sm">
                <FileText className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>{closure.serviceIds.length} servicios</span>
              </div>

              <div className="flex items-center text-foreground text-sm font-medium">
                <DollarSign className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>{formatCurrency(closure.total)}</span>
              </div>
            </div>

            <div className={cn(
              "flex gap-2 mt-4",
              isMobile ? "flex-col" : "flex-wrap"
            )} onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => onViewDetails(closure)}
                className={cn(isMobile ? "w-full" : "flex-1")}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver
              </Button>
              
              {closure.status === 'open' && (
                <Button
                  variant="outline"
                  size={isMobile ? "default" : "sm"}
                  onClick={() => onClose(closure.id, closure.folio)}
                  className={cn(isMobile ? "w-full" : "flex-1")}
                >
                  <FileText className="w-4 h-4 mr-1" />
                  Cerrar
                </Button>
              )}
              
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => onEdit(closure)}
                className={cn(isMobile ? "w-full" : "flex-1")}
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
              
              <Button
                variant="outline"
                size={isMobile ? "default" : "sm"}
                onClick={() => onDelete(closure.id, closure.folio)}
                className={cn(
                  "text-destructive border-destructive/40 hover:bg-destructive/10",
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
