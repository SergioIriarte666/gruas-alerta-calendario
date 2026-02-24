import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFuelPrices, useCurrentFuelPrice, useCreateFuelPrice } from '@/hooks/transport/useFuelPrices';
import { Fuel, Plus, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const FuelPricesManager: React.FC = () => {
  const { data: prices = [] } = useFuelPrices();
  const { data: currentPrice } = useCurrentFuelPrice();
  const createPrice = useCreateFuelPrice();
  const [newPrice, setNewPrice] = useState('');

  const handleUpdatePrice = async () => {
    if (!newPrice || Number(newPrice) <= 0) { toast.error('Ingresa un precio válido'); return; }
    try {
      await createPrice.mutateAsync({ price_per_liter: Number(newPrice) });
      setNewPrice('');
      toast.success('Precio actualizado');
    } catch { toast.error('Error al actualizar precio'); }
  };

  const chartData = prices
    .slice(0, 20)
    .reverse()
    .map(p => ({ date: p.price_date, precio: Number(p.price_per_liter) }));

  const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

  return (
    <div className="space-y-4 mt-4">
      {/* Current price card */}
      <Card className="border-emerald-200 bg-emerald-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-emerald-100">
                <Fuel className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Precio Actual Diesel</p>
                <p className="text-3xl font-bold text-emerald-700">
                  {currentPrice ? formatCLP(currentPrice.price_per_liter) : '$---'}
                  <span className="text-sm font-normal text-muted-foreground">/litro</span>
                </p>
              </div>
            </div>
            {currentPrice && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-600">
                Actualizado: {currentPrice.price_date}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Update price form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="w-5 h-5 text-violet-600" />
            Actualizar Precio Semanal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label>Nuevo precio por litro (CLP)</Label>
              <Input
                type="number"
                placeholder="Ej: 820"
                value={newPrice}
                onChange={e => setNewPrice(e.target.value)}
              />
            </div>
            <Button onClick={handleUpdatePrice} className="bg-violet-600 hover:bg-violet-700 text-white" disabled={createPrice.isPending}>
              Actualizar Precio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Price chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-600" />
              Tendencia de Precios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCLP(v)} />
                  <Line type="monotone" dataKey="precio" stroke="#7c3aed" strokeWidth={2} dot={{ fill: '#7c3aed' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Price history table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Histórico de Precios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 px-3">Fecha</th>
                  <th className="py-2 px-3">Tipo</th>
                  <th className="py-2 px-3">Precio/Litro</th>
                  <th className="py-2 px-3">Fuente</th>
                  <th className="py-2 px-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {prices.map(p => (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3">{p.price_date}</td>
                    <td className="py-2 px-3 capitalize">{p.fuel_type}</td>
                    <td className="py-2 px-3 font-medium">{formatCLP(p.price_per_liter)}</td>
                    <td className="py-2 px-3">{p.source}</td>
                    <td className="py-2 px-3">
                      {p.is_current && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Vigente</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
