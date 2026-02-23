import { Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceTypeConfig } from '@/types/serviceTypes';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ServiceTypesTableProps {
  serviceTypes: ServiceTypeConfig[];
  onEdit: (serviceType: ServiceTypeConfig) => void;
  onDelete: (serviceType: ServiceTypeConfig) => void;
  onView: (serviceType: ServiceTypeConfig) => void;
}

export const ServiceTypesTable = ({ serviceTypes, onEdit, onDelete, onView }: ServiceTypesTableProps) => {
  const isMobile = useIsMobile();

  const getRequiredFieldsCount = (serviceType: ServiceTypeConfig) => {
    const fields = [
      serviceType.purchaseOrderRequired,
      serviceType.originRequired,
      serviceType.destinationRequired,
      serviceType.craneRequired,
      serviceType.operatorRequired,
      serviceType.vehicleBrandRequired,
      serviceType.vehicleModelRequired,
      serviceType.licensePlateRequired
    ];
    return fields.filter(Boolean).length;
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'No definido';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP'
    }).format(price);
  };

  if (serviceTypes.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center">
        <p className="text-foreground mb-4">No hay tipos de servicio configurados</p>
        <p className="text-sm text-muted-foreground">
          Crea un nuevo tipo de servicio para comenzar
        </p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {serviceTypes.map((serviceType) => (
          <Card key={serviceType.id} className="bg-card border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-foreground text-sm truncate">{serviceType.name}</h4>
                  {serviceType.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{serviceType.description}</p>
                  )}
                </div>
                <Badge variant={serviceType.isActive ? "default" : "secondary"} className="ml-2 flex-shrink-0 text-xs">
                  {serviceType.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{formatPrice(serviceType.basePrice)}</span>
                <span>•</span>
                <span>{getRequiredFieldsCount(serviceType)}/8 campos</span>
                {serviceType.vehicleInfoOptional && (
                  <>
                    <span>•</span>
                    <span>Vehículo opcional</span>
                  </>
                )}
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t">
                <Button variant="ghost" size="sm" onClick={() => onView(serviceType)} className="flex-1 text-xs h-8">
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(serviceType)} className="flex-1 text-xs h-8">
                  <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDelete(serviceType)} className="text-destructive text-xs h-8 px-2">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-muted/50">
            <TableHead className="text-foreground">Nombre</TableHead>
            <TableHead className="text-foreground">Descripción</TableHead>
            <TableHead className="text-foreground">Precio Base</TableHead>
            <TableHead className="text-foreground">Estado</TableHead>
            <TableHead className="text-foreground">Campos Requeridos</TableHead>
            <TableHead className="text-foreground">Vehículo Opcional</TableHead>
            <TableHead className="text-foreground text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {serviceTypes.map((serviceType) => (
            <TableRow key={serviceType.id} className="border-border hover:bg-muted/50">
              <TableCell className="text-foreground font-medium">
                {serviceType.name}
              </TableCell>
              <TableCell className="text-foreground">
                {serviceType.description || '-'}
              </TableCell>
              <TableCell className="text-foreground">
                {formatPrice(serviceType.basePrice)}
              </TableCell>
              <TableCell>
                <Badge 
                  variant={serviceType.isActive ? "default" : "secondary"}
                >
                  {serviceType.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell className="text-foreground">
                <Badge variant="secondary">
                  {getRequiredFieldsCount(serviceType)} de 8
                </Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={serviceType.vehicleInfoOptional ? "default" : "secondary"}
                >
                  {serviceType.vehicleInfoOptional ? 'Sí' : 'No'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => onView(serviceType)} className="text-secondary hover:text-secondary hover:bg-muted">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(serviceType)} className="text-accent hover:text-accent hover:bg-muted">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(serviceType)} className="text-destructive hover:text-destructive hover:bg-muted">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};