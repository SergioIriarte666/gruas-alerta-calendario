
import { Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServiceTypeConfig } from '@/types/serviceTypes';
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
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <p className="text-black mb-4">No hay tipos de servicio configurados</p>
        <p className="text-sm text-gray-600">
          Crea un nuevo tipo de servicio para comenzar
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-200 hover:bg-gray-50">
            <TableHead className="text-black">Nombre</TableHead>
            <TableHead className="text-black">Descripción</TableHead>
            <TableHead className="text-black">Precio Base</TableHead>
            <TableHead className="text-black">Estado</TableHead>
            <TableHead className="text-black">Campos Requeridos</TableHead>
            <TableHead className="text-black">Vehículo Opcional</TableHead>
            <TableHead className="text-black text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {serviceTypes.map((serviceType) => (
            <TableRow key={serviceType.id} className="border-gray-200 hover:bg-gray-50">
              <TableCell className="text-black font-medium">
                {serviceType.name}
              </TableCell>
              <TableCell className="text-black">
                {serviceType.description || '-'}
              </TableCell>
              <TableCell className="text-black">
                {formatPrice(serviceType.basePrice)}
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={serviceType.isActive 
                    ? "bg-tms-green/20 text-black border-tms-green/30" 
                    : "bg-gray-100 text-black border-gray-300"}
                >
                  {serviceType.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell className="text-black">
                <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-50">
                  {getRequiredFieldsCount(serviceType)} de 8
                </Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={serviceType.vehicleInfoOptional 
                    ? "bg-tms-green/20 text-black border-tms-green/30" 
                    : "bg-gray-100 text-black border-gray-300"}
                >
                  {serviceType.vehicleInfoOptional ? 'Sí' : 'No'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(serviceType)}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(serviceType)}
                    className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(serviceType)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
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
