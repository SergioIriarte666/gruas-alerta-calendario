import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, Timer, Gauge } from 'lucide-react';

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

  return (
    <div className="space-y-6">
      {/* Fechas originales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="requestDate">Fecha de Solicitud</Label>
          <Input
            id="requestDate"
            type="date"
            value={requestDate}
            onChange={(e) => onRequestDateChange(e.target.value)}
            disabled={disabled}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="serviceDate">Fecha de Servicio</Label>
          <Input
            id="serviceDate"
            type="date"
            value={serviceDate}
            onChange={(e) => onServiceDateChange(e.target.value)}
            disabled={disabled}
            className="w-full"
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
                type="time"
                value={startTime || ''}
                onChange={(e) => onStartTimeChange(e.target.value || undefined)}
                disabled={disabled}
                className="w-full max-w-xs"
                placeholder="09:00"
              />
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
                type="time"
                value={endTime || ''}
                onChange={(e) => onEndTimeChange(e.target.value || undefined)}
                disabled={disabled}
                className="w-full max-w-xs"
                placeholder="14:30"
              />
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
                Kilometraje de la Grúa
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Registra el kilometraje del vehículo grúa al momento del servicio
              </p>
            </div>
          </div>

          {enableCraneMileage && (
            <div className="ml-7 space-y-2">
              <Label htmlFor="craneMileage" className="text-sm">
                Kilometraje (km)
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