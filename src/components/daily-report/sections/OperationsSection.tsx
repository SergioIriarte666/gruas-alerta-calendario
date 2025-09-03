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
  FileText,
  Eye,
  Calendar
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

  const getAlertLevel = (daysUntilExpiry: number) => {
    if (daysUntilExpiry < 0) return { color: 'red', text: 'Vencido' };
    if (daysUntilExpiry <= 7) return { color: 'red', text: 'Crítico' };
    if (daysUntilExpiry <= 30) return { color: 'orange', text: 'Urgente' };
    return { color: 'yellow', text: 'Atención' };
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
    const today = new Date();
    const expiryDate = new Date(
      alert.technical_review_expiry || 
      alert.insurance_expiry || 
      alert.circulation_permit_expiry
    );
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const alertLevel = getAlertLevel(daysUntilExpiry);

    return (
      <Card className={`border-${alertLevel.color}-200 bg-${alertLevel.color}-50`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 text-${alertLevel.color}-500`} />
                <span className="font-medium">{alert.brand} {alert.model}</span>
                <Badge variant={alertLevel.color === 'red' ? 'destructive' : 'secondary'}>
                  {alertLevel.text}
                </Badge>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Documento:</strong> {getDocumentTypeName(alert.document_type)}</p>
                <p><strong>Vencimiento:</strong> {expiryDate.toLocaleDateString()}</p>
                <p><strong>Días restantes:</strong> {daysUntilExpiry} días</p>
              </div>
            </div>
            
            <Button variant="ghost" size="sm" onClick={() => onViewCrane?.(alert)}>
              <Eye className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const OperatorAssignmentCard = ({ operator }: { operator: any }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <span className="font-medium">{operator.name}</span>
              <Badge variant="default">Asignado</Badge>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p><strong>Servicios del día:</strong> {operator.services.length}</p>
              {operator.services.slice(0, 2).map((service: any) => (
                <p key={service.id} className="text-xs">
                  • Servicio {service.id.slice(0, 8)}... ({service.status})
                </p>
              ))}
              {operator.services.length > 2 && (
                <p className="text-xs">y {operator.services.length - 2} más...</p>
              )}
            </div>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => onViewOperator?.(operator)}>
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

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
              <Truck className="w-8 h-8 text-green-500" />
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
              <Clock className="w-8 h-8 text-orange-500" />
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
              <Users className="w-8 h-8 text-blue-500" />
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
              <CheckCircle className="w-8 h-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Documentos */}
      {data.documentAlerts.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
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
              <Users className="w-5 h-5 text-blue-500" />
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

      {/* Estado de Grúas con Alertas */}
      {data.cranes.alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-orange-500" />
              Grúas con Alertas
              <Badge variant="outline">{data.cranes.alerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.cranes.alerts.map((crane, index) => (
                <Card key={index} className="border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-orange-500" />
                          <span className="font-medium">{crane.brand} {crane.model}</span>
                          <Badge variant="secondary">Requiere atención</Badge>
                        </div>
                        
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Patente:</strong> {crane.license_plate}</p>
                          <p><strong>Estado:</strong> {crane.is_active ? 'Activa' : 'Inactiva'}</p>
                        </div>
                      </div>
                      
                      <Button variant="ghost" size="sm" onClick={() => onViewCrane?.(crane)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sin alertas operacionales */}
      {data.documentAlerts.length === 0 && 
       data.cranes.alerts.length === 0 && 
       data.operators.assignments.length === 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center space-y-2">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
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