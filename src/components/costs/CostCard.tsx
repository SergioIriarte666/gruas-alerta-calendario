import { businessClock } from '@/utils/businessClock';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Cost } from '@/types/costs';
import { Edit, Trash2, Calendar, DollarSign, Tag, Truck, User, FileText, Copy } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { getCostShortId } from '@/utils/costHelpers';

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
      return businessClock.format(dateString, 'dd/MM/yyyy', { locale: es });
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
    <Card className="bg-card shadow-sm hover:shadow-md transition-all duration-200 animate-fade-in">
      <CardContent className="p-4">
        {/* Header con fecha y monto */}
        <div className="flex justify-between items-start mb-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground ">
              <Calendar className="size-4" />
              <span className="font-medium">{formatDate(cost.date)}</span>
            </div>
            <Badge variant="outline" className="text-xs font-semibold uppercase tracking-widest">
              {getCostShortId(cost.id)}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-lg font-bold text-success-text">
            <DollarSign className="size-5" />
            <span>{formatCurrency(Number(cost.amount))}</span>
          </div>
        </div>

        {/* Categorización */}
        <div className="flex items-center gap-2 mb-2">
          <Tag className="size-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground  font-medium">
            {getCategoryDisplay()}
          </span>
        </div>

        {/* Descripción */}
        <p className="text-foreground  mb-3 font-medium">
          {cost.description}
        </p>

        {/* Información de servicios asociados */}
        {(cost.cranes || cost.operators || cost.service_folio) && (
          <div className="bg-muted/40 rounded-lg p-3 mb-3 space-y-2">
            {cost.cranes && (
              <div className="flex items-center gap-2 text-sm">
                <Truck className="size-4 text-muted-foreground" />
                <span className="text-foreground ">
                  <strong>Grúa:</strong> {cost.cranes.license_plate}
                </span>
              </div>
            )}
            
            {cost.operators && (
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 text-muted-foreground" />
                <span className="text-foreground ">
                  <strong>Operador:</strong> {cost.operators.name}
                </span>
              </div>
            )}
            
            {cost.service_folio && (
              <div className="flex items-center gap-2 text-sm">
                <FileText className="size-4 text-muted-foreground" />
                <span className="text-foreground ">
                  <strong>Folio:</strong> {cost.service_folio}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Notas adicionales */}
        {cost.notes && (
          <div className="text-sm text-muted-foreground  italic mb-3">
            "{cost.notes}"
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-2 border-t border-border ">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(cost)}
            className="flex-1 hover-scale"
          >
            <Edit className="size-4 mr-1" />
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
              <Copy className="size-4" />
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
            className="text-danger-text hover:text-danger-text hover:border-danger/30"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
