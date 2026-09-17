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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { WhatsAppMessageHistory } from './WhatsAppMessageHistory';

type NotificationKey = Exclude<keyof WhatsAppSettings, 'id' | 'whatsappEnabled' | 'adminPhone1' | 'adminPhone2'>;

interface NotificationItem {
  key: NotificationKey;
  label: string;
  desc: string;
  /** Plantilla(s) Meta asociada(s). Sirve de mapa toggle → plantilla. */
  templates: string;
  /** Nota informativa (ej. columna sin emisor activo todavía). */
  note?: string;
}

interface NotificationGroup {
  group: string;
  audience: string;
  items: NotificationItem[];
}

// Cada grupo agrupa las 14 columnas notify_* por audiencia del mensaje.
// El texto `templates` refleja la(s) plantilla(s) Meta reales que dispara cada
// columna según las edge functions (no renombrar plantillas ni columnas).
const notificationGroups: NotificationGroup[] = [
  {
    group: 'Administración',
    audience: 'A los números de administrador',
    items: [
      { key: 'notifyServiceCompleted', label: 'Servicio completado', desc: 'Cuando un servicio cambia a estado completado.', templates: 'admin_servicio_completado' },
      { key: 'notifyPaymentPending', label: 'Pago pendiente', desc: 'Al marcar un servicio/factura con pago pendiente.', templates: 'admin_pago_pendiente' },
      { key: 'notifyServiceNoQuote', label: 'Servicio sin cotización', desc: 'Al crear un servicio sin precio asignado.', templates: 'admin_servicio_sin_cotizacion' },
      { key: 'notifyServiceNoOperator', label: 'Servicio sin operador', desc: 'Alerta diaria (lun-vie 08:00) de servicios de hoy/mañana sin operador.', templates: 'admin_servicio_sin_operador' },
      { key: 'notifyInvoiceOverdue', label: 'Factura vencida', desc: 'Alerta diaria (lun-vie 08:00) de facturas vencidas con saldo pendiente.', templates: 'admin_pago_pendiente' },
      { key: 'notifyDailyReminder', label: 'Resumen diario', desc: 'Resumen diario (lun-vie 08:00) con servicios del día, servicios sin OC (monto y días del más antiguo), completados por facturar y facturas pendientes.', templates: 'admin_resumen_diario_v2 · fallback admin_resumen_diario' },
      { key: 'notifyWeeklySummary', label: 'Resumen semanal', desc: 'Consolidado semanal para administradores.', templates: 'sin plantilla asociada', note: 'La columna existe en la base pero aún no hay un emisor activo para el resumen semanal.' },
      { key: 'notifyServiceResourceRisk', label: 'Recurso no apto', desc: 'Cuando un servicio queda con grúa u operador con documentos vencidos o por vencer.', templates: 'admin_servicio_recurso_no_apto' },
    ],
  },
  {
    group: 'Documentos',
    audience: 'A los números de administrador',
    items: [
      { key: 'notifyDocumentExpiry', label: 'Documento de equipo (aviso manual)', desc: 'Aviso puntual de vencimiento de documento de grúa disparado desde una acción.', templates: 'admin_documento_vence' },
      { key: 'notifyOperatorDocumentExpiry', label: 'Documentos de operadores y grúas (diario)', desc: 'Alerta diaria (lun-vie 08:00) de documentos de operadores y de grúas próximos a vencer o vencidos.', templates: 'admin_doc_op_vencido · admin_doc_op_vencimiento · admin_doc_grua_vencido · admin_doc_grua_vencimiento' },
    ],
  },
  {
    group: 'Operador',
    audience: 'Al operador directamente',
    items: [
      { key: 'notifyOperatorAssigned', label: 'Servicio asignado', desc: 'Cuando se asigna un servicio al operador.', templates: 'servicio_asignado_v3' },
      { key: 'notifyOperatorSelfDocument', label: 'Sus propios documentos', desc: 'Aviso directo al operador cuando SUS documentos están por vencer o vencidos.', templates: 'operador_mi_doc_vencido · operador_mi_doc_vencimiento' },
    ],
  },
  {
    group: 'Cliente',
    audience: 'Al cliente del servicio',
    items: [
      { key: 'notifyInspectionCompleted', label: 'Inspección completada', desc: 'Cuando el operador completa la inspección y se genera el documento.', templates: 'inspeccion_completada_doc' },
      { key: 'notifyVehiclePickup', label: 'Retiro de vehículo', desc: 'Cuando el operador completa la inspección de retiro del vehículo.', templates: 'retiro_completado' },
    ],
  },
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
      toast.success('Configuración de WhatsApp guardada', result.compatibilityMode ? {
        description: 'Se guardó en modo compatible porque tu base aún no tiene la columna whatsapp_enabled.'
      } : undefined);
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
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground shadow-sm">
            <p className="font-semibold text-destructive">Ultimo error de Meta</p>
            <p className="mt-1 leading-6 text-foreground/90">{lastError}</p>
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

        {/* Master switch */}
        <div className={cn(
          'flex items-center justify-between p-4 rounded-lg border',
          settings.whatsappEnabled
            ? 'border-success/30 bg-success-soft'
            : 'border-destructive/30 bg-destructive/5'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-2 h-2 rounded-full',
              settings.whatsappEnabled ? 'bg-success' : 'bg-destructive'
            )} />
            <div>
              <p className="text-sm font-medium">
                {settings.whatsappEnabled
                  ? 'Notificaciones WhatsApp activas'
                  : 'Notificaciones WhatsApp desactivadas'}
              </p>
              <p className="text-xs text-muted-foreground">
                {settings.whatsappEnabled
                  ? 'El sistema enviará mensajes según los toggles configurados abajo'
                  : 'Ningún mensaje será enviado hasta reactivar este switch'}
              </p>
            </div>
          </div>
          <Switch
            checked={settings.whatsappEnabled ?? true}
            onCheckedChange={(value) => updateSettings({ whatsappEnabled: value })}
          />
        </div>

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
                type="tel"
                value={settings.adminPhone1}
                onChange={(e) => updateSettings({ adminPhone1: e.target.value })}
                placeholder="+56 9 1234 5678"
              />
              <PhoneHint value={settings.adminPhone1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wa-admin-2">Administrador 2</Label>
              <Input
                id="wa-admin-2"
                type="tel"
                value={settings.adminPhone2}
                onChange={(e) => updateSettings({ adminPhone2: e.target.value })}
                placeholder="+56 9 8765 4321"
              />
              <PhoneHint value={settings.adminPhone2} />
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-6">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Notificaciones activas</h3>
            <p className="text-xs text-muted-foreground">
              Agrupadas por audiencia. El texto en tono técnico bajo cada toggle indica la plantilla Meta que dispara.
            </p>
          </div>
          <div className={cn('space-y-6', !settings.whatsappEnabled && 'opacity-50 pointer-events-none')}>
            {notificationGroups.map(({ group, audience, items }) => (
              <div key={group} className="space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{group}</h4>
                  <span className="text-xs text-muted-foreground">{audience}</span>
                </div>
                <div className="space-y-3">
                  {items.map(({ key, label, desc, templates, note }) => (
                    <div
                      key={key}
                      className="flex items-start justify-between gap-4 rounded-lg border border-border/60 p-3"
                    >
                      <div className="min-w-0 space-y-1">
                        <Label className="font-medium">{label}</Label>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                        <p className="break-words font-mono text-xs leading-4 text-muted-foreground/70">
                          {templates}
                        </p>
                        {note && (
                          <p className="text-xs leading-4 text-warning">{note}</p>
                        )}
                      </div>
                      <Switch
                        checked={Boolean(settings[key])}
                        onCheckedChange={(checked) => updateSettings({ [key]: checked } as Partial<WhatsAppSettings>)}
                      />
                    </div>
                  ))}
                  {group === 'Cliente' && (
                    <div className="flex items-start justify-between gap-4 rounded-lg border border-dashed border-border/60 bg-muted/30 p-3">
                      <div className="min-w-0 space-y-1">
                        <Label className="font-medium text-muted-foreground">Seguimiento de grúa en vivo</Label>
                        <p className="text-xs text-muted-foreground">
                          Enlace de seguimiento al cliente al iniciar el servicio.
                        </p>
                        <p className="break-words font-mono text-xs leading-4 text-muted-foreground/70">
                          cliente_seguimiento_grua
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">Envío automático</Badge>
                    </div>
                  )}
                </div>
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
