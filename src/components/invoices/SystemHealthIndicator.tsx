import React from 'react';
import { AlertTriangle, CheckCircle, XCircle, Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SystemHealthProps {
  diagnosis: {
    system_health: 'HEALTHY' | 'NEEDS_REPAIR' | 'ERROR' | 'UNKNOWN';
    issues: {
      inconsistent_payments?: number;
      inconsistent_invoices?: number;
      duplicate_applications?: number;
      orphaned_applications?: number;
      error?: string;
    };
    total_issues: number;
    timestamp?: string;
  };
  loading?: boolean;
}

export const SystemHealthIndicator: React.FC<SystemHealthProps> = ({ 
  diagnosis, 
  loading = false 
}) => {
  const getHealthIcon = () => {
    if (loading) return <Activity className="size-5 animate-spin text-muted-foreground" />;
    
    switch (diagnosis.system_health) {
      case 'HEALTHY':
        return <CheckCircle className="size-5 text-success" />;
      case 'NEEDS_REPAIR':
        return <AlertTriangle className="size-5 text-warning" />;
      case 'ERROR':
        return <XCircle className="size-5 text-danger" />;
      default:
        return <Activity className="size-5 text-muted-foreground" />;
    }
  };

  const getHealthColor = () => {
    switch (diagnosis.system_health) {
      case 'HEALTHY':
        return 'bg-success/10 border-success/20';
      case 'NEEDS_REPAIR':
        return 'bg-warning/10 border-warning/20';
      case 'ERROR':
        return 'bg-danger/10 border-danger/20';
      default:
        return 'bg-muted/40 border-border/70';
    }
  };

  const getHealthBadge = () => {
    if (loading) {
      return <Badge variant="secondary">Validando...</Badge>;
    }

    switch (diagnosis.system_health) {
      case 'HEALTHY':
        return <Badge className="border-success/30 bg-success/10 text-success">Saludable</Badge>;
      case 'NEEDS_REPAIR':
        return <Badge className="border-warning/30 bg-warning/10 text-warning">Requiere Atención</Badge>;
      case 'ERROR':
        return <Badge className="border-danger/30 bg-danger/10 text-danger">Error del Sistema</Badge>;
      default:
        return <Badge variant="secondary">Estado Desconocido</Badge>;
    }
  };

  return (
    <Card className={`${getHealthColor()} transition-colors`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {getHealthIcon()}
          Estado del Sistema de Pagos
          {getHealthBadge()}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-0">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            Ejecutando diagnóstico completo del sistema...
          </p>
        ) : (
          <>
            {diagnosis.system_health === 'HEALTHY' && (
              <p className="text-sm text-success">
                ✅ Todos los sistemas funcionan correctamente
              </p>
            )}
            
            {diagnosis.system_health === 'NEEDS_REPAIR' && (
              <div className="space-y-2">
                <p className="text-sm text-warning font-medium">
                  ⚠️ {diagnosis.total_issues} problema{diagnosis.total_issues !== 1 ? 's' : ''} detectado{diagnosis.total_issues !== 1 ? 's' : ''}:
                </p>
                <ul className="text-xs space-y-1 text-warning">
                  {diagnosis.issues.inconsistent_payments ? (
                    <li>• {diagnosis.issues.inconsistent_payments} pagos con montos inconsistentes</li>
                  ) : null}
                  {diagnosis.issues.inconsistent_invoices ? (
                    <li>• {diagnosis.issues.inconsistent_invoices} facturas con estados incorrectos</li>
                  ) : null}
                  {diagnosis.issues.duplicate_applications ? (
                    <li>• {diagnosis.issues.duplicate_applications} aplicaciones duplicadas</li>
                  ) : null}
                  {diagnosis.issues.orphaned_applications ? (
                    <li>• {diagnosis.issues.orphaned_applications} aplicaciones huérfanas</li>
                  ) : null}
                </ul>
              </div>
            )}
            
            {diagnosis.system_health === 'ERROR' && (
              <div className="space-y-2">
                <p className="text-sm text-danger font-medium">
                  ❌ Error del sistema detectado
                </p>
                {diagnosis.issues.error && (
                  <p className="text-xs text-danger">
                    {diagnosis.issues.error}
                  </p>
                )}
              </div>
            )}
            
            {diagnosis.timestamp && (
              <p className="text-xs text-muted-foreground mt-2">
                Última validación: {new Date(diagnosis.timestamp).toLocaleString()}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
