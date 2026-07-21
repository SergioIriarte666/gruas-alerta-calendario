import { CheckCircle2, Download, List, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InspectionSuccessProps {
  folio: string;
  queuedOffline?: boolean;
  onDownload: () => void;
  onBackToList: () => void;
}

export const InspectionSuccess = ({
  folio,
  queuedOffline = false,
  onDownload,
  onBackToList,
}: InspectionSuccessProps) => (
  <div className="mx-auto max-w-xl py-6">
    <Card className="overflow-hidden border-success/30 bg-success-soft shadow-lg">
      <div className="h-1.5 bg-success" />
      <CardHeader className="items-center text-center">
        <div className="mb-2 rounded-full bg-success/15 p-3">
          <CheckCircle2 className="size-10 text-success-text" />
        </div>
        <CardTitle>Inspección guardada</CardTitle>
        <p className="text-sm text-muted-foreground">
          {queuedOffline
            ? `El servicio ${folio} quedó guardado en este dispositivo y se sincronizará cuando vuelva la conexión.`
            : `El servicio ${folio} quedó listo para entrega y ya salió de las inspecciones disponibles.`}
        </p>
        <div className="rounded-full border border-success/30 bg-background/70 px-3 py-1 text-xs font-medium text-success-text">
          {queuedOffline
            ? 'Fotos · firmas · formulario guardados localmente'
            : 'Fotos · PDF · registro · estado sincronizados'}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <Button className="w-full" onClick={onDownload} disabled={queuedOffline}>
          <Download className="mr-2 size-4" />
          {queuedOffline ? 'PDF disponible al sincronizar' : 'Descargar PDF'}
        </Button>

        <div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success-text">
          <div className="flex items-center gap-2 font-medium">
            <Send className="size-4" />
            Notificaciones automáticas
          </div>
          <p className="mt-1 text-xs">
            {queuedOffline
              ? 'Se encolarán cuando el dispositivo sincronice el registro.'
              : 'El servidor enviará los canales que estén activos en configuración.'}
          </p>
        </div>

        {queuedOffline && (
          <p className="text-center text-xs text-muted-foreground">
            La app enviará automáticamente la inspección apenas vuelva la señal.
          </p>
        )}

        <Button variant="ghost" className="w-full" onClick={onBackToList}>
          <List className="mr-2 size-4" />
          Volver al listado
        </Button>
      </CardContent>
    </Card>
  </div>
);
