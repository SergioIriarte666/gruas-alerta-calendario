import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Eye, UserCheck, UserX, Plus, Users, Phone, IdCard, Briefcase } from 'lucide-react';
import { Operator } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { cn } from '@/lib/utils';
import { useDeviceType } from '@/hooks/useDeviceType';

interface OperatorsMobileViewProps {
  operators: Operator[];
  totalOperators: number;
  onEdit: (operator: Operator) => void;
  onDelete: (id: string, name: string) => void;
  onToggleStatus: (id: string, currentStatus: boolean, name: string) => void;
  onViewDetails: (operator: Operator) => void;
  onNewOperator: () => void;
  searchTerm: string;
}

export const OperatorsMobileView = ({
  operators,
  totalOperators,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewDetails,
  onNewOperator,
  searchTerm,
}: OperatorsMobileViewProps) => {
  const { isMobile } = useDeviceType();

  if (operators.length === 0 && searchTerm) {
    return (
      <Card className="bg-card border">
        <CardContent className="p-6 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No se encontraron operadores</h3>
          <p className="text-muted-foreground mb-4">
            No hay operadores que coincidan con "{searchTerm}"
          </p>
          <Button onClick={onNewOperator} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Operador
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (operators.length === 0) {
    return (
      <Card className="bg-card border">
        <CardContent className="p-6 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No hay operadores registrados</h3>
          <p className="text-muted-foreground mb-4">
            Comienza agregando tu primer operador al sistema
          </p>
          <Button onClick={onNewOperator} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Primer Operador
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Personal ({totalOperators})</h3>
      </div>
      
      {operators.map((operator) => (
        <Card key={operator.id} className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge 
                    variant={operator.operatorType === 'crane_operator' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {operator.operatorType === 'crane_operator' ? '🏗️ Operador' : '📋 Admin'}
                  </Badge>
                </div>
                <h4 className="font-semibold text-foreground text-lg">{operator.name}</h4>
              </div>
              <Badge 
                variant={operator.isActive ? "default" : "secondary"}
                className={operator.isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
                }
              >
                {operator.isActive ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center text-foreground text-sm">
                <IdCard className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>{operator.rut}</span>
              </div>

              <div className="flex items-center text-foreground text-sm">
                <Phone className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                <span>{operator.phone}</span>
              </div>

              {operator.operatorType === 'crane_operator' ? (
                <div className="flex items-center text-foreground text-sm">
                  <Briefcase className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <span>Licencia: {operator.licenseNumber || '-'}</span>
                </div>
              ) : (
                <div className="flex items-center text-foreground text-sm">
                  <Briefcase className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                  <span>{operator.position || operator.department || '-'}</span>
                </div>
              )}

              {operator.operatorType === 'crane_operator' && operator.examExpiry && (
                <div className="text-xs text-muted-foreground mt-1">
                  Vencimiento: {formatForDisplay(operator.examExpiry)}
                </div>
              )}
            </div>

            <div className={cn(
              "flex gap-2 mt-4",
              isMobile ? "flex-col" : "flex-wrap"
            )}>
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onViewDetails(operator)}
                className={cn(
                  "text-muted-foreground hover:text-foreground hover:bg-muted border border-border touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onEdit(operator)}
                className={cn(
                  "text-primary hover:text-primary/80 hover:bg-primary/10 border border-primary/50 touch-target",
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                <Edit className="w-4 h-4 mr-1" />
                Editar
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onToggleStatus(operator.id, operator.isActive, operator.name)}
                className={cn(
                  `border touch-target ${
                    operator.isActive 
                      ? 'text-red-600 hover:text-red-500 hover:bg-red-600/10 border-red-600/50' 
                      : 'text-green-600 hover:text-green-500 hover:bg-green-600/10 border-green-600/50'
                  }`,
                  isMobile ? "w-full" : "flex-1"
                )}
              >
                {operator.isActive ? <UserX className="w-4 h-4 mr-1" /> : <UserCheck className="w-4 h-4 mr-1" />}
                {operator.isActive ? 'Desactivar' : 'Activar'}
              </Button>
              
              <Button
                variant="ghost"
                size={isMobile ? "default" : "sm"}
                onClick={() => onDelete(operator.id, operator.name)}
                className={cn(
                  "text-red-600 hover:text-red-500 hover:bg-red-600/10 border border-red-600/50 touch-target",
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
