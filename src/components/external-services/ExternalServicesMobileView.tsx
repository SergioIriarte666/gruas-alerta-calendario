import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, FileCheck2 } from 'lucide-react';
import { formatBusinessDateLong } from '@/utils/timezoneUtils';
import type { ExternalServiceListItem } from '@/hooks/useExternalServices';

interface Props {
  services: ExternalServiceListItem[];
  onSelect: (svc: ExternalServiceListItem) => void;
}

const formatCurrency = (amount: number | null) => {
  if (!amount) return 'Sin costo informado';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const ExternalServicesMobileView = ({ services, onSelect }: Props) => {
  return (
    <div className="space-y-3">
      {services.map((s) => (
        <Card key={s.id} data-closed={s.hasClosure} className="external-service-mobile-card overflow-hidden">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-sm font-semibold">{s.folio}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.serviceTypeName}</div>
              </div>
              {s.hasClosure ? (
                <Badge className="border-success/30 bg-success/10 text-xs text-success">Cerrado</Badge>
              ) : (
                <Badge className="border-warning/30 bg-warning/10 text-xs text-warning">Pendiente</Badge>
              )}
            </div>

            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div>{formatBusinessDateLong(s.serviceDate)}</div>
              <div>{s.clientName ?? '—'}</div>
              {s.vehicleBrand && (
                <div>{s.vehicleBrand} {s.vehicleModel} ({s.licensePlate ?? 'S/P'})</div>
              )}
              <div className="pt-1 font-medium text-foreground">{formatCurrency(s.outsourcedCost)}</div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className={s.hasClosure ? 'w-full border-info/30 text-info hover:bg-info/10' : 'external-services-primary-action w-full'}
              onClick={() => onSelect(s)}
            >
              {s.hasClosure ? (
                <>
                  <Eye className="mr-1 size-3.5" />
                  Ver detalle
                </>
              ) : (
                <>
                  <FileCheck2 className="mr-1 size-3.5" />
                  Cerrar con evidencia
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
