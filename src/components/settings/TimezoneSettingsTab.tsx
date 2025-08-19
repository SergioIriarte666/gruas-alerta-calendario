import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Loader2, Globe, Calendar, Clock } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { invalidateUserSettingsCache, formatForDisplay, getSystemTimezone } from '@/utils/timezoneUtils';
import { format } from 'date-fns';
import { toast } from 'sonner';

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

  // Detectar timezone del sistema
  useEffect(() => {
    setSystemTimezone(getSystemTimezone());
  }, []);

  // Actualizar preview de fecha cuando cambien las configuraciones
  useEffect(() => {
    const now = new Date();
    const preview = formatForDisplay(now);
    setDatePreview(preview);
  }, [userSettings.dateFormat, userSettings.timezone, userSettings.useSystemTimezone]);

  const handleTimezoneChange = async (timezone: string) => {
    const success = await saveUserSettings({ timezone });
    if (success) {
      invalidateUserSettingsCache();
      // Disparar evento para refrescar otros componentes
      window.dispatchEvent(new CustomEvent('timezone-changed'));
    }
  };

  const handleUseSystemTimezoneChange = async (useSystem: boolean) => {
    const success = await saveUserSettings({ useSystemTimezone: useSystem });
    if (success) {
      invalidateUserSettingsCache();
      window.dispatchEvent(new CustomEvent('timezone-changed'));
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
    return userSettings.useSystemTimezone ? systemTimezone : userSettings.timezone;
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

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tms-green" />
          <span className="ml-2 text-white">Cargando configuraciones...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Globe className="w-5 h-5 text-tms-green" />
          <span className="text-white">Configuración de Zona Horaria</span>
        </CardTitle>
        <CardDescription className="text-white/70">
          Configura la zona horaria y formato de fecha para tu aplicación
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Información actual */}
        <div className="bg-tms-green/10 border border-tms-green/30 rounded-lg p-4">
          <h3 className="text-white font-medium mb-2 flex items-center">
            <Clock className="w-4 h-4 mr-2 text-tms-green" />
            Configuración Actual
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-white/70">Zona horaria:</span>
              <br />
              <span className="text-white font-medium">{getCurrentTimezone()}</span>
            </div>
            <div>
              <span className="text-white/70">Offset:</span>
              <br />
              <span className="text-white font-medium">{getCurrentOffset()}</span>
            </div>
            <div>
              <span className="text-white/70">Fecha actual:</span>
              <br />
              <span className="text-white font-medium">{datePreview}</span>
            </div>
            <div>
              <span className="text-white/70">Formato:</span>
              <br />
              <span className="text-white font-medium">{userSettings.dateFormat}</span>
            </div>
          </div>
        </div>

        {/* Configuración de zona horaria */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-white">Usar zona horaria del sistema</Label>
              <p className="text-sm text-white/70">
                Usar automáticamente la zona horaria detectada del navegador
              </p>
            </div>
            <Switch 
              checked={userSettings.useSystemTimezone}
              onCheckedChange={handleUseSystemTimezoneChange}
              disabled={saving}
            />
          </div>

          {!userSettings.useSystemTimezone && (
            <div className="space-y-2">
              <Label className="text-white">Zona Horaria Manual</Label>
              <Select 
                value={userSettings.timezone} 
                onValueChange={handleTimezoneChange}
                disabled={saving}
              >
                <SelectTrigger className="bg-black border-tms-green/30 text-white">
                  <SelectValue className="text-white" />
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

          {userSettings.useSystemTimezone && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-blue-400 text-sm">
                <Clock className="w-4 h-4 inline mr-1" />
                Zona horaria del sistema detectada: <strong>{systemTimezone}</strong>
              </p>
            </div>
          )}
        </div>

        <Separator className="bg-tms-green/30" />

        {/* Configuración de formato de fecha */}
        <div className="space-y-2">
          <Label className="text-white">Formato de Fecha</Label>
          <Select 
            value={userSettings.dateFormat} 
            onValueChange={handleDateFormatChange}
            disabled={saving}
          >
            <SelectTrigger className="bg-black border-tms-green/30 text-white">
              <SelectValue className="text-white" />
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
        <div className="bg-tms-green/5 border border-tms-green/20 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2 flex items-center">
            <Calendar className="w-4 h-4 mr-2 text-tms-green" />
            Vista Previa
          </h4>
          <p className="text-white/70 text-sm mb-1">
            Así se verán las fechas en la aplicación:
          </p>
          <p className="text-white font-mono bg-black/30 px-3 py-2 rounded">
            {datePreview}
          </p>
        </div>

        {saving && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-4 h-4 animate-spin text-tms-green mr-2" />
            <span className="text-white text-sm">Guardando configuraciones...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};