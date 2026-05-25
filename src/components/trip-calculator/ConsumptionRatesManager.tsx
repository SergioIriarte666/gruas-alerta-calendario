import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  useConsumptionRates,
  useAddConsumptionRate,
  useUpdateConsumptionRate,
  useDeleteConsumptionRate,
  type ConsumptionRate,
} from '@/hooks/useConsumptionRates';
import { FUEL_TYPES } from '@/hooks/useFuelPrices';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const CRANE_TYPE_OPTIONS = [
  { value: 'light', label: 'Light (Liviana)' },
  { value: 'medium', label: 'Medium (Mediana)' },
  { value: 'heavy', label: 'Heavy (Pesada)' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'horquilla', label: 'Horquilla' },
];

/** Capitaliza el tipo de grúa para mostrar en tablas */
const formatCraneType = (type: string) =>
  type.charAt(0).toUpperCase() + type.slice(1);

export const ConsumptionRatesManager = () => {
  const { data: rates = [], isLoading } = useConsumptionRates();
  const { mutate: addRate, isPending: isAdding } = useAddConsumptionRate();
  const { mutate: updateRate, isPending: isUpdating } = useUpdateConsumptionRate();
  const { mutate: deleteRate } = useDeleteConsumptionRate();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<ConsumptionRate | null>(null);
  const [form, setForm] = useState({
    crane_type: '',
    fuel_type: 'diesel',
    base_consumption_per_km: 0,
    loaded_consumption_factor: 1.3,
    towing_consumption_factor: 1.5,
    toll_vehicle_category: 'LIVIANO',
  });

  const openNew = () => {
    setEditing(null);
    setForm({
      crane_type: '',
      fuel_type: 'diesel',
      base_consumption_per_km: 0,
      loaded_consumption_factor: 1.3,
      towing_consumption_factor: 1.5,
      toll_vehicle_category: 'LIVIANO',
    });
    setIsFormOpen(true);
  };

  const openEdit = (rate: ConsumptionRate) => {
    setEditing(rate);
    setForm({
      crane_type: rate.crane_type,
      fuel_type: rate.fuel_type,
      base_consumption_per_km: rate.base_consumption_per_km,
      loaded_consumption_factor: rate.loaded_consumption_factor,
      towing_consumption_factor: rate.towing_consumption_factor,
      toll_vehicle_category: rate.toll_vehicle_category || 'LIVIANO',
    });
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!form.crane_type || form.base_consumption_per_km <= 0) {
      toast.error('Complete los campos requeridos');
      return;
    }

    if (editing) {
      updateRate(
        { id: editing.id, ...form },
        {
          onSuccess: () => { toast.success('Tasa actualizada'); setIsFormOpen(false); },
          onError: () => toast.error('Error al actualizar'),
        }
      );
    } else {
      addRate(form, {
        onSuccess: () => { toast.success('Tasa registrada'); setIsFormOpen(false); },
        onError: () => toast.error('Error al registrar'),
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Consumos por Tipo de Grúa</h2>
          <p className="text-sm text-muted-foreground">Configura las tasas de consumo de combustible por tipo de grúa</p>
        </div>
        <Button onClick={openNew} className="bg-tms-green hover:bg-tms-green/90 text-white">
          <Plus className="size-4 mr-2" />
          Nueva Tasa
        </Button>
      </div>

      {rates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Settings2 className="size-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Sin tasas configuradas</p>
            <p className="text-sm">Agregue tasas de consumo para cada tipo de grúa</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Tipo Grúa</th>
                    <th className="pb-2 font-medium text-right">Rendimiento (Km/L)</th>
                    <th className="pb-2 font-medium text-right">Factor Cargada</th>
                    <th className="pb-2 font-medium text-right">Factor Arrastre</th>
                    <th className="pb-2 font-medium">Combustible</th>
                    <th className="pb-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rates.map((rate) => (
                    <tr key={rate.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2.5 font-medium">{formatCraneType(rate.crane_type)}</td>
                      <td className="text-right">{rate.base_consumption_per_km > 0 ? (1 / rate.base_consumption_per_km).toFixed(1) : '—'}</td>
                      <td className="text-right">{rate.loaded_consumption_factor}x</td>
                      <td className="text-right">{rate.towing_consumption_factor}x</td>
                      <td>
                        <Badge variant="outline">
                          {FUEL_TYPES.find((f) => f.value === rate.fuel_type)?.label || rate.fuel_type}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(rate)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8 text-destructive">
                                <Trash2 className="size-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>¿Desactivar tasa?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  La tasa de consumo será desactivada.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    deleteRate(rate.id, {
                                      onSuccess: () => toast.success('Tasa desactivada'),
                                    })
                                  }
                                >
                                  Desactivar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(v) => !v && setIsFormOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Tasa de Consumo' : 'Nueva Tasa de Consumo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Grúa</Label>
              <Select value={form.crane_type} onValueChange={(v) => setForm((f) => ({ ...f, crane_type: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {CRANE_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Combustible</Label>
              <Select value={form.fuel_type} onValueChange={(v) => setForm((f) => ({ ...f, fuel_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Rendimiento (Km/L)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.base_consumption_per_km > 0 ? parseFloat((1 / form.base_consumption_per_km).toFixed(4)) : ''}
                onChange={(e) => {
                  const kmPerL = Number(e.target.value);
                  setForm((f) => ({ ...f, base_consumption_per_km: kmPerL > 0 ? 1 / kmPerL : 0 }));
                }}
                placeholder="Ej: 4.5"
              />
              <p className="text-xs text-muted-foreground mt-1">¿Cuántos km recorre con 1 litro?</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Factor Cargada</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.loaded_consumption_factor}
                  onChange={(e) => setForm((f) => ({ ...f, loaded_consumption_factor: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Factor Arrastre</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.towing_consumption_factor}
                  onChange={(e) => setForm((f) => ({ ...f, towing_consumption_factor: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <Label>Categoría Peaje (Vehículo)</Label>
              <Select value={form.toll_vehicle_category} onValueChange={(v) => setForm((f) => ({ ...f, toll_vehicle_category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MOTO">Moto</SelectItem>
                  <SelectItem value="LIVIANO">Liviano (Auto / Camioneta)</SelectItem>
                  <SelectItem value="LIVIANO_REMOLQUE">Liviano con Remolque</SelectItem>
                  <SelectItem value="CAMION_2_EJES">Camión 2 Ejes</SelectItem>
                  <SelectItem value="CAMION_PESADO">Camión Pesado</SelectItem>
                  <SelectItem value="BUS_2_EJES">Bus 2 Ejes</SelectItem>
                  <SelectItem value="BUS_PESADO">Bus Pesado</SelectItem>
                  <SelectItem value="SOBREDIMENSIONADO">Sobredimensionado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={isAdding || isUpdating}
                className="bg-tms-green hover:bg-tms-green/90 text-white"
              >
                {editing ? 'Actualizar' : 'Registrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
