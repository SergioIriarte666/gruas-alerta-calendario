import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, MessageCircle, Send, CheckCircle, XCircle, AlertCircle, Settings as SettingsIcon, History } from 'lucide-react';
import { useWhatsAppSettings, type WhatsAppSettings } from '@/hooks/useWhatsAppSettings';
import { toast } from 'sonner';
import { WhatsAppMessageHistory } from './WhatsAppMessageHistory';

type NotificationKey = Exclude<keyof WhatsAppSettings, 'id' | 'adminPhone1' | 'adminPhone2'>;

const notifications: { key: NotificationKey; label: string; desc: string }[] = [
  { key: 'notifyOperatorAssigned', label: 'Operador asignado a servicio', desc: 'WhatsApp al operador cuando se le asigna un servicio' },
  { key: 'notifyServiceCompleted', label: 'Servicio completado', desc: 'WhatsApp a admins cuando un servicio cambia a completado' },
  { key: 'notifyVehiclePickup', label: 'Retiro de vehículo', desc: 'WhatsApp al cliente cuando el operador completa la inspección de retiro' },
  { key: 'notifyDocumentExpiry', label: 'Documento próximo a vencer', desc: 'WhatsApp a admins sobre licencias, seguros y revisiones' },
  { key: 'notifyPaymentPending', label: 'Pago pendiente de cliente', desc: 'WhatsApp a admins cuando hay pagos vencidos' },
  { key: 'notifyServiceNoQuote', label: 'Servicio creado sin cotización', desc: 'WhatsApp a admins cuando se crea un servicio sin precio' },
  { key: 'notifyServiceNoOperator', label: 'Servicio sin operador (2+ horas)', desc: 'WhatsApp a admins si un servicio queda sin asignar' },
  { key: 'notifyInvoiceOverdue', label: 'Factura vencida sin pago (7+ días)', desc: 'WhatsApp a admins sobre facturas impagas vencidas' },
  { key: 'notifyDailyReminder', label: 'Recordatorio día anterior al operador', desc: 'WhatsApp al operador la noche anterior a su servicio' },
];

// Validación visual de teléfono chileno (móvil)
function validateChileanPhone(raw: string): { ok: boolean; normalized: string; reason?: string } {
  if (!raw) return { ok: false, normalized: '', reason: 'Vacío' };
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 9 && digits.startsWith('9')) digits = `56${digits}`;
  else if (digits.length === 8) digits = `569${digits}`;
  else if (!digits.startsWith('56')) digits = `56${digits}`;
  const ok = /^569\d{8}$/.test(digits);
  return ok ? { ok, normalized: `+${digits}` } : { ok: false, normalized: digits, reason: 'Formato inválido (esperado +569XXXXXXXX)' };
}

const PhoneHint: React.FC<{ value: string }> = ({ value }) => {
  if (!value) return null;
  const r = validateChileanPhone(value);
  return (
    <p className={`text-xs ${r.ok ? 'text-primary' : 'text-destructive'}`}>
      {r.ok ? `✓ ${r.normalized}` : `✗ ${r.reason}`}
    </p>
  );
};

export const WhatsAppSettingsSection = () => {
  const {
    settings,
    loading,
    saving,
    connectionStatus,
    lastError,
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
      <Badge variant="destructive" title={lastError || undefined}>
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

      <CardContent>
        {connectionStatus === 'error' && lastError && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <strong>Último error de Meta:</strong> {lastError}
          </div>
        )}
        <Tabs defaultValue="config">
          <TabsList className="mb-4">
            <TabsTrigger value="config">
              <SettingsIcon className="mr-2 h-4 w-4" /> Configuración
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" /> Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
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
              <PhoneHint value={settings.adminPhone1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-admin-2">Administrador 2</Label>
              <Input
                id="wa-admin-2"
                placeholder="+56987654321"
                value={settings.adminPhone2}
                onChange={(e) => updateSettings({ adminPhone2: e.target.value })}
              />
              <PhoneHint value={settings.adminPhone2} />
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
          </TabsContent>

          <TabsContent value="history">
            <WhatsAppMessageHistory />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};