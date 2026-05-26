import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Database, Save, AlertTriangle, FileText, Mail, Clock, Send } from 'lucide-react';
import type { SystemSettings } from '@/types/settings';
import { BackupManagementSection } from './BackupManagementSection';
import { ReportColumnsSettings } from './ReportColumnsSettings';
import { defaultReportColumnConfig, ReportColumnsConfig } from '@/types/reportColumnConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const surfaceClassName = 'border-border/70 bg-card/80 shadow-sm';
const inputClassName = 'border-border/70 bg-background/60';

interface SystemSettingsTabProps {
  settings: SystemSettings;
  saving: boolean;
  onSave: () => void;
  onUpdateSettings: (updates: Partial<SystemSettings>) => void;
}

export const SystemSettingsTab: React.FC<SystemSettingsTabProps> = ({
  settings,
  saving,
  onSave,
  onUpdateSettings
}) => {
  const queryClient = useQueryClient();

  const { data: dailyReportSettings } = useQuery({
    queryKey: ['dailyReportSettings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_data')
        .select('daily_report_enabled, daily_report_emails, daily_report_hour')
        .single();
      return {
        enabled: (data as any)?.daily_report_enabled ?? false,
        emails: (data as any)?.daily_report_emails ?? '',
        hour: (data as any)?.daily_report_hour ?? 9,
      };
    },
  });

  const [localDailyEnabled, setLocalDailyEnabled] = React.useState(false);
  const [localDailyEmails, setLocalDailyEmails] = React.useState('');
  const [localDailyHour, setLocalDailyHour] = React.useState(9);

  React.useEffect(() => {
    if (dailyReportSettings) {
      setLocalDailyEnabled(dailyReportSettings.enabled);
      setLocalDailyEmails(dailyReportSettings.emails);
      setLocalDailyHour(dailyReportSettings.hour);
    }
  }, [dailyReportSettings]);

  const saveDailyReport = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('company_data')
        .update({
          daily_report_enabled: localDailyEnabled,
          daily_report_emails: localDailyEmails,
          daily_report_hour: localDailyHour,
        } as any)
        .not('id', 'is', null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyReportSettings'] });
      toast.success('Configuración de reporte diario guardada');
    },
    onError: () => toast.error('Error al guardar configuración'),
  });

  const sendTestReport = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-daily-pending-report', {
        body: {
          force: true,
          source: 'manual_test',
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(`Reporte de prueba enviado (${data?.totalPendientes ?? 0} pendientes)`);
    },
    onError: (e: any) => toast.error(`Error: ${e.message}`),
  });

  return (
    <div className="space-y-6">
      <Card className={surfaceClassName}>
        <CardHeader className="border-b p-4 sm:p-6">
          <CardTitle className="flex items-center gap-x-2 text-foreground text-lg sm:text-xl">
            <Database className="size-5 text-primary" />
            <span>Configuración del Sistema</span>
          </CardTitle>
          <CardDescription>
            Controla respaldos, retención, mantenimiento y comportamiento operativo general.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
              <div>
                <Label>Respaldo automático</Label>
                <p className="text-sm text-muted-foreground">Crear respaldos automáticos de los datos</p>
              </div>
              <Switch 
                checked={settings.autoBackup}
                onCheckedChange={(checked) => onUpdateSettings({ autoBackup: checked })}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label>Frecuencia de respaldo</Label>
              <Select 
                value={settings.backupFrequency} 
                onValueChange={(value: 'daily' | 'weekly' | 'monthly') => 
                  onUpdateSettings({ backupFrequency: value })
                }
                disabled={!settings.autoBackup}
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Diario</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Retención de datos (meses)</Label>
              <p className="text-sm text-muted-foreground">
                Tiempo que se mantendrán los datos en el sistema
              </p>
              <Input
                type="number"
                min="1"
                max="60"
                value={settings.dataRetention}
                onChange={(e) => onUpdateSettings({ 
                  dataRetention: parseInt(e.target.value) || 12 
                })}
                className={inputClassName}
              />
            </div>

            <Separator />
            
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
              <div>
                <Label className="flex items-center gap-x-2">
                  <span>Modo Mantenimiento</span>
                  {settings.maintenanceMode && (
                    <AlertTriangle className="size-4 text-warning" />
                  )}
                </Label>
                <p className="text-sm text-muted-foreground">
                  Activar para realizar mantenimiento del sistema
                </p>
              </div>
              <div className="flex items-center gap-x-2">
                {settings.maintenanceMode && (
                  <Badge variant="warning">Activo</Badge>
                )}
                <Switch 
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) => onUpdateSettings({ maintenanceMode: checked })}
                />
              </div>
            </div>
          </div>
          
          <Button onClick={onSave} disabled={saving}>
            <Save className="size-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </Button>
        </CardContent>
      </Card>

      <Card className={surfaceClassName}>
        <CardHeader className="border-b p-4 sm:p-6">
          <CardTitle className="flex items-center gap-x-2 text-foreground text-lg sm:text-xl">
            <Mail className="size-5 text-primary" />
            <span>Reporte Diario de Pendientes</span>
          </CardTitle>
          <CardDescription>
            Programa el envío automático del reporte PDF de pendientes críticos y valida su configuración.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            Envía automáticamente un email diario con un PDF resumen de todos los pendientes críticos del sistema.
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/50 p-4">
              <div>
                <Label>Activar reporte diario</Label>
                <p className="text-sm text-muted-foreground">Enviar reporte de pendientes por email cada día</p>
              </div>
              <Switch
                checked={localDailyEnabled}
                onCheckedChange={setLocalDailyEnabled}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Email(s) destinatario(s)</Label>
              <p className="text-sm text-muted-foreground">
                Separar múltiples emails con coma
              </p>
              <Input
                type="text"
                placeholder="admin@empresa.cl, gerencia@empresa.cl"
                value={localDailyEmails}
                onChange={(e) => setLocalDailyEmails(e.target.value)}
                disabled={!localDailyEnabled}
                className={inputClassName}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="flex items-center gap-x-2">
                <Clock className="size-4" />
                <span>Hora de Envío</span>
              </Label>
              <Select
                value={localDailyHour.toString()}
                onValueChange={(v) => setLocalDailyHour(parseInt(v))}
                disabled={!localDailyEnabled}
              >
                <SelectTrigger className={`${inputClassName} w-40`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {i.toString().padStart(2, '0')}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => saveDailyReport.mutate()} disabled={saveDailyReport.isPending}>
              <Save className="size-4 mr-2" />
              {saveDailyReport.isPending ? 'Guardando...' : 'Guardar Configuración'}
            </Button>
            <Button
              variant="outline"
              onClick={() => sendTestReport.mutate()}
              disabled={sendTestReport.isPending || !localDailyEnabled}
            >
              <Send className="size-4 mr-2" />
              {sendTestReport.isPending ? 'Enviando...' : 'Enviar Reporte de Prueba'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <BackupManagementSection />

      <Card className={surfaceClassName}>
        <CardHeader className="border-b p-4 sm:p-6">
          <CardTitle className="flex items-center gap-x-2 text-foreground text-lg sm:text-xl">
            <FileText className="size-5 text-primary" />
            <span>Reportes PDF</span>
          </CardTitle>
          <CardDescription>
            Ajusta columnas, anchos y estructura de los reportes PDF de servicios.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          <p className="text-sm text-muted-foreground">
            Configura qué columnas mostrar y sus anchos en los reportes PDF de servicios.
          </p>
          <ReportColumnsSettings
            config={settings.reportColumnConfig || defaultReportColumnConfig}
            onChange={(config: ReportColumnsConfig) => onUpdateSettings({ reportColumnConfig: config })}
          />
          
          <Button onClick={onSave} disabled={saving}>
            <Save className="size-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar Configuración de Reportes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
