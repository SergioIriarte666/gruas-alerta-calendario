import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Timer, Gauge } from 'lucide-react';
import DatePickerInput from '@/components/common/DatePickerInput';

interface DateSectionProps {
  requestDate: string;
  serviceDate: string;
  startTime?: string;
  endTime?: string;
  craneMileage?: number;
  onRequestDateChange: (date: string) => void;
  onServiceDateChange: (date: string) => void;
  onStartTimeChange: (time: string | undefined) => void;
  onEndTimeChange: (time: string | undefined) => void;
  onCraneMileageChange: (mileage: number | undefined) => void;
  disabled?: boolean;
}

export const DateSection = ({
  requestDate,
  serviceDate,
  startTime,
  endTime,
  craneMileage,
  onRequestDateChange,
  onServiceDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onCraneMileageChange,
  disabled = false
}: DateSectionProps) => {
  const [enableStartTime, setEnableStartTime] = useState(!!startTime);
  const [enableEndTime, setEnableEndTime] = useState(!!endTime);
  const [enableCraneMileage, setEnableCraneMileage] = useState(!!craneMileage);
  const [startTimeError, setStartTimeError] = useState<string | undefined>();
  const [endTimeError, setEndTimeError] = useState<string | undefined>();

  const validateTimeFormat = (time: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const formatTimeInput = (value: string): string => {
    // Eliminar caracteres no numéricos excepto ":"
    let cleaned = value.replace(/[^\d:]/g, '');
    
    // Auto-agregar ":" después de 2 dígitos
    if (cleaned.length === 2 && !cleaned.includes(':')) {
      cleaned += ':';
    }
    
    // Limitar a formato HH:MM
    if (cleaned.length > 5) {
      cleaned = cleaned.substring(0, 5);
    }
    
    return cleaned;
  };

  return (
    <div className="space-y-6">
      {/* Fechas originales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="requestDate">Fecha de Solicitud</Label>
          <DatePickerInput
            id="requestDate"
            value={requestDate}
            onChange={onRequestDateChange}
            disabled={disabled}
            placeholder="Seleccionar fecha"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="serviceDate">Fecha de Servicio</Label>
          <DatePickerInput
            id="serviceDate"
            value={serviceDate}
            onChange={onServiceDateChange}
            disabled={disabled}
            placeholder="Seleccionar fecha"
          />
        </div>
      </div>

      {/* Campos opcionales con checkboxes */}
      <div className="space-y-4 p-4 border-2 border-dashed border-border rounded-lg bg-background/50">
        <div className="mb-2">
          <h4 className="text-sm font-semibold text-foreground">Datos Opcionales del Servicio</h4>
          <p className="text-xs text-muted-foreground">Activa los campos que necesites registrar</p>
        </div>

        {/* Hora de Inicio */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={enableStartTime}
              onCheckedChange={(checked) => {
                setEnableStartTime(!!checked);
                if (!checked) {
                  onStartTimeChange(undefined);
                }
              }}
              id="enable_start_time"
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex-1">
              <Label 
                htmlFor="enable_start_time" 
                className="flex items-center gap-2 cursor-pointer font-medium text-foreground"
              >
                <Clock className="w-4 h-4 text-blue-500" />
                Hora de Inicio del Servicio
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Registra la hora exacta en que comenzó el servicio
              </p>
            </div>
          </div>

          {enableStartTime && (
            <div className="ml-7 space-y-2">
              <Label htmlFor="startTime" className="text-sm">
                Hora de inicio (formato 24h)
              </Label>
              <Input
                id="startTime"
                type="text"
                value={startTime || ''}
                onChange={(e) => {
                  const formatted = formatTimeInput(e.target.value);
                  if (formatted === '' || validateTimeFormat(formatted) || formatted.length < 5) {
                    onStartTimeChange(formatted || undefined);
                    setStartTimeError(undefined);
                  } else {
                    setStartTimeError('Formato inválido. Use HH:MM (ejemplo: 08:00, 14:30)');
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value && !validateTimeFormat(value)) {
                    setStartTimeError('Formato inválido. Use HH:MM en formato 24 horas');
                  }
                }}
                disabled={disabled}
                className={`w-full max-w-xs ${startTimeError ? 'border-destructive' : ''}`}
                placeholder="08:00"
                maxLength={5}
              />
              {startTimeError && (
                <p className="text-xs text-destructive mt-1">{startTimeError}</p>
              )}
            </div>
          )}
        </div>

        {/* Hora de Término */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={enableEndTime}
              onCheckedChange={(checked) => {
                setEnableEndTime(!!checked);
                if (!checked) {
                  onEndTimeChange(undefined);
                }
              }}
              id="enable_end_time"
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex-1">
              <Label 
                htmlFor="enable_end_time" 
                className="flex items-center gap-2 cursor-pointer font-medium text-foreground"
              >
                <Timer className="w-4 h-4 text-orange-500" />
                Hora de Término del Servicio
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Registra la hora exacta en que finalizó el servicio
              </p>
            </div>
          </div>

          {enableEndTime && (
            <div className="ml-7 space-y-2">
              <Label htmlFor="endTime" className="text-sm">
                Hora de término (formato 24h)
              </Label>
              <Input
                id="endTime"
                type="text"
                value={endTime || ''}
                onChange={(e) => {
                  const formatted = formatTimeInput(e.target.value);
                  if (formatted === '' || validateTimeFormat(formatted) || formatted.length < 5) {
                    onEndTimeChange(formatted || undefined);
                    setEndTimeError(undefined);
                  } else {
                    setEndTimeError('Formato inválido. Use HH:MM (ejemplo: 14:30, 23:45)');
                  }
                }}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value && !validateTimeFormat(value)) {
                    setEndTimeError('Formato inválido. Use HH:MM en formato 24 horas');
                  }
                }}
                disabled={disabled}
                className={`w-full max-w-xs ${endTimeError ? 'border-destructive' : ''}`}
                placeholder="14:30"
                maxLength={5}
              />
              {endTimeError && (
                <p className="text-xs text-destructive mt-1">{endTimeError}</p>
              )}
            </div>
          )}
        </div>

        {/* Kilometraje de la Grúa */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={enableCraneMileage}
              onCheckedChange={(checked) => {
                setEnableCraneMileage(!!checked);
                if (!checked) {
                  onCraneMileageChange(undefined);
                }
              }}
              id="enable_crane_mileage"
              disabled={disabled}
              className="mt-1"
            />
            <div className="flex-1">
              <Label 
                htmlFor="enable_crane_mileage" 
                className="flex items-center gap-2 cursor-pointer font-medium text-foreground"
              >
                <Gauge className="w-4 h-4 text-green-500" />
                Kilómetros recorridos en servicio
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Registra los kilómetros recorridos durante el servicio
              </p>
            </div>
          </div>

          {enableCraneMileage && (
            <div className="ml-7 space-y-2">
              <Label htmlFor="craneMileage" className="text-sm">
                Kilómetros recorridos (km)
              </Label>
              <Input
                id="craneMileage"
                type="number"
                min="0"
                step="1"
                value={craneMileage || ''}
                onChange={(e) => onCraneMileageChange(e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={disabled}
                className="w-full max-w-xs"
                placeholder="125000"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};