import { CheckCircle2, Download, List, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface InspectionSuccessProps {
  folio: string;
  emailAvailable: boolean;
  phoneAvailable: boolean;
  emailSent: boolean;
  whatsappSent: boolean;
  isSendingEmail: boolean;
  queuedOffline?: boolean;
  onDownload: () => void;
  onSendEmail: () => void;
  onSendWhatsApp: () => void;
  onBackToList: () => void;
}

export const InspectionSuccess = ({
  folio,
  emailAvailable,
  phoneAvailable,
  emailSent,
  whatsappSent,
  isSendingEmail,
  queuedOffline = false,
  onDownload,
  onSendEmail,
  onSendWhatsApp,
  onBackToList,
}: InspectionSuccessProps) => (
  <div className="mx-auto max-w-xl py-6">
    <Card className="overflow-hidden border-emerald-500/30 bg-emerald-500/5 shadow-lg shadow-emerald-950/5">
      <div className="h-1.5 bg-emerald-500" />
      <CardHeader className="items-center text-center">
        <div className="mb-2 rounded-full bg-emerald-500/15 p-3">
          <CheckCircle2 className="size-10 text-emerald-500" />
        </div>
        <CardTitle>Inspección guardada</CardTitle>
        <p className="text-sm text-muted-foreground">
          {queuedOffline
            ? `El servicio ${folio} quedó guardado en este dispositivo y se sincronizará cuando vuelva la conexión.`
            : `El servicio ${folio} quedó listo para entrega y ya salió de las inspecciones disponibles.`}
        </p>
        <div className="rounded-full border border-emerald-500/25 bg-background/70 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="outline"
            onClick={onSendEmail}
            disabled={queuedOffline || !emailAvailable || isSendingEmail}
          >
            <Mail className="mr-2 size-4" />
            {isSendingEmail ? 'Enviando…' : emailSent ? 'Reenviar correo' : 'Enviar por correo'}
          </Button>
          <Button variant="outline" onClick={onSendWhatsApp} disabled={queuedOffline || !phoneAvailable}>
            <MessageCircle className="mr-2 size-4" />
            {whatsappSent ? 'Reenviar WhatsApp' : 'Enviar por WhatsApp'}
          </Button>
        </div>

        {queuedOffline && (
          <p className="text-center text-xs text-muted-foreground">
            La app enviará automáticamente la inspección apenas vuelva la señal.
          </p>
        )}

        {!queuedOffline && !emailAvailable && !phoneAvailable && (
          <p className="text-center text-xs text-muted-foreground">
            El cliente no tiene correo ni teléfono registrados.
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
