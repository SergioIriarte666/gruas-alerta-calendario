import { businessClock } from '@/utils/businessClock';
import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAddFuelPrice, useUpdateFuelPrice, FUEL_TYPES, REGIONS, type FuelPrice } from '@/hooks/useFuelPrices';
import { toast } from 'sonner';

import { toLocalDateString } from '@/utils/timezoneUtils';

const schema = z.object({
  fuel_type: z.string().min(1, 'Seleccione tipo'),
  price_per_liter: z.number().positive('Debe ser mayor a 0'),
  price_date: z.string().min(1, 'Seleccione fecha'),
  region: z.string().min(1, 'Seleccione región'),
  source: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

// Get nearest Thursday
function getNearestThursday(): string {
  const now = businessClock.now();
  const day = now.getDay(); // 0=Sun, 4=Thu
  const diff = (4 - day + 7) % 7;
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + (diff === 0 ? 0 : diff));
  return toLocalDateString(thursday);
}

interface FuelPriceFormProps {
  open: boolean;
  onClose: () => void;
  editingPrice: FuelPrice | null;
}

export const FuelPriceForm = ({ open, onClose, editingPrice }: FuelPriceFormProps) => {
  const { mutate: addPrice, isPending: isAdding } = useAddFuelPrice();
  const { mutate: updatePrice, isPending: isUpdating } = useUpdateFuelPrice();
  const isEditing = !!editingPrice;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fuel_type: 'diesel',
      price_per_liter: 0,
      price_date: getNearestThursday(),
      region: 'Nacional',
      source: '',
    },
  });

  useEffect(() => {
    if (editingPrice) {
      reset({
        fuel_type: editingPrice.fuel_type,
        price_per_liter: editingPrice.price_per_liter,
        price_date: editingPrice.price_date,
        region: editingPrice.region || 'Nacional',
        source: editingPrice.source || '',
      });
    } else {
      reset({
        fuel_type: 'diesel',
        price_per_liter: 0,
        price_date: getNearestThursday(),
        region: 'Nacional',
        source: '',
      });
    }
  }, [editingPrice, reset, open]);

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updatePrice(
        { id: editingPrice!.id, ...data },
        {
          onSuccess: () => {
            toast.success('Precio actualizado');
            onClose();
          },
          onError: () => toast.error('Error al actualizar'),
        }
      );
    } else {
      const payload = {
        fuel_type: data.fuel_type,
        price_per_liter: data.price_per_liter,
        price_date: data.price_date,
        region: data.region,
        source: data.source || 'manual',
      };
      addPrice(payload, {
          onSuccess: () => {
            toast.success('Precio registrado');
            onClose();
          },
          onError: () => toast.error('Error al registrar'),
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Precio' : 'Registrar Nuevo Precio'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Tipo de Combustible</Label>
            <Controller
              name="fuel_type"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUEL_TYPES.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.fuel_type && <p className="text-xs text-destructive mt-1">{errors.fuel_type.message}</p>}
          </div>

          <div>
            <Label>Precio por Litro (CLP)</Label>
            <Input
              type="number"
              step="1"
              {...register('price_per_liter', { valueAsNumber: true })}
            />
            {errors.price_per_liter && (
              <p className="text-xs text-destructive mt-1">{errors.price_per_liter.message}</p>
            )}
          </div>

          <div>
            <Label>Fecha del Precio</Label>
            <Controller
              name="price_date"
              control={control}
              render={({ field }) => (
                <DatePickerInput
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Seleccionar fecha"
                />
              )}
            />
            {errors.price_date && (
              <p className="text-xs text-destructive mt-1">{errors.price_date.message}</p>
            )}
          </div>

          <div>
            <Label>Región</Label>
            <Controller
              name="region"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label>Fuente</Label>
            <Input
              placeholder="ENAP, Estación X, etc."
              {...register('source')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isAdding || isUpdating}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isEditing ? 'Actualizar' : 'Registrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
