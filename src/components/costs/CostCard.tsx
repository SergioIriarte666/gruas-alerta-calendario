import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cost } from '@/types/costs';
import { Edit, Trash2, Calendar, DollarSign, Tag, Truck, User, FileText, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CostCardProps {
  cost: Cost;
  onEdit: (cost: Cost) => void;
  onDelete: (cost: Cost) => void;
  onViewDetails?: (cost: Cost) => void;
  onDuplicate?: (cost: Cost) => void;
}

export const CostCard = ({ cost, onEdit, onDelete, onViewDetails, onDuplicate }: CostCardProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getCategoryDisplay = () => {
    if (cost.subcategory) {
      return `${cost.cost_categories?.name} > ${cost.subcategory}`;
    }
    return cost.cost_categories?.name || 'Sin categoría';
  };

  return (
    <Card className="bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in">
      <CardContent className="p-4">
        {/* Header con fecha y monto */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">{formatDate(cost.date)}</span>
          </div>
          <div className="flex items-center gap-1 text-lg font-bold text-tms-green">
            <DollarSign className="w-5 h-5" />
            <span>{formatCurrency(Number(cost.amount))}</span>
          </div>
        </div>

        {/* Categorización */}
        <div className="flex items-center gap-2 mb-2">
          <Tag className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            {getCategoryDisplay()}
          </span>
        </div>

        {/* Descripción */}
        <p className="text-gray-800 dark:text-gray-200 mb-3 font-medium">
          {cost.description}
        </p>

        {/* Información de servicios asociados */}
        {(cost.cranes || cost.operators || cost.service_folio) && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 mb-3 space-y-2">
            {cost.cranes && (
              <div className="flex items-center gap-2 text-sm">
                <Truck className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  <strong>Grúa:</strong> {cost.cranes.license_plate}
                </span>
              </div>
            )}
            
            {cost.operators && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  <strong>Operador:</strong> {cost.operators.name}
                </span>
              </div>
            )}
            
            {cost.service_folio && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700 dark:text-gray-300">
                  <strong>Folio:</strong> {cost.service_folio}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Notas adicionales */}
        {cost.notes && (
          <div className="text-sm text-gray-600 dark:text-gray-400 italic mb-3">
            "{cost.notes}"
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(cost)}
            className="flex-1 hover-scale"
          >
            <Edit className="w-4 h-4 mr-1" />
            Editar
          </Button>
          
          {onDuplicate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDuplicate(cost)}
              className="hover-scale"
              title="Duplicar costo"
            >
              <Copy className="w-4 h-4" />
            </Button>
          )}
          
          {onViewDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewDetails(cost)}
              className="flex-1"
            >
              Ver detalles
            </Button>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(cost)}
            className="text-red-600 hover:text-red-700 hover:border-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};