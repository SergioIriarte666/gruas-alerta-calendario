import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, Globe, Calendar, Clock } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { invalidateUserSettingsCache, invalidateBusinessTimezoneCache, formatForDisplay, getSystemTimezone } from '@/utils/timezoneUtils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { createLogger } from "@/lib/logger";


const logger = createLogger("TimezoneSettingsTab");
// Zonas horarias principales de Latinoamérica
const TIMEZONES = [
  { value: 'America/Santiago', label: 'Santiago, Chile (GMT-3/-4)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires, Argentina (GMT-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo, Brasil (GMT-3)' },
  { value: 'America/Lima', label: 'Lima, Perú (GMT-5)' },
  { value: 'America/Bogota', label: 'Bogotá, Colombia (GMT-5)' },
  { value: 'America/Caracas', label: 'Caracas, Venezuela (GMT-4)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México (GMT-6)' },
  { value: 'America/Montevideo', label: 'Montevideo, Uruguay (GMT-3)' },
  { value: 'America/La_Paz', label: 'La Paz, Bolivia (GMT-4)' },
  { value: 'America/Asuncion', label: 'Asunción, Paraguay (GMT-3/-4)' },
];

export const TimezoneSettingsTab: React.FC = () => {
  const { userSettings, loading, saving, saveUserSettings } = useUserSettings();
  const [datePreview, setDatePreview] = useState<string>('');
  const [systemTimezone, setSystemTimezone] = useState<string>('');
  const [reportTimezone, setReportTimezone] = useState<string>('America/Santiago');
  const [reportUseSystem, setReportUseSystem] = useState<boolean>(false);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [savingGlobal, setSavingGlobal] = useState(false);

  // Detectar timezone del sistema
  useEffect(() => {
    setSystemTimezone(getSystemTimezone());
  }, []);

  // Cargar configuración global de timezone desde company_data
  useEffect(() => {
    const fetchGlobalTimezone = async () => {
      try {
        const { data } = await supabase
          .from('company_data')
          .select('report_timezone, report_use_system_timezone')
          .limit(1)
          .maybeSingle();
        if (data) {
          setReportTimezone(data.report_timezone || 'America/Santiago');
          setReportUseSystem(data.report_use_system_timezone ?? false);
        }
      } catch (e) {
        logger.warn('Error fetching global timezone:', e);
      } finally {
        setLoadingGlobal(false);
      }
    };
    fetchGlobalTimezone();
  }, []);

  // Actualizar preview de fecha
  useEffect(() => {
    const now = new Date();
    const preview = formatForDisplay(now);
    setDatePreview(preview);
  }, [userSettings.dateFormat, reportTimezone, reportUseSystem]);

  const handleReportTimezoneChange = async (timezone: string) => {
    setSavingGlobal(true);
    try {
      const { error } = await supabase
        .from('company_data')
        .update({ report_timezone: timezone })
        .not('id', 'is', null);
      if (error) throw error;
      setReportTimezone(timezone);
      invalidateBusinessTimezoneCache();
      invalidateUserSettingsCache();
      window.dispatchEvent(new CustomEvent('timezone-changed'));
      toast.success('Zona horaria de negocio actualizada');
    } catch (e) {
      logger.error('Error saving report timezone:', e);
      toast.error('Error al guardar zona horaria');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleReportUseSystemChange = async (useSystem: boolean) => {
    setSavingGlobal(true);
    try {
      const updates: any = { report_use_system_timezone: useSystem };
      if (useSystem) {
        // Freeze the detected browser timezone
        updates.report_timezone = getSystemTimezone();
        setReportTimezone(updates.report_timezone);
      }
      const { error } = await supabase
        .from('company_data')
        .update(updates)
        .not('id', 'is', null);
      if (error) throw error;
      setReportUseSystem(useSystem);
      invalidateBusinessTimezoneCache();
      invalidateUserSettingsCache();
      window.dispatchEvent(new CustomEvent('timezone-changed'));
      toast.success('Configuración de zona horaria actualizada');
    } catch (e) {
      logger.error('Error saving report use system:', e);
      toast.error('Error al guardar configuración');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleDateFormatChange = async (dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD') => {
    const success = await saveUserSettings({ dateFormat });
    if (success) {
      invalidateUserSettingsCache();
      window.dispatchEvent(new CustomEvent('date-format-changed'));
    }
  };

  const getCurrentTimezone = () => {
    return reportUseSystem ? systemTimezone : reportTimezone;
  };

  const getCurrentOffset = () => {
    try {
      const now = new Date();
      const timezone = getCurrentTimezone();
      const offset = new Intl.DateTimeFormat('en', {
        timeZone: timezone,
        timeZoneName: 'short'
      }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value || '';
      return offset;
    } catch (error) {
      return 'GMT-3';
    }
  };

  if (loading || loadingGlobal) {
    return (
      <Card className="bg-card border">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-6 animate-spin text-primary" />
          <span className="ml-2 text-foreground">Cargando configuraciones...</span>
        </CardContent>
      </Card>
    );
  }

  const isSaving = saving || savingGlobal;

  return (
    <Card className="bg-card border">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-x-2 text-foreground text-lg sm:text-xl">
          <Globe className="size-5 text-primary" />
          <span>Zona Horaria</span>
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Configura la zona horaria del negocio (fuente única de verdad para reportes)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-4 sm:p-6 pt-0 sm:pt-0">
        {/* Información actual */}
        <div className="bg-muted/50 border rounded-lg p-4">
          <h3 className="text-foreground font-medium mb-2 flex items-center">
            <Clock className="size-4 mr-2 text-primary" />
            Configuración Actual
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Zona horaria:</span>
              <br />
              <span className="text-foreground font-medium">{getCurrentTimezone()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Offset:</span>
              <br />
              <span className="text-foreground font-medium">{getCurrentOffset()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Fecha actual:</span>
              <br />
              <span className="text-foreground font-medium">{datePreview}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Formato:</span>
              <br />
              <span className="text-foreground font-medium">{userSettings.dateFormat}</span>
            </div>
          </div>
        </div>

        {/* Configuración de zona horaria global (negocio) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-foreground">Usar zona horaria del sistema</Label>
              <p className="text-sm text-muted-foreground">
                Detectar y congelar la zona horaria del navegador como zona del negocio
              </p>
            </div>
            <Switch 
              checked={reportUseSystem}
              onCheckedChange={handleReportUseSystemChange}
              disabled={isSaving}
            />
          </div>

          {!reportUseSystem && (
            <div className="space-y-2">
              <Label className="text-foreground">Zona Horaria del Negocio</Label>
              <Select 
                value={reportTimezone} 
                onValueChange={handleReportTimezoneChange}
                disabled={isSaving}
              >
                <SelectTrigger className="bg-background border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {reportUseSystem && (
            <div className="bg-accent/50 border rounded-lg p-3">
              <p className="text-accent-foreground text-sm">
                <Clock className="size-4 inline mr-1" />
                Zona horaria del sistema detectada y congelada: <strong>{reportTimezone}</strong>
              </p>
            </div>
          )}
        </div>

        <Separator />

        {/* Configuración de formato de fecha (personal) */}
        <div className="space-y-2">
          <Label className="text-foreground">Formato de Fecha</Label>
          <Select 
            value={userSettings.dateFormat} 
            onValueChange={handleDateFormatChange}
            disabled={isSaving}
          >
            <SelectTrigger className="bg-background border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DD/MM/YYYY">
                <div className="flex items-center justify-between w-full">
                  <span>DD/MM/YYYY</span>
                  <span className="text-xs text-muted-foreground ml-4">
                    {format(new Date(), 'dd/MM/yyyy')}
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="MM/DD/YYYY">
                <div className="flex items-center justify-between w-full">
                  <span>MM/DD/YYYY</span>
                  <span className="text-xs text-muted-foreground ml-4">
                    {format(new Date(), 'MM/dd/yyyy')}
                  </span>
                </div>
              </SelectItem>
              <SelectItem value="YYYY-MM-DD">
                <div className="flex items-center justify-between w-full">
                  <span>YYYY-MM-DD</span>
                  <span className="text-xs text-muted-foreground ml-4">
                    {format(new Date(), 'yyyy-MM-dd')}
                  </span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Vista previa */}
        <div className="bg-muted/30 border rounded-lg p-4">
          <h4 className="text-foreground font-medium mb-2 flex items-center">
            <Calendar className="size-4 mr-2 text-primary" />
            Vista Previa
          </h4>
          <p className="text-muted-foreground text-sm mb-1">
            Así se verán las fechas en la aplicación:
          </p>
          <p className="text-foreground font-mono bg-muted/50 px-3 py-2 rounded">
            {datePreview}
          </p>
        </div>

        {isSaving && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="size-4 animate-spin text-primary mr-2" />
            <span className="text-foreground text-sm">Guardando configuraciones...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
