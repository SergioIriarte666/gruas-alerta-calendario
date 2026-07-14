import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useEmailNotificationSettings } from '@/hooks/useEmailNotificationSettings';

const emailNotifications = [
  {
    key: 'sendInspectionCompleted',
    label: 'Inspección inicial',
    desc: 'Correo al cliente cuando se guarda la inspección inicial con PDF adjunto.',
  },
  {
    key: 'sendVehiclePickup',
    label: 'Entrega del vehículo',
    desc: 'Correo al cliente cuando se guarda la entrega con PDF adjunto.',
  },
] as const;

export const EmailNotificationSettingsSection = () => {
  const { settings, loading, saving, updateSettings, saveSettings } = useEmailNotificationSettings();

  const handleSave = async () => {
    const result = await saveSettings();
    if (result.success) {
      toast.success('Configuración de correo guardada');
    } else {
      toast.error('Error al guardar correo', { description: result.error });
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <CardTitle>Correos automáticos</CardTitle>
          </div>
          <Badge variant={settings.emailEnabled ? 'outline' : 'secondary'}>
            {settings.emailEnabled ? 'Activo' : 'Desactivado'}
          </Badge>
        </div>
        <CardDescription>
          Controla solo los correos enviados por el servidor. No afecta WhatsApp.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className={cn(
          'flex items-center justify-between rounded-lg border p-4',
          settings.emailEnabled
            ? 'border-green-500/30 bg-green-500/5'
            : 'border-destructive/30 bg-destructive/5'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'h-2 w-2 rounded-full',
              settings.emailEnabled ? 'bg-green-500' : 'bg-destructive'
            )} />
            <div>
              <p className="text-sm font-medium">
                {settings.emailEnabled ? 'Correos automáticos activos' : 'Correos automáticos desactivados'}
              </p>
              <p className="text-xs text-muted-foreground">
                {settings.emailEnabled
                  ? 'El servidor enviará correos según los controles de abajo'
                  : 'No se enviarán correos automáticos de inspección ni entrega'}
              </p>
            </div>
          </div>
          <Switch
            checked={settings.emailEnabled}
            onCheckedChange={(checked) => updateSettings({ emailEnabled: checked })}
          />
        </div>

        <Separator />

        <div className={cn('space-y-3', !settings.emailEnabled && 'pointer-events-none opacity-50')}>
          {emailNotifications.map(({ key, label, desc }) => (
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
                onCheckedChange={(checked) => updateSettings({ [key]: checked })}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar correo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
