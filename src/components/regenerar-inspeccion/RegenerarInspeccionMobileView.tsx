import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, Camera, Eye, FileCheck2, FileWarning, User } from 'lucide-react';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { ServicioConFotos } from '@/types/regenerar-inspeccion';

interface RegenerarInspeccionMobileViewProps {
  servicios: ServicioConFotos[];
  onPreview: (servicio: ServicioConFotos) => void;
}

export const RegenerarInspeccionMobileView = ({ servicios, onPreview }: RegenerarInspeccionMobileViewProps) => {
  if (servicios.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
        No hay servicios con fotos que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {servicios.map((servicio) => {
        const hasPdf = Boolean(servicio.pdfUrlActual || servicio.pdfRetiroUrlActual);
        return (
          <Card key={servicio.serviceId}>
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="outline" className="mb-2 border-primary/20 bg-primary/10 text-primary">#{servicio.folio}</Badge>
                  <p className="font-semibold text-foreground">{servicio.clientName}</p>
                </div>
                <Badge variant={hasPdf ? 'secondary' : 'outline'} className="gap-1">
                  {hasPdf ? <FileCheck2 className="size-3" /> : <FileWarning className="size-3" />}
                  {hasPdf ? 'PDF' : 'Sin PDF'}
                </Badge>
              </div>

              <div className="grid gap-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  {formatForDisplay(servicio.serviceDate)}
                </span>
                <span className="flex items-center gap-2">
                  <User className="size-4" />
                  {servicio.operatorName}
                </span>
                <span className="flex items-center gap-2">
                  <Camera className="size-4" />
                  {servicio.fotosDisponibles} foto(s) disponibles
                </span>
              </div>

              <Button className="w-full" onClick={() => onPreview(servicio)}>
                <Eye className="mr-2 size-4" />
                Previsualizar y regenerar
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
