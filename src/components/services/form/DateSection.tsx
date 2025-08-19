import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface DateSectionProps {
  requestDate: string;
  serviceDate: string;
  onRequestDateChange: (date: string) => void;
  onServiceDateChange: (date: string) => void;
  disabled?: boolean;
}

export const DateSection = ({
  requestDate,
  serviceDate,
  onRequestDateChange,
  onServiceDateChange,
  disabled = false
}: DateSectionProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Fecha de Solicitud */}
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

      {/* Fecha de Servicio */}
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
  );
};