import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCraneConsumptionRates, useUpdateConsumptionRate } from '@/hooks/transport/useCraneConsumptionRates';
import { CRANE_TYPE_LABELS } from '@/types/transport';
import { Gauge, Save } from 'lucide-react';
import { toast } from 'sonner';

export const ConsumptionRatesManager: React.FC = () => {
  const { data: rates = [], isLoading } = useCraneConsumptionRates();
  const updateRate = useUpdateConsumptionRate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const getCraneLabel = (type: string) => CRANE_TYPE_LABELS.find(c => c.value === type)?.label || type;

  const startEdit = (id: string, field: string, value: number) => {
    setEditingId(id);
    setEditValues(prev => ({ ...prev, [`${id}_${field}`]: String(value) }));
  };

  const handleSave = async (id: string) => {
    const updates: Record<string, number> = {};
    Object.entries(editValues).forEach(([key, val]) => {
      if (key.startsWith(id + '_')) {
        const field = key.replace(id + '_', '');
        updates[field] = Number(val);
      }
    });
    try {
      await updateRate.mutateAsync({ id, ...updates } as any);
      toast.success('Factor actualizado');
      setEditingId(null);
      setEditValues({});
    } catch { toast.error('Error al actualizar'); }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gauge className="w-5 h-5 text-violet-600" />
          Tasas de Consumo por Tipo de Grúa
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando...</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rates.map(r => (
              <Card key={r.id} className="border">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-sm">
                      {getCraneLabel(r.crane_type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground capitalize">{r.fuel_type}</span>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Consumo base</span>
                      {editingId === r.id ? (
                        <Input
                          type="number" step="0.01" className="w-24 h-7 text-xs"
                          value={editValues[`${r.id}_base_consumption_per_km`] ?? r.base_consumption_per_km}
                          onChange={e => setEditValues(v => ({ ...v, [`${r.id}_base_consumption_per_km`]: e.target.value }))}
                        />
                      ) : (
                        <span className="font-medium cursor-pointer" onClick={() => startEdit(r.id, 'base_consumption_per_km', r.base_consumption_per_km)}>
                          {r.base_consumption_per_km} L/km
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Factor carga</span>
                      {editingId === r.id ? (
                        <Input
                          type="number" step="0.1" className="w-24 h-7 text-xs"
                          value={editValues[`${r.id}_loaded_consumption_factor`] ?? r.loaded_consumption_factor}
                          onChange={e => setEditValues(v => ({ ...v, [`${r.id}_loaded_consumption_factor`]: e.target.value }))}
                        />
                      ) : (
                        <span className="font-medium cursor-pointer" onClick={() => startEdit(r.id, 'loaded_consumption_factor', r.loaded_consumption_factor)}>
                          ×{r.loaded_consumption_factor}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Factor arrastre</span>
                      {editingId === r.id ? (
                        <Input
                          type="number" step="0.1" className="w-24 h-7 text-xs"
                          value={editValues[`${r.id}_towing_consumption_factor`] ?? r.towing_consumption_factor}
                          onChange={e => setEditValues(v => ({ ...v, [`${r.id}_towing_consumption_factor`]: e.target.value }))}
                        />
                      ) : (
                        <span className="font-medium cursor-pointer" onClick={() => startEdit(r.id, 'towing_consumption_factor', r.towing_consumption_factor)}>
                          ×{r.towing_consumption_factor}
                        </span>
                      )}
                    </div>
                  </div>

                  {editingId === r.id && (
                    <Button size="sm" onClick={() => handleSave(r.id)} className="w-full bg-violet-600 text-white">
                      <Save className="w-3 h-3 mr-1" /> Guardar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
