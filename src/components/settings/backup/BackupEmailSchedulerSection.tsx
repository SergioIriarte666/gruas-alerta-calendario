import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mail, Send, Clock, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useBackupEmailConfig } from '@/hooks/useBackupEmailConfig';
import { useToast } from '@/components/ui/custom-toast';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const BackupEmailSchedulerSection: React.FC = () => {
  const { config, loading, saving, testing, save, sendTest } = useBackupEmailConfig();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [hour, setHour] = useState('3');
  const [days, setDays] = useState('7');

  useEffect(() => {
    if (config) {
      setEmail(config.recipient_email || '');
      setHour(String(config.schedule_hour));
      setDays(String(config.signed_url_days));
    }
  }, [config]);

  const handleToggle = async (checked: boolean) => {
    const { error } = await save({ enabled: checked });
    toast(error
      ? { title: 'Error', description: error, type: 'error' }
      : { title: checked ? 'Envío diario activado' : 'Envío diario desactivado', type: 'success' });
  };

  const handleSave = async () => {
    if (!email.includes('@')) {
      toast({ title: 'Email inválido', type: 'error' });
      return;
    }
    const { error } = await save({
      recipient_email: email.trim(),
      schedule_hour: parseInt(hour, 10),
      signed_url_days: parseInt(days, 10),
    });
    toast(error
      ? { title: 'Error al guardar', description: error, type: 'error' }
      : { title: 'Configuración guardada', type: 'success' });
  };

  const handleTest = async () => {
    toast({ title: 'Generando respaldo y enviando…', description: 'Puede tardar 30-60s', type: 'info' });
    const { error } = await sendTest();
    if (error) toast({ title: 'Error', description: error, type: 'error' });
    else toast({ title: '✓ Correo enviado', description: `Revisa la bandeja de ${email}`, type: 'success' });
  };

  if (loading) {
    return (
      <Card className="bg-card border mt-6">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const lastStatus = config?.last_status;
  const totalSize = (config?.last_sql_size_bytes || 0) + (config?.last_json_size_bytes || 0);
  const formatBytes = (b: number) => {
    if (!b) return '—';
    const u = ['B', 'KB', 'MB', 'GB']; let i = 0; let n = b;
    while (n >= 1024 && i < 3) { n /= 1024; i++; }
    return `${n.toFixed(2)} ${u[i]}`;
  };

  return (
    <Card className="bg-card border mt-6">
      <CardHeader className="border-b p-4 sm:p-6">
        <CardTitle className="flex items-center justify-between text-foreground">
          <div className="flex items-center gap-x-2">
            <Mail className="size-5 text-primary" />
            <span className="text-lg sm:text-xl">Envío Automático por Correo</span>
          </div>
          <Badge variant={config?.enabled ? 'default' : 'secondary'}
                 className={config?.enabled ? 'bg-primary text-primary-foreground' : ''}>
            {config?.enabled ? 'Activo' : 'Inactivo'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6">

        {/* Toggle principal */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-primary-soft/30">
          <div>
            <Label className="text-base font-medium">Envío diario por correo</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Genera respaldo SQL + JSON y los envía como links de descarga firmados.
            </p>
          </div>
          <Switch checked={!!config?.enabled} onCheckedChange={handleToggle} disabled={saving} />
        </div>

        {/* Configuración */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <Label htmlFor="recipient">Correo destinatario</Label>
            <Input id="recipient" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                   placeholder="asistencia@gruas5norte.cl" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="hour">Hora de envío (Chile)</Label>
            <Select value={hour} onValueChange={setHour}>
              <SelectTrigger id="hour" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>{String(i).padStart(2, '0')}:00</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="days">Validez del link</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger id="days" className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 3, 7, 14, 30].map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} {d === 1 ? 'día' : 'días'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
              Guardar
            </Button>
          </div>
        </div>

        {/* Estado último envío */}
        {config?.last_sent_at && (
          <Alert className={
            lastStatus === 'success'
              ? 'border-primary/30 bg-primary-soft'
              : 'border-destructive/30 bg-destructive/10'
          }>
            {lastStatus === 'success'
              ? <CheckCircle className="size-4 text-primary" />
              : <XCircle className="size-4 text-destructive" />}
            <AlertDescription className="text-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span>
                  <strong>Último envío:</strong>{' '}
                  {formatDistanceToNow(new Date(config.last_sent_at), { addSuffix: true, locale: es })}
                  {lastStatus === 'success' && totalSize > 0 && (
                    <span className="text-muted-foreground"> · {formatBytes(totalSize)}</span>
                  )}
                </span>
                <Badge variant={lastStatus === 'success' ? 'default' : 'destructive'}
                       className={lastStatus === 'success' ? 'bg-primary' : ''}>
                  {lastStatus === 'success' ? 'Exitoso' : 'Fallido'}
                </Badge>
              </div>
              {lastStatus !== 'success' && config.last_error && (
                <p className="text-xs mt-2 text-destructive">{config.last_error}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Botón de prueba */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-4 rounded-lg border bg-muted/30">
          <div className="flex items-start gap-2">
            <Send className="size-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Enviar prueba ahora</p>
              <p className="text-xs text-muted-foreground">
                Genera y envía un respaldo inmediato al correo configurado.
              </p>
            </div>
          </div>
          <Button onClick={handleTest} disabled={testing || !email} variant="outline" className="shrink-0">
            {testing ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
            Enviar ahora
          </Button>
        </div>

        <Alert className="border-info/30 bg-info-soft">
          <Clock className="size-4 text-info" />
          <AlertDescription className="text-sm text-foreground">
            El respaldo se genera automáticamente todos los días a las{' '}
            <strong>{String(hour).padStart(2, '0')}:00 hrs (hora Chile)</strong> y se envía a{' '}
            <strong>{email || '—'}</strong>. Los links de descarga expiran en{' '}
            <strong>{days} {parseInt(days) === 1 ? 'día' : 'días'}</strong>.
          </AlertDescription>
        </Alert>

      </CardContent>
    </Card>
  );
};