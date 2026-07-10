import { useEffect, useState } from 'react';
import { endOfMonth, endOfYear, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCranes } from '@/hooks/useCranes';
import { useSiiResultado } from '@/hooks/useSiiRcv';
import { businessClock } from '@/utils/businessClock';
import { toLocalDateString } from '@/utils/timezoneUtils';

const formatCLP = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);

// Fallback si el crane aún no tiene owner_company_rut confiable coincidente con entityRut.
const LOWBOY_PLATES = ['JD-6696', 'DSBZ-85'];

type Preset = 'current-month' | 'previous-month' | 'current-year';

const PRESET_OPTIONS: [Preset, string][] = [
  ['current-month', 'Mes actual'],
  ['previous-month', 'Mes anterior'],
  ['current-year', 'Año actual'],
];

const rangeForPreset = (preset: Preset): { desde: string; hasta: string } => {
  const today = businessClock.todayDate();
  if (preset === 'previous-month') {
    const prev = subMonths(today, 1);
    return { desde: toLocalDateString(startOfMonth(prev)), hasta: toLocalDateString(endOfMonth(prev)) };
  }
  if (preset === 'current-year') {
    return { desde: toLocalDateString(startOfYear(today)), hasta: toLocalDateString(endOfYear(today)) };
  }
  return { desde: toLocalDateString(startOfMonth(today)), hasta: toLocalDateString(endOfMonth(today)) };
};

interface SiiResultadoPanelProps {
  entityRut: string;
}

export function SiiResultadoPanel({ entityRut }: SiiResultadoPanelProps) {
  const { cranes } = useCranes(true);
  const [preset, setPreset] = useState<Preset>('current-month');
  const [craneIds, setCraneIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || cranes.length === 0) return;
    const normalizedRut = entityRut.trim();
    const byRut = cranes.filter((crane) => crane.ownerCompanyRut?.trim() === normalizedRut).map((crane) => crane.id);
    const preselected = byRut.length > 0
      ? byRut
      : cranes.filter((crane) => LOWBOY_PLATES.includes(crane.licensePlate)).map((crane) => crane.id);
    setCraneIds(preselected);
    setInitialized(true);
  }, [cranes, entityRut, initialized]);

  const { desde, hasta } = rangeForPreset(preset);
  const { data, isLoading } = useSiiResultado(entityRut.trim(), craneIds, desde, hasta);

  const toggleCrane = (id: string) => {
    setCraneIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));
  };

  const margen = data?.margen ?? 0;
  const margenPositive = margen >= 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {PRESET_OPTIONS.map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={preset === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreset(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between sm:w-72">
                <span className="truncate">{craneIds.length ? `${craneIds.length} equipo(s) seleccionados` : 'Seleccionar equipos'}</span>
                <ChevronDown className="ml-2 size-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <ScrollArea className="h-64">
                <div className="space-y-1">
                  {cranes.map((crane) => (
                    <button
                      type="button"
                      key={crane.id}
                      onClick={() => toggleCrane(crane.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                    >
                      <Checkbox checked={craneIds.includes(crane.id)} />
                      <span className="min-w-0 flex-1 truncate">{crane.brand} {crane.model} ({crane.licensePlate})</span>
                      {craneIds.includes(crane.id) && <Check className="size-3 text-primary" />}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Calculando resultado…
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ingresos (neto)</p><p className="mt-1 text-2xl font-bold">{formatCLP(data?.ingresos ?? 0)}</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Costos</p><p className="mt-1 text-2xl font-bold">{formatCLP(data?.costos ?? 0)}</p></CardContent></Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Margen</p>
            <p className={`mt-1 text-2xl font-bold ${margenPositive ? 'text-emerald-600' : 'text-destructive'}`}>{formatCLP(margen)}</p>
            <p className={`text-xs ${margenPositive ? 'text-emerald-600' : 'text-destructive'}`}>{(data?.margenPct ?? 0).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Costos por categoría</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Categoría</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">%</TableHead></TableRow></TableHeader>
              <TableBody>
                {data?.costosPorCategoria.length ? data.costosPorCategoria.map((item) => (
                  <TableRow key={item.categoryId}>
                    <TableCell>{item.categoryName}</TableCell>
                    <TableCell className="text-right">{formatCLP(item.total)}</TableCell>
                    <TableCell className="text-right">{item.percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={3} className="h-20 text-center text-muted-foreground">Sin costos en el período.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Costos por equipo</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Equipo</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {data?.costosPorEquipo.length ? data.costosPorEquipo.map((item) => (
                  <TableRow key={item.craneId}>
                    <TableCell>{item.label} <span className="text-xs text-muted-foreground">({item.licensePlate})</span></TableCell>
                    <TableCell className="text-right">{formatCLP(item.total)}</TableCell>
                  </TableRow>
                )) : <TableRow><TableCell colSpan={2} className="h-20 text-center text-muted-foreground">Sin costos en el período.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Compras SII sin costo registrado (referencial)</CardTitle></CardHeader>
        <CardContent>
          {data?.comprasSinCosto.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Proveedor</TableHead><TableHead>Folio</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.comprasSinCosto.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.docDate}</TableCell>
                    <TableCell className="max-w-64 truncate">{item.counterpartName}</TableCell>
                    <TableCell>{item.folio}</TableCell>
                    <TableCell className="text-right">{formatCLP(item.totalAmount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-6 text-center text-emerald-600">Todo cuadra.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
