import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileText, ImageIcon } from 'lucide-react';
import { InitialInspectionEvidence as InitialInspectionEvidenceData } from '@/utils/inspectionRecord';

interface InitialInspectionEvidenceProps {
  evidence: InitialInspectionEvidenceData;
}

export const InitialInspectionEvidenceCard = ({ evidence }: InitialInspectionEvidenceProps) => {
  return (
    <Card className="mb-6 border-success/30 bg-success-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="size-5 text-success-text" />
          Evidencia de Inspección Inicial
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {evidence.storageTier === 'deleted' && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Respaldo eliminado por política de retención (&gt;2 años)
              {evidence.deletedAt ? ` el ${new Date(evidence.deletedAt).toLocaleDateString('es-CL')}` : ''}.
            </span>
          </div>
        )}

        {evidence.storageTier === 'cold' && (
          <p className="text-xs text-muted-foreground">Respaldo histórico recuperado desde archivo seguro.</p>
        )}

        {evidence.pdfUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={evidence.pdfUrl} target="_blank" rel="noopener noreferrer">
              <FileText className="size-4 mr-2" />
              Ver PDF de inspección inicial
            </a>
          </Button>
        )}

        {evidence.photos.length > 0 && (
          <div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
              <ImageIcon className="size-4" />
              {evidence.photos.length} fotografía(s) de la fase inicial
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {evidence.photos.map((url, idx) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Foto inicial ${idx + 1}`}
                    className="w-full h-20 object-cover rounded border border-border"
                  />
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
