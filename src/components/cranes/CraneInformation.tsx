import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Truck, FileText } from 'lucide-react';
import { Crane } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { businessClock } from '@/utils/businessClock';
import { getCraneTypeLabel } from '@/utils/craneType';
import { getCraneStatusLabel } from '@/utils/craneStatus';

interface CraneInformationProps {
  crane: Crane;
}

export const CraneInformation = ({ crane }: CraneInformationProps) => {
  const getDaysUntilExpiry = (date: string) => {
    const expiry = new Date(date);
    const today = businessClock.todayDate();
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpiryBadge = (days: number) => {
    if (days <= 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    } else if (days <= 30) {
      return <Badge variant="secondary" className="bg-warning/20 text-warning-text">Por vencer</Badge>;
    } else {
      return <Badge variant="default" className="bg-success/20 text-success-text">Vigente</Badge>;
    }
  };

  const technicalReviewDays = getDaysUntilExpiry(crane.technicalReviewExpiry);
  const insuranceDays = getDaysUntilExpiry(crane.insuranceExpiry);
  const permitDays = getDaysUntilExpiry(crane.circulationPermitExpiry);

  return (
    <div className="space-y-6">
      {/* Información Básica */}
      <Card className="bg-card/5 border-primary/30">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            Información Básica
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground text-sm">Patente</label>
                <p className="text-foreground font-medium">{crane.licensePlate}</p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm">Empresa</label>
                <p className="text-foreground">
                  {crane.ownerCompanyName || crane.ownerCompanyRut || 'Sin empresa'}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm">Marca</label>
                <p className="text-foreground">{crane.brand}</p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm">Modelo</label>
                <p className="text-foreground">{crane.model}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-muted-foreground text-sm">Tipo</label>
                <p className="text-foreground">{getCraneTypeLabel(crane.type)}</p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm">Estado</label>
                <div>
                  <Badge 
                    variant={crane.status === 'active' ? "default" : "secondary"}
                    className={crane.status === 'active'
                      ? "bg-primary/20 text-primary border-primary/50"
                      : "bg-muted/20 text-muted-foreground border-border/50"
                    }
                  >
                    {getCraneStatusLabel(crane.status)}
                  </Badge>
                </div>
              </div>
              <div>
                <label className="text-muted-foreground text-sm">Fecha de Registro</label>
                <p className="text-foreground">{formatForDisplay(crane.createdAt)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documentación Legal */}
      <Card className="bg-card/5 border-primary/30">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Documentación Legal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-sm">Revisión Técnica</label>
                {getExpiryBadge(technicalReviewDays)}
              </div>
              <p className="text-foreground">{formatForDisplay(crane.technicalReviewExpiry)}</p>
              <p className="text-muted-foreground text-xs">
                {technicalReviewDays <= 0 
                  ? `Vencido hace ${Math.abs(technicalReviewDays)} días`
                  : `Vence en ${technicalReviewDays} días`
                }
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-sm">Seguro</label>
                {getExpiryBadge(insuranceDays)}
              </div>
              <p className="text-foreground">{formatForDisplay(crane.insuranceExpiry)}</p>
              <p className="text-muted-foreground text-xs">
                {insuranceDays <= 0 
                  ? `Vencido hace ${Math.abs(insuranceDays)} días`
                  : `Vence en ${insuranceDays} días`
                }
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-muted-foreground text-sm">Permiso Circulación</label>
                {getExpiryBadge(permitDays)}
              </div>
              <p className="text-foreground">{formatForDisplay(crane.circulationPermitExpiry)}</p>
              <p className="text-muted-foreground text-xs">
                {permitDays <= 0 
                  ? `Vencido hace ${Math.abs(permitDays)} días`
                  : `Vence en ${permitDays} días`
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Historial de Cambios */}
      <Card className="bg-card/5 border-primary/30">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Calendar className="size-5 text-primary" />
            Historial de Registro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-muted-foreground text-sm">Fecha de Creación</label>
              <p className="text-foreground">{formatForDisplay(crane.createdAt)}</p>
            </div>
            <div>
              <label className="text-muted-foreground text-sm">Última Actualización</label>
              <p className="text-foreground">{formatForDisplay(crane.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
