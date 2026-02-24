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

  const getRendimiento = (baseConsumption: number) => {
    return baseConsumption > 0 ? Math.round((1 / baseConsumption) * 100) / 100 : 0;
  };

  const startEdit = (id: string, baseConsumption: number) => {
    setEditingId(id);
    setEditValues({ [`${id}_rendimiento`]: String(getRendimiento(baseConsumption)) });
  };

  const handleSave = async (id: string) => {
    const rendimiento = Number(editValues[`${id}_rendimiento`]);
    if (!rendimiento || rendimiento <= 0) {
      toast.error('El rendimiento debe ser mayor a 0');
      return;
    }
    const base_consumption_per_km = Math.round((1 / rendimiento) * 10000) / 10000;
    try {
      await updateRate.mutateAsync({ id, base_consumption_per_km } as any);
      toast.success('Rendimiento actualizado');
      setEditingId(null);
      setEditValues({});
    } catch { toast.error('Error al actualizar'); }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Gauge className="w-5 h-5 text-violet-600" />
          Rendimiento por Tipo de Grúa
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
                      <span className="text-muted-foreground">Rendimiento</span>
                      {editingId === r.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number" step="0.1" className="w-24 h-7 text-xs"
                            value={editValues[`${r.id}_rendimiento`] ?? getRendimiento(r.base_consumption_per_km)}
                            onChange={e => setEditValues(v => ({ ...v, [`${r.id}_rendimiento`]: e.target.value }))}
                          />
                          <span className="text-xs text-muted-foreground">km/L</span>
                        </div>
                      ) : (
                        <span
                          className="font-medium cursor-pointer hover:text-violet-600 transition-colors"
                          onClick={() => startEdit(r.id, r.base_consumption_per_km)}
                        >
                          {getRendimiento(r.base_consumption_per_km)} km/L
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
