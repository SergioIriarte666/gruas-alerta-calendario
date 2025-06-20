
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ServiceStatus } from '@/types';

interface ObservationsSectionProps {
  status: ServiceStatus;
  onStatusChange: (status: ServiceStatus) => void;
  observations: string;
  onObservationsChange: (value: string) => void;
  disabled?: boolean;
}

export const ObservationsSection = ({
  status,
  onStatusChange,
  observations,
  onObservationsChange,
  disabled = false
}: ObservationsSectionProps) => {
  return (
    <div className="space-y-6">
      {/* Estado */}
      <div className="space-y-2">
        <Label htmlFor="status">Estado</Label>
        <Select value={status} onValueChange={onStatusChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in_progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Observaciones */}
      <div className="space-y-2">
        <Label htmlFor="observations">Observaciones</Label>
        <Textarea
          id="observations"
          value={observations}
          onChange={(e) => onObservationsChange(e.target.value)}
          placeholder="Observaciones adicionales sobre el servicio..."
          rows={3}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
