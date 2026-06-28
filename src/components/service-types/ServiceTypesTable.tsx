import { Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ServiceTypeConfig } from '@/types/serviceTypes';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { getServiceCategoryLabel, getServiceCategoryBadgeClasses } from '@/utils/serviceCategoryLabels';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
                <div className="flex flex-col gap-1 items-end ml-2 flex-shrink-0">
                  <Badge variant={serviceType.isActive ? "default" : "secondary"} className="text-xs">
                    {serviceType.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn('text-xs font-normal', getServiceCategoryBadgeClasses(serviceType.serviceCategory))}
                  >
                    {getServiceCategoryLabel(serviceType.serviceCategory)}
                  </Badge>
                </div>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(serviceType)}
                  className="flex-1 text-xs h-8 text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950"
                >
                  <Eye className="size-3.5 mr-1" /> Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(serviceType)}
                  className="flex-1 text-xs h-8 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-950"
                >
                  <Edit className="size-3.5 mr-1" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(serviceType)}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 text-xs h-8 px-2"
                >
                  <Trash2 className="size-3.5" />
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
            <TableHead className="text-foreground">Categoría</TableHead>
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
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn('text-xs font-normal', getServiceCategoryBadgeClasses(serviceType.serviceCategory))}
                >
                  {getServiceCategoryLabel(serviceType.serviceCategory)}
                </Badge>
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
                <TooltipProvider delayDuration={300}>
                  <div className="flex gap-1 justify-end">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onView(serviceType)}
                          className="size-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950"
                          aria-label="Ver detalles"
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver detalles</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(serviceType)}
                          className="size-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:text-amber-300 dark:hover:bg-amber-950"
                          aria-label="Editar"
                        >
                          <Edit className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(serviceType)}
                          className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Eliminar</TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};