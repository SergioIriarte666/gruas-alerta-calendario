import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useRoutes } from '@/hooks/transport/useRoutes';
import { useCurrentFuelPrice } from '@/hooks/transport/useFuelPrices';
import { useCraneConsumptionRates } from '@/hooks/transport/useCraneConsumptionRates';
import { useRouteTolls, useTollRates } from '@/hooks/transport/useTollStations';
import { useTransportCalculation } from '@/hooks/transport/useTransportCalculation';
import { CRANE_TYPE_LABELS } from '@/types/transport';
import { supabase } from '@/integrations/supabase/client';
import { Fuel, DollarSign, Truck, MapPin, Calculator, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export const TransportCostCalculator: React.FC = () => {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [craneType, setCraneType] = useState<string>('medium');
  const [vehicleCount, setVehicleCount] = useState<1 | 2>(1);
  const [manualDistance, setManualDistance] = useState<string>('');
  const [operatorPerDiem, setOperatorPerDiem] = useState<string>('45000');
  const [isSaving, setIsSaving] = useState(false);

  const { data: routes = [] } = useRoutes();
  const { data: currentFuel } = useCurrentFuelPrice();
  const { data: consumptionRates = [] } = useCraneConsumptionRates();
  const { data: routeTolls = [] } = useRouteTolls(selectedRouteId || undefined);
  const { data: allTollRates = [] } = useTollRates();

  const selectedRoute = routes.find(r => r.id === selectedRouteId);
  const distanceKm = selectedRoute ? selectedRoute.distance_km : Number(manualDistance) || 0;
  const consumptionFactor = selectedRoute ? selectedRoute.consumption_factor : 1.0;

  const tollAmounts = useMemo(() => {
    if (!routeTolls.length) return [];
    return routeTolls.map(rt => {
      const station = rt.toll_stations;
      const stationRates = allTollRates.filter(r => r.toll_station_id === rt.toll_station_id && r.is_active);
      const craneRate = stationRates.find(r => r.vehicle_category.includes('grua'))?.rate_amount || 0;
      const vehicleRate = stationRates.find(r => r.vehicle_category.includes('arrastrado'))?.rate_amount || 0;
      return { name: station?.name || 'Peaje', craneRate, vehicleRate };
    });
  }, [routeTolls, allTollRates]);

  const estimate = useTransportCalculation(
    distanceKm && currentFuel
      ? {
          distanceKm,
          craneType,
          consumptionFactor,
          vehicleCount,
          fuelPricePerLiter: currentFuel.price_per_liter,
          consumptionRates,
          tollAmounts,
          operatorPerDiem: Number(operatorPerDiem) || 0,
        }
      : null
  );

  const formatCLP = (n: number) => `$${n.toLocaleString('es-CL')}`;

  const craneLabel = CRANE_TYPE_LABELS.find(c => c.value === craneType)?.label || craneType;
  const routeLabel = selectedRoute ? selectedRoute.name : 'Manual';

  const handleSaveAsCost = async () => {
    if (!estimate) return;
    setIsSaving(true);
    try {
      // Get or create "Transporte" category
      const { data: categories } = await supabase
        .from('cost_categories')
        .select('id')
        .ilike('name', '%transporte%')
        .limit(1);

      let categoryId = categories?.[0]?.id;
      if (!categoryId) {
        const { data: newCat } = await supabase
          .from('cost_categories')
          .insert({ name: 'Transporte', description: 'Costos de transporte y traslado' } as any)
          .select('id')
          .single();
        categoryId = newCat?.id;
      }

      if (!categoryId) {
        toast.error('No se pudo obtener la categoría de transporte');
        return;
      }

      const description = `Transporte ${routeLabel} - Grúa ${craneLabel} (${distanceKm} km)`;

      // Insert fuel cost
      await supabase.from('costs').insert({
        category_id: categoryId,
        description: `${description} - Combustible`,
        amount: estimate.fuelCost.totalCost,
        date: new Date().toISOString().split('T')[0],
        subcategory: 'Combustible',
        notes: `${estimate.fuelCost.totalLiters}L a ${formatCLP(estimate.fuelCost.currentFuelPrice)}/L`,
      } as any);

      // Insert tolls if any
      if (estimate.tollCosts.totalTolls > 0) {
        await supabase.from('costs').insert({
          category_id: categoryId,
          description: `${description} - Peajes`,
          amount: estimate.tollCosts.totalTolls,
          date: new Date().toISOString().split('T')[0],
          subcategory: 'Peajes',
          notes: estimate.tollCosts.tolls.map(t => `${t.name}: ${formatCLP(t.amount)}`).join(', '),
        } as any);
      }

      // Insert additional costs
      if (estimate.additionalCosts.total > 0) {
        await supabase.from('costs').insert({
          category_id: categoryId,
          description: `${description} - Viáticos y desgaste`,
          amount: estimate.additionalCosts.total,
          date: new Date().toISOString().split('T')[0],
          subcategory: 'Viáticos',
          notes: `Viáticos: ${formatCLP(estimate.additionalCosts.operatorPerDiem)}, Desgaste: ${formatCLP(estimate.additionalCosts.vehicleWear)}`,
        } as any);
      }

      toast.success('Costos guardados exitosamente', {
        description: `Total: ${formatCLP(estimate.totalEstimate)} registrado en módulo de costos`,
      });
    } catch (err) {
      toast.error('Error al guardar los costos');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      {/* Input Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="w-5 h-5 text-violet-600" />
            Parámetros del Viaje
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Route selector */}
          <div className="space-y-2">
            <Label>Ruta predefinida</Label>
            <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar ruta o ingresar distancia manual" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">📍 Distancia manual</SelectItem>
                {routes.filter(r => r.is_active).map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} ({r.distance_km} km)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Manual distance */}
          {(!selectedRouteId || selectedRouteId === 'manual') && (
            <div className="space-y-2">
              <Label>Distancia (km)</Label>
              <Input
                type="number"
                placeholder="Ej: 827"
                value={manualDistance}
                onChange={(e) => setManualDistance(e.target.value)}
              />
            </div>
          )}

          {/* Crane type */}
          <div className="space-y-2">
            <Label>Tipo de Grúa</Label>
            <Select value={craneType} onValueChange={setCraneType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CRANE_TYPE_LABELS.map(ct => (
                  <SelectItem key={ct.value} value={ct.value}>
                    <span className="flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      {ct.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle count toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div>
              <p className="text-sm font-medium">Vehículo arrastrado</p>
              <p className="text-xs text-muted-foreground">2 vehículos = grúa + arrastrado</p>
            </div>
            <Switch
              checked={vehicleCount === 2}
              onCheckedChange={(checked) => setVehicleCount(checked ? 2 : 1)}
            />
          </div>

          {/* Per diem */}
          <div className="space-y-2">
            <Label>Viáticos operador (CLP)</Label>
            <Input
              type="number"
              value={operatorPerDiem}
              onChange={(e) => setOperatorPerDiem(e.target.value)}
            />
          </div>

          {/* Current fuel price */}
          {currentFuel && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <Fuel className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">
                Precio Diesel Actual: {formatCLP(currentFuel.price_per_liter)}/lt
              </span>
              <Badge variant="outline" className="ml-auto text-xs border-emerald-300 text-emerald-600">
                {currentFuel.price_date}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-violet-600" />
            Estimación de Costos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {estimate ? (
            <div className="space-y-4">
              {/* Fuel - highlighted */}
              <div className="p-4 rounded-lg bg-violet-50 border border-violet-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-violet-700 flex items-center gap-2">
                    <Fuel className="w-4 h-4" /> Combustible
                  </span>
                  <span className="text-xl font-bold text-violet-700">
                    {formatCLP(estimate.fuelCost.totalCost)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-violet-600">
                  <span>Distancia: {estimate.fuelCost.routeDistance} km</span>
                  <span>Rendimiento: {estimate.fuelCost.rendimientoKmL} km/L</span>
                  <span>Factor ruta: ×{estimate.fuelCost.consumptionFactor}</span>
                  <span className="font-medium">Total litros: {estimate.fuelCost.totalLiters} L</span>
                </div>
              </div>

              {/* Tolls */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Peajes
                  </span>
                  <span className="text-lg font-bold">{formatCLP(estimate.tollCosts.totalTolls)}</span>
                </div>
                {estimate.tollCosts.tolls.length > 0 ? (
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {estimate.tollCosts.tolls.map((t, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{t.name}</span>
                        <span>{formatCLP(t.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin peajes configurados para esta ruta</p>
                )}
              </div>

              {/* Additional */}
              <div className="p-4 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Otros Costos</span>
                  <span className="text-lg font-bold">{formatCLP(estimate.additionalCosts.total)}</span>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Viáticos operador</span>
                    <span>{formatCLP(estimate.additionalCosts.operatorPerDiem)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Desgaste vehículo</span>
                    <span>{formatCLP(estimate.additionalCosts.vehicleWear)}</span>
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="p-4 rounded-lg bg-primary/10 border-2 border-primary/30">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">TOTAL ESTIMADO</span>
                  <span className="text-2xl font-bold text-primary-foreground bg-primary px-4 py-1 rounded-lg">
                    {formatCLP(estimate.totalEstimate)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Combustible: {Math.round((estimate.fuelCost.totalCost / estimate.totalEstimate) * 100)}% del total
                </p>
              </div>

              {/* Save as Cost button */}
              <Button
                onClick={handleSaveAsCost}
                disabled={isSaving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Guardar como Costo</>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calculator className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Configura los parámetros para ver la estimación</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
