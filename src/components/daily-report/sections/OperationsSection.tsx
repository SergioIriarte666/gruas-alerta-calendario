import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Truck,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye
} from 'lucide-react';

interface OperationsSectionProps {
  data?: {
    cranes: {
      active: number;
      maintenance: number;
      alerts: any[];
    };
    operators: {
      assigned: number;
      available: number;
      assignments: any[];
    };
    documentAlerts: any[];
  } | null;
  onViewCrane?: (crane: any) => void;
  onViewOperator?: (operator: any) => void;
}

export const OperationsSection = ({ data, onViewCrane, onViewOperator }: OperationsSectionProps) => {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center">No hay datos de operaciones disponibles</p>
        </CardContent>
      </Card>
    );
  }

  const getAlertLevel = (priority: string) => {
    switch (priority) {
      case 'VENCIDO':
        return { tone: 'danger', text: 'Vencido', cardClass: 'border-danger/30 bg-danger/5', iconClass: 'text-danger' };
      case 'CRÍTICO':
        return { tone: 'danger', text: 'Crítico', cardClass: 'border-danger/30 bg-danger/5', iconClass: 'text-danger' };
      case 'URGENTE':
        return { tone: 'warning', text: 'Urgente', cardClass: 'border-warning/30 bg-warning/5', iconClass: 'text-warning' };
      case 'PRÓXIMO':
        return { tone: 'warning', text: 'Próximo', cardClass: 'border-warning/30 bg-warning/5', iconClass: 'text-warning' };
      default:
        return { tone: 'warning', text: 'Atención', cardClass: 'border-warning/30 bg-warning/5', iconClass: 'text-warning' };
    }
  };

  const getDocumentTypeName = (type: string) => {
    switch (type) {
      case 'technical_review':
        return 'Revisión Técnica';
      case 'insurance':
        return 'Seguro';
      case 'circulation_permit':
        return 'Permiso de Circulación';
      default:
        return type;
    }
  };

  const AlertCard = ({ alert }: { alert: any }) => {
    const alertLevel = getAlertLevel(alert.priority);
    const expiryDate = new Date(alert.expiryDate);

    return (
      <Card className={alertLevel.cardClass}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`size-4 ${alertLevel.iconClass}`} />
                <span className="font-medium">{alert.crane}</span>
                <Badge variant={alertLevel.tone === 'danger' ? 'destructive' : 'secondary'}>
                  {alertLevel.text}
                </Badge>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Patente:</strong> {alert.licensePlate}</p>
                <p><strong>Documento:</strong> {getDocumentTypeName(alert.type)}</p>
                <p><strong>Vencimiento:</strong> {expiryDate.toLocaleDateString('es-CL')}</p>
                <p><strong>Días restantes:</strong> {alert.daysRemaining} días</p>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={() => onViewCrane?.(alert)}>
              <Eye className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const OperatorAssignmentCard = ({ operator }: { operator: any }) => {
    const services = operator.services || [];
    
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="size-4 text-blue-500" />
                <span className="font-medium">{operator.name}</span>
                <Badge variant="default">Asignado</Badge>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p><strong>Servicios del día:</strong> {services.length}</p>
                {services.length > 0 ? (
                  <>
                    {services.slice(0, 2).map((service: any) => (
                      <p key={service.id} className="text-xs">
                        • Servicio {service.id.slice(0, 8)}... ({service.status})
                      </p>
                    ))}
                    {services.length > 2 && (
                      <p className="text-xs">y {services.length - 2} más...</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin servicios asignados</p>
                )}
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={() => onViewOperator?.(operator)}>
              <Eye className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Resumen de Recursos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Grúas Activas</p>
                <p className="text-2xl font-bold text-green-600">{data.cranes.active}</p>
              </div>
              <Truck className="size-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En Mantención</p>
                <p className="text-2xl font-bold text-orange-600">{data.cranes.maintenance}</p>
              </div>
              <Clock className="size-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Operadores Asignados</p>
                <p className="text-2xl font-bold text-blue-600">{data.operators.assigned}</p>
              </div>
              <Users className="size-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Disponibles</p>
                <p className="text-2xl font-bold text-gray-600">{data.operators.available}</p>
              </div>
              <CheckCircle className="size-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Documentos */}
      {data.documentAlerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="size-5" />
              Alertas de Documentos
              <Badge variant="destructive">{data.documentAlerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.documentAlerts.map((alert, index) => (
                <AlertCard key={index} alert={alert} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asignaciones de Operadores */}
      {data.operators.assignments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="size-5 text-blue-500" />
              Asignaciones de Operadores
              <Badge variant="outline">{data.operators.assignments.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.operators.assignments.map((operator) => (
                <OperatorAssignmentCard key={operator.id} operator={operator} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sin alertas operacionales */}
      {data.documentAlerts.length === 0 && 
       data.operators.assignments.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <CheckCircle className="size-12 text-green-500 mx-auto" />
              <p className="text-muted-foreground">
                No hay alertas operacionales para este día
              </p>
              <p className="text-sm text-muted-foreground">
                Todas las operaciones están funcionando normalmente
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
