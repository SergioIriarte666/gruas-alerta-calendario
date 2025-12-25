import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Settings, FileText } from 'lucide-react';
import { InvoiceStatus } from '@/types';

interface InvoiceFormStep1Props {
  status: InvoiceStatus;
  numeroFiscal: string;
  canEditStatus: boolean;
  canEditNumeroFiscal: boolean;
  onStatusChange: (value: InvoiceStatus) => void;
  onNumeroFiscalChange: (value: string) => void;
  errors: {
    status?: string;
    numeroFiscal?: string;
  };
}

export const InvoiceFormStep1 = ({ 
  status, 
  numeroFiscal, 
  canEditStatus,
  canEditNumeroFiscal,
  onStatusChange, 
  onNumeroFiscalChange,
  errors 
}: InvoiceFormStep1Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Estado de la Factura"
        icon={<Settings className="h-5 w-5" />}
        color="purple"
        hasError={!!errors.status}
      >
        <div className="space-y-2">
          <Label htmlFor="status" className="text-foreground">Estado</Label>
          <Select 
            onValueChange={(value) => onStatusChange(value as InvoiceStatus)}
            value={status}
            disabled={!canEditStatus}
          >
            <SelectTrigger className="bg-background disabled:opacity-50 disabled:cursor-not-allowed">
              <SelectValue placeholder="Seleccionar estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Borrador</SelectItem>
              <SelectItem value="sent">Enviada</SelectItem>
              <SelectItem value="paid">Pagada</SelectItem>
              <SelectItem value="overdue">Vencida</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
          {errors.status && (
            <p className="text-sm text-destructive">{errors.status}</p>
          )}
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Número Fiscal"
        icon={<FileText className="h-5 w-5" />}
        color="blue"
        hasError={!!errors.numeroFiscal}
      >
        <div className="space-y-2">
          <Label htmlFor="numeroFiscal" className="text-foreground">Número Fiscal (Opcional)</Label>
          <Input
            id="numeroFiscal"
            type="text"
            placeholder="Ej: 123456789"
            value={numeroFiscal}
            onChange={(e) => onNumeroFiscalChange(e.target.value)}
            disabled={!canEditNumeroFiscal}
            className="bg-background disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {errors.numeroFiscal && (
            <p className="text-sm text-destructive">{errors.numeroFiscal}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Número fiscal para registro SII (opcional)
          </p>
        </div>
      </ColoredSectionCard>
    </div>
  );
};
