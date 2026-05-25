import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, FileText, Download } from 'lucide-react';
import { InspectionPhaseMetadata } from '@/hooks/useInspectionPersistence';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InspectionStatusCardProps {
  metadata: InspectionPhaseMetadata;
  onContinueToDelivery: () => void;
  onGeneratePartialPDF: () => void;
  onGenerateInitialPDF?: () => void;
  isGeneratingInitialPDF?: boolean;
}

export const InspectionStatusCard = ({
  metadata,
  onContinueToDelivery,
  onGeneratePartialPDF,
  onGenerateInitialPDF,
  isGeneratingInitialPDF = false,
}: InspectionStatusCardProps) => {
  const isInitialCompleted = metadata.inspection_phase === 'initial' && 
                            metadata.signatures_status.operator && 
                            metadata.signatures_status.client;

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-orange-600" />
          Estado de Inspección
          <Badge variant="secondary" className="bg-orange-500/80 text-white">
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
                className={`size-4 ${metadata.signatures_status.operator ? 'text-green-600' : 'text-gray-400'}`} 
              />
              <span className="text-sm">Firma Operador</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle 
                className={`size-4 ${metadata.signatures_status.client ? 'text-green-600' : 'text-gray-400'}`} 
              />
              <span className="text-sm">Firma Cliente</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle 
                className={`size-4 ${metadata.signatures_status.reception ? 'text-green-600' : 'text-gray-400'}`} 
              />
              <span className="text-sm">Firma Recepción</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {/* Botón para generar PDF de Inspección Inicial (pre-servicio) - siempre visible si hay firmas */}
          {isInitialCompleted && onGenerateInitialPDF && (
            <Button 
              onClick={onGenerateInitialPDF}
              variant="outline"
              size="sm"
              className="flex items-center gap-1 border-violet-300 text-violet-700 hover:bg-violet-50"
              disabled={isGeneratingInitialPDF}
            >
              <Download className="size-4" />
              {isGeneratingInitialPDF ? 'Generando...' : 'PDF Inspección Inicial'}
            </Button>
          )}
          
          {isInitialCompleted && metadata.inspection_phase === 'initial' && (
            <>
              <Button 
                onClick={onGeneratePartialPDF}
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <FileText className="size-4" />
                Generar PDF de Retiro
              </Button>
              <Button 
                onClick={onContinueToDelivery}
                size="sm"
                className="flex items-center gap-1"
              >
                <Clock className="size-4" />
                Continuar a Entrega
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
