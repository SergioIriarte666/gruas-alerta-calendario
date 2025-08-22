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
    if (loading) return <Activity className="h-5 w-5 animate-spin text-muted-foreground" />;
    
    switch (diagnosis.system_health) {
      case 'HEALTHY':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'NEEDS_REPAIR':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'ERROR':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getHealthColor = () => {
    switch (diagnosis.system_health) {
      case 'HEALTHY':
        return 'bg-green-50 border-green-200';
      case 'NEEDS_REPAIR':
        return 'bg-yellow-50 border-yellow-200';
      case 'ERROR':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-muted/50 border-border';
    }
  };

  const getHealthBadge = () => {
    if (loading) {
      return <Badge variant="secondary">Validando...</Badge>;
    }

    switch (diagnosis.system_health) {
      case 'HEALTHY':
        return <Badge variant="secondary" className="bg-green-100 text-green-700">Saludable</Badge>;
      case 'NEEDS_REPAIR':
        return <Badge variant="destructive">Requiere Atención</Badge>;
      case 'ERROR':
        return <Badge variant="destructive">Error del Sistema</Badge>;
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
              <p className="text-sm text-green-700">
                ✅ Todos los sistemas funcionan correctamente
              </p>
            )}
            
            {diagnosis.system_health === 'NEEDS_REPAIR' && (
              <div className="space-y-2">
                <p className="text-sm text-yellow-700 font-medium">
                  ⚠️ {diagnosis.total_issues} problema{diagnosis.total_issues !== 1 ? 's' : ''} detectado{diagnosis.total_issues !== 1 ? 's' : ''}:
                </p>
                <ul className="text-xs space-y-1 text-yellow-600">
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
                <p className="text-sm text-red-700 font-medium">
                  ❌ Error del sistema detectado
                </p>
                {diagnosis.issues.error && (
                  <p className="text-xs text-red-600">
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