
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
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-400 mb-4">No hay tipos de servicio configurados</p>
        <p className="text-sm text-gray-500">
          Crea un nuevo tipo de servicio para comenzar
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gray-700 hover:bg-gray-750">
            <TableHead className="text-gray-300">Nombre</TableHead>
            <TableHead className="text-gray-300">Descripción</TableHead>
            <TableHead className="text-gray-300">Precio Base</TableHead>
            <TableHead className="text-gray-300">Estado</TableHead>
            <TableHead className="text-gray-300">Campos Requeridos</TableHead>
            <TableHead className="text-gray-300">Vehículo Opcional</TableHead>
            <TableHead className="text-gray-300 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {serviceTypes.map((serviceType) => (
            <TableRow key={serviceType.id} className="border-gray-700 hover:bg-gray-750">
              <TableCell className="text-white font-medium">
                {serviceType.name}
              </TableCell>
              <TableCell className="text-gray-300">
                {serviceType.description || '-'}
              </TableCell>
              <TableCell className="text-gray-300">
                {formatPrice(serviceType.basePrice)}
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={serviceType.isActive 
                    ? "bg-tms-green/20 text-tms-green border-tms-green/30" 
                    : "bg-gray-600/20 text-gray-400 border-gray-600/30"
                  }
                >
                  {serviceType.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </TableCell>
              <TableCell className="text-gray-300">
                <Badge variant="outline" className="border-blue-500 text-blue-400">
                  {getRequiredFieldsCount(serviceType)} de 8
                </Badge>
              </TableCell>
              <TableCell>
                <Badge 
                  variant="outline"
                  className={serviceType.vehicleInfoOptional 
                    ? "bg-tms-green/20 text-tms-green border-tms-green/30" 
                    : "bg-gray-600/20 text-gray-400 border-gray-600/30"
                  }
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
                    className="text-blue-400 hover:text-blue-300 hover:bg-gray-700"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(serviceType)}
                    className="text-yellow-400 hover:text-yellow-300 hover:bg-gray-700"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(serviceType)}
                    className="text-red-400 hover:text-red-300 hover:bg-gray-700"
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
