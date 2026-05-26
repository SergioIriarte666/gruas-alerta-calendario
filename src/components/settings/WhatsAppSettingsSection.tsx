import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, MessageCircle, Send, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useWhatsAppSettings, type WhatsAppSettings } from '@/hooks/useWhatsAppSettings';
import { toast } from 'sonner';

type NotificationKey = Exclude<keyof WhatsAppSettings, 'id' | 'adminPhone1' | 'adminPhone2'>;

const notifications: { key: NotificationKey; label: string; desc: string }[] = [
  { key: 'notifyOperatorAssigned', label: 'Operador asignado a servicio', desc: 'WhatsApp al operador cuando se le asigna un servicio' },
  { key: 'notifyServiceCompleted', label: 'Servicio completado', desc: 'WhatsApp a admins cuando un servicio cambia a completado' },
  { key: 'notifyDocumentExpiry', label: 'Documento próximo a vencer', desc: 'WhatsApp a admins sobre licencias, seguros y revisiones' },
  { key: 'notifyPaymentPending', label: 'Pago pendiente de cliente', desc: 'WhatsApp a admins cuando hay pagos vencidos' },
  { key: 'notifyServiceNoQuote', label: 'Servicio creado sin cotización', desc: 'WhatsApp a admins cuando se crea un servicio sin precio' },
  { key: 'notifyServiceNoOperator', label: 'Servicio sin operador (2+ horas)', desc: 'WhatsApp a admins si un servicio queda sin asignar' },
  { key: 'notifyInvoiceOverdue', label: 'Factura vencida sin pago (7+ días)', desc: 'WhatsApp a admins sobre facturas impagas vencidas' },
  { key: 'notifyDailyReminder', label: 'Recordatorio día anterior al operador', desc: 'WhatsApp al operador la noche anterior a su servicio' },
];

export const WhatsAppSettingsSection = () => {
  const {
    settings,
    loading,
    saving,
    connectionStatus,
    testingSend,
    updateSettings,
    saveSettings,
    sendTestMessage,
  } = useWhatsAppSettings();

  const handleSave = async () => {
    const result = await saveSettings();
    if (result.success) {
      toast.success('Configuración de WhatsApp guardada');
    } else {
      toast.error('Error al guardar', { description: result.error });
    }
  };

  const statusBadge =
    connectionStatus === 'ok' ? (
      <Badge variant="outline" className="border-primary/40 text-primary">
        <CheckCircle className="mr-1 h-3 w-3" /> Conectado
      </Badge>
    ) : connectionStatus === 'error' ? (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" /> Error
      </Badge>
    ) : (
      <Badge variant="secondary">
        <AlertCircle className="mr-1 h-3 w-3" /> Sin verificar
      </Badge>
    );

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <CardTitle>WhatsApp Business</CardTitle>
          </div>
          {statusBadge}
        </div>
        <CardDescription>
          Configura los números de administradores y activa las notificaciones por WhatsApp.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Números de administradores</h3>
          <p className="text-sm text-muted-foreground">
            Ingresa los números en formato chileno (9XXXXXXXX o +569XXXXXXXX). Estos recibirán todas las alertas administrativas.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-admin-1">Administrador 1</Label>
              <Input
                id="wa-admin-1"
                placeholder="+56912345678"
                value={settings.adminPhone1}
                onChange={(e) => updateSettings({ adminPhone1: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-admin-2">Administrador 2</Label>
              <Input
                id="wa-admin-2"
                placeholder="+56987654321"
                value={settings.adminPhone2}
                onChange={(e) => updateSettings({ adminPhone2: e.target.value })}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Notificaciones activas</h3>
          <div className="space-y-3">
            {notifications.map(({ key, label, desc }) => (
              <div
                key={key}
                className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3"
              >
                <div className="space-y-0.5">
                  <Label className="font-medium">{label}</Label>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <Switch
                  checked={Boolean(settings[key])}
                  onCheckedChange={(checked) => updateSettings({ [key]: checked } as Partial<WhatsAppSettings>)}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Mensaje de prueba</h3>
            <p className="text-sm text-muted-foreground">
              Envía un mensaje al Administrador 1 para verificar que la integración funciona.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={sendTestMessage}
            disabled={testingSend || !settings.adminPhone1}
          >
            {testingSend ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Enviar prueba
          </Button>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};