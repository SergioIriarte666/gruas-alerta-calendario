import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock } from 'lucide-react';
import { InspectionPhaseMetadata } from '@/hooks/useInspectionPersistence';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InspectionStatusCardProps {
  metadata: InspectionPhaseMetadata;
}

export const InspectionStatusCard = ({ metadata }: InspectionStatusCardProps) => {
  return (
    <Card className="mb-6 border-warning/30 bg-warning-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-warning-text" />
          Estado de Inspección
          <Badge variant="secondary" className="bg-warning text-warning-foreground">
            {metadata.inspection_phase === 'initial' ? 'Fase Inicial' : 'Fase Final'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {metadata.initial_completion_date && (
          <div className="text-sm text-muted-foreground">
            <strong>Inspección inicial completada:</strong>{' '}
            {format(new Date(metadata.initial_completion_date), 'dd/MM/yyyy HH:mm', { locale: es })}
          </div>
        )}

        <div className="space-y-2">
          <h4 className="font-medium">Estado de Firmas:</h4>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1">
              <CheckCircle
                className={`size-4 ${metadata.signatures_status.operator ? 'text-success-text' : 'text-muted-foreground'}`}
              />
              <span className="text-sm">Firma Operador</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle
                className={`size-4 ${metadata.signatures_status.client ? 'text-success-text' : 'text-muted-foreground'}`}
              />
              <span className="text-sm">Firma Cliente</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle
                className={`size-4 ${metadata.signatures_status.reception ? 'text-success-text' : 'text-muted-foreground'}`}
              />
              <span className="text-sm">Firma Recepción</span>
            </div>
          </div>
        </div>

        {metadata.inspection_phase === 'initial' && (
          <p className="text-sm text-muted-foreground">
            Usa el botón <strong>"Completar Inspección Inicial"</strong> al final del formulario para
            guardar la inspección, generar el PDF y enviarlo al cliente.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
