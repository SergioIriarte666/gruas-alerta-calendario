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

export const ExternalServicesMobileView = ({ services, onSelect }: Props) => {
  return (
    <div className="space-y-3">
      {services.map((s) => (
        <Card key={s.id} className="border bg-card">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-sm font-semibold">{s.folio}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.serviceTypeName}</div>
              </div>
              {s.hasClosure ? (
                <Badge className="border-green-300 bg-green-100 text-xs text-green-800">Cerrado</Badge>
              ) : (
                <Badge className="border-amber-300 bg-amber-100 text-xs text-amber-800">Pendiente</Badge>
              )}
            </div>

            <div className="space-y-0.5 text-xs text-muted-foreground">
              <div>{formatBusinessDateLong(s.serviceDate)}</div>
              <div>{s.clientName ?? '—'}</div>
              {s.vehicleBrand && (
                <div>{s.vehicleBrand} {s.vehicleModel} ({s.licensePlate ?? 'S/P'})</div>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
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
