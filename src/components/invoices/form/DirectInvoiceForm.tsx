import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Client } from '@/types';
import { User, DollarSign, Calculator } from 'lucide-react';

interface DirectInvoiceFormProps {
  clients: Client[];
  selectedClientId: string;
  subtotal: number;
  onClientChange: (clientId: string) => void;
  onSubtotalChange: (subtotal: number) => void;
  errors?: {
    clientId?: string;
    subtotal?: string;
  };
}

export const DirectInvoiceForm: React.FC<DirectInvoiceFormProps> = ({
  clients,
  selectedClientId,
  subtotal,
  onClientChange,
  onSubtotalChange,
  errors
}) => {
  const vat = Math.round(subtotal * 0.19);
  const total = subtotal + vat;

  const activeClients = clients.filter(c => c.isActive);

  return (
    <div className="space-y-4">
      {/* Selector de Cliente */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-foreground">
          <User className="h-4 w-4 text-violet-500" />
          Cliente
          <span className="text-destructive">*</span>
        </Label>
        <Select value={selectedClientId} onValueChange={onClientChange}>
          <SelectTrigger className={errors?.clientId ? 'border-destructive' : ''}>
            <SelectValue placeholder="Seleccionar cliente..." />
          </SelectTrigger>
          <SelectContent>
            {activeClients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                <div className="flex flex-col py-0.5">
                  <span className="font-medium">{client.name}</span>
                  {client.department && client.department !== 'General' && (
                    <span className="text-xs text-violet-600 dark:text-violet-400">
                      {client.department}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{client.rut}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.clientId && (
          <p className="text-sm text-destructive">{errors.clientId}</p>
        )}
      </div>

      {/* Monto Subtotal */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-foreground">
          <DollarSign className="h-4 w-4 text-violet-500" />
          Subtotal (Neto)
          <span className="text-destructive">*</span>
        </Label>
        <Input
          type="number"
          min="0"
          step="1"
          value={subtotal || ''}
          onChange={(e) => onSubtotalChange(Math.round(Number(e.target.value) || 0))}
          placeholder="Ingrese monto neto..."
          className={errors?.subtotal ? 'border-destructive' : ''}
        />
        {errors?.subtotal && (
          <p className="text-sm text-destructive">{errors.subtotal}</p>
        )}
      </div>

      {/* Resumen calculado */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Calculator className="h-4 w-4 text-violet-500" />
          Resumen Calculado
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-medium">${subtotal.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA (19%):</span>
            <span className="font-medium">${vat.toLocaleString('es-CL')}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-semibold">Total:</span>
            <span className="font-bold text-violet-600">${total.toLocaleString('es-CL')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
