import React, { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Shield } from 'lucide-react';

export const CustodySection = () => {
  const { watch, setValue, register, formState: { errors } } = useFormContext();
  
  const custodyMode = watch('custodyMode');
  const custodyDays = watch('custodyDays');
  const custodyDailyRate = watch('custodyDailyRate');
  const custodyStartDate = watch('custodyStartDate');
  const custodyEndDate = watch('custodyEndDate');
  const custodyDiscountPercentage = watch('custodyDiscountPercentage');

  // Cálculo automático para modo manual
  useEffect(() => {
    if (custodyMode === 'manual' && custodyDays && custodyDailyRate) {
      const subtotal = custodyDays * custodyDailyRate;
      const discount = (subtotal * (custodyDiscountPercentage || 0)) / 100;
      const total = subtotal - discount;
      setValue('custodyTotalAmount', total);
    }
  }, [custodyDays, custodyDailyRate, custodyDiscountPercentage, custodyMode, setValue]);

  // Cálculo automático para modo calendario
  useEffect(() => {
    if (custodyMode === 'calendar' && custodyStartDate && custodyEndDate && custodyDailyRate) {
      const start = new Date(custodyStartDate);
      const end = new Date(custodyEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      setValue('custodyDays', diffDays);
      
      const subtotal = diffDays * custodyDailyRate;
      const discount = (subtotal * (custodyDiscountPercentage || 0)) / 100;
      const total = subtotal - discount;
      setValue('custodyTotalAmount', total);
    }
  }, [custodyStartDate, custodyEndDate, custodyDailyRate, custodyDiscountPercentage, custodyMode, setValue]);

  if (custodyMode === 'none') return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Información de Custodia
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="custodyMode">Modo de Custodia</Label>
            <Select onValueChange={(value) => setValue('custodyMode', value)} defaultValue={custodyMode}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar modo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin custodia</SelectItem>
                <SelectItem value="manual">Manual (días específicos)</SelectItem>
                <SelectItem value="calendar">Calendario (fechas)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="custodyVehicleType">Tipo de Vehículo</Label>
            <Input
              {...register('custodyVehicleType')}
              placeholder="Ej: Automóvil, Camioneta, Motocicleta"
            />
            {errors.custodyVehicleType && (
              <p className="text-destructive text-sm mt-1">{String(errors.custodyVehicleType.message)}</p>
            )}
          </div>
        </div>

        {custodyMode === 'manual' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="custodyDays">Días de Custodia</Label>
              <Input
                type="number"
                {...register('custodyDays', { valueAsNumber: true })}
                placeholder="Número de días"
              />
              {errors.custodyDays && (
                <p className="text-destructive text-sm mt-1">{String(errors.custodyDays.message)}</p>
              )}
            </div>

            <div>
              <Label htmlFor="custodyDailyRate">Tarifa Diaria</Label>
              <Input
                type="number"
                {...register('custodyDailyRate', { valueAsNumber: true })}
                placeholder="Tarifa por día"
              />
              {errors.custodyDailyRate && (
                <p className="text-destructive text-sm mt-1">{String(errors.custodyDailyRate.message)}</p>
              )}
            </div>
          </div>
        )}

        {custodyMode === 'calendar' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="custodyStartDate">Fecha de Inicio</Label>
              <Input
                type="date"
                {...register('custodyStartDate')}
              />
              {errors.custodyStartDate && (
                <p className="text-destructive text-sm mt-1">{String(errors.custodyStartDate.message)}</p>
              )}
            </div>

            <div>
              <Label htmlFor="custodyEndDate">Fecha de Fin</Label>
              <Input
                type="date"
                {...register('custodyEndDate')}
              />
              {errors.custodyEndDate && (
                <p className="text-destructive text-sm mt-1">{String(errors.custodyEndDate.message)}</p>
              )}
            </div>

            <div>
              <Label htmlFor="custodyDailyRate">Tarifa Diaria</Label>
              <Input
                type="number"
                {...register('custodyDailyRate', { valueAsNumber: true })}
                placeholder="Tarifa por día"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="custodyDiscountPercentage">Descuento (%)</Label>
            <Input
              type="number"
              {...register('custodyDiscountPercentage', { valueAsNumber: true })}
              placeholder="0"
              min="0"
              max="100"
            />
          </div>

          <div>
            <Label htmlFor="custodyTotalAmount">Total Custodia</Label>
            <Input
              type="number"
              {...register('custodyTotalAmount', { valueAsNumber: true })}
              placeholder="Total calculado"
              readOnly
              className="bg-muted"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="custodyNotes">Notas de Custodia</Label>
          <Textarea
            {...register('custodyNotes')}
            placeholder="Observaciones adicionales sobre la custodia"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
};