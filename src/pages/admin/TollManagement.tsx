import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Edit2,
  FileText,
  MapPin,
  Milestone,
  PlusCircle,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  ParsedTollRate,
  TOLL_VEHICLE_CATEGORIES,
  TollRateCurrent,
  useApplyParsedRates,
  useCreateTollRatesBatch,
  useCreateTollStation,
  useTollConcessions,
  useTollRatesCurrent,
  useUpdateTollStationKm,
  useUpdateTollRate,
} from '@/hooks/useTollManagement';
import { formatBusinessDateLong, getCurrentChileDateString } from '@/utils/timezoneUtils';

const formatClp = (amount: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);

const CATEGORY_COLORS: Record<string, string> = {
  LIVIANO: 'bg-sky-100 text-sky-800 border-sky-300',
  CAMION_2_EJES: 'bg-amber-100 text-amber-900 border-amber-300',
  CAMION_PESADO: 'bg-rose-100 text-rose-900 border-rose-300',
};

const groupRatesByConcession = (rates: TollRateCurrent[]) =>
  rates.reduce<Record<string, TollRateCurrent[]>>((accumulator, rate) => {
    const key = rate.concessionName;
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(rate);
    return accumulator;
  }, {});

const TollRatesTable = () => {
  const { data: rates = [], isLoading, refetch, isFetching } = useTollRatesCurrent();
  const updateRate = useUpdateTollRate();
  const updateKm = useUpdateTollStationKm();
  const [editingRate, setEditingRate] = useState<TollRateCurrent | null>(null);
  const [editingKm, setEditingKm] = useState<{
    stationId: string;
    stationName: string;
    currentKm: number | null;
  } | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [newValidFrom, setNewValidFrom] = useState(getCurrentChileDateString());
  const [newKm, setNewKm] = useState('');

  const groupedRates = useMemo(() => groupRatesByConcession(rates), [rates]);

  const handleEdit = (rate: TollRateCurrent) => {
    setEditingRate(rate);
    setNewAmount(String(rate.rateAmount));
    setNewValidFrom(getCurrentChileDateString());
  };

  const handleSave = async () => {
    if (!editingRate || !newAmount || !newValidFrom) return;

    await updateRate.mutateAsync({
      rateId: editingRate.rateId,
      newAmount: Number(newAmount),
      validFrom: newValidFrom,
    });

    setEditingRate(null);
  };

  const handleSaveKm = async () => {
    if (!editingKm) return;

    const parsedKm = newKm.trim() === '' ? null : Number(newKm);
    await updateKm.mutateAsync({
      stationId: editingKm.stationId,
      kmMarker: parsedKm,
    });

    setEditingKm(null);
  };

  return (
    <div className="space-y-5">
      <Card className="border-amber-200/70 bg-gradient-to-r from-amber-50 via-background to-background">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Tarifas vigentes por concesión</p>
            <p className="text-xs text-muted-foreground">
              Historial vivo: al editar una tarifa se desactiva la anterior y se crea una nueva vigencia.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 size-4 ${isFetching ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Cargando tarifas de peajes...
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedRates).map(([concessionName, concessionRates]) => {
          const byStation = concessionRates.reduce<Record<string, TollRateCurrent[]>>((accumulator, rate) => {
            if (!accumulator[rate.stationName]) {
              accumulator[rate.stationName] = [];
            }
            accumulator[rate.stationName].push(rate);
            return accumulator;
          }, {});

          const concessionMeta = concessionRates[0];

          return (
            <Card key={concessionName} className="overflow-hidden border-border/70 shadow-sm">
              <CardHeader className="border-b bg-muted/25 pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <MapPin className="size-4 text-purple-600 shrink-0" />
                      <span className="truncate">{concessionName}</span>
                      <Badge variant="outline" className="text-xs font-normal ml-auto shrink-0">
                        {Object.keys(byStation).length} peajes
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {concessionMeta.route} · {Object.keys(byStation).length} peajes con tarifa vigente
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="border-amber-300 bg-amber-100/70 text-amber-900">
                      Vigencia {formatBusinessDateLong(concessionMeta.rateValidFrom)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-[35%]" />
                      <col className="w-[10%]" />
                      <col className="w-[8%]" />
                      <col className="w-[15%]" />
                      <col className="w-[16%]" />
                      <col className="w-[16%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground font-medium">
                        <th className="text-left py-2 px-3 font-medium">Peaje</th>
                        <th className="text-left py-2 px-3 font-medium">Tipo</th>
                        <th className="text-left py-2 px-3 font-medium">Km</th>
                        <th className="text-right py-2 px-3 font-medium">Liviano</th>
                        <th className="text-right py-2 px-3 font-medium">Camión 2 Ejes</th>
                        <th className="text-right py-2 px-3 font-medium">Camión Pesado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {Object.entries(byStation).map(([stationName, stationRates]) => (
                        <tr key={stationName} className="hover:bg-muted/30">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">{stationName}</span>
                              {stationRates[0]?.kmMarker !== null && (
                                <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 py-0.5 rounded">
                                  km {stationRates[0]?.kmMarker}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const firstRate = stationRates[0];
                                  setEditingKm({
                                    stationId: firstRate.stationId,
                                    stationName,
                                    currentKm: firstRate.kmMarker,
                                  });
                                  setNewKm(String(firstRate.kmMarker ?? ''));
                                }}
                                className="text-muted-foreground hover:text-foreground opacity-30 hover:opacity-100 transition-opacity"
                                title="Editar km"
                              >
                                <Edit2 className="size-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="text-xs font-normal">
                              {stationRates[0]?.stationType || 'N/D'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-muted-foreground">
                            {stationRates[0]?.kmMarker ?? '—'}
                          </td>
                          {TOLL_VEHICLE_CATEGORIES.map((category) => {
                            const rate = stationRates.find((item) => item.vehicleCategory === category.value);
                            return (
                              <td key={category.value} className="py-2.5 px-3 text-right">
                                {rate ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="font-mono tabular-nums">{formatClp(rate.rateAmount)}</span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-5 text-muted-foreground hover:text-foreground shrink-0"
                                      onClick={() => handleEdit(rate)}
                                    >
                                      <Edit2 className="size-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Dialog open={!!editingRate} onOpenChange={(open) => !open && setEditingRate(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar tarifa vigente</DialogTitle>
          </DialogHeader>
          {editingRate && (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                <div className="font-semibold">{editingRate.stationName}</div>
                <div className="mt-1 text-muted-foreground">{editingRate.concessionName}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline">{editingRate.vehicleCategory}</Badge>
                  <Badge variant="outline">Actual {formatClp(editingRate.rateAmount)}</Badge>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-rate-amount">Nueva tarifa</Label>
                  <Input
                    id="new-rate-amount"
                    type="number"
                    min="0"
                    value={newAmount}
                    onChange={(event) => setNewAmount(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-rate-valid-from">Vigente desde</Label>
                  <Input
                    id="new-rate-valid-from"
                    type="date"
                    value={newValidFrom}
                    onChange={(event) => setNewValidFrom(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRate(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateRate.isPending}>
              {updateRate.isPending ? 'Guardando...' : 'Guardar vigencia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingKm} onOpenChange={(open) => !open && setEditingKm(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Editar km</DialogTitle>
          </DialogHeader>
          {editingKm && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">Peaje: </span>
                <strong>{editingKm.stationName}</strong>
              </div>
              <div>
                <Label htmlFor="station-km-edit">Km marker</Label>
                <Input
                  id="station-km-edit"
                  type="number"
                  min="0"
                  value={newKm}
                  onChange={(event) => setNewKm(event.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingKm(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveKm} disabled={updateKm.isPending}>
              {updateKm.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ManualTollForm = () => {
  const { data: concessions = [] } = useTollConcessions();
  const createStation = useCreateTollStation();
  const createRatesBatch = useCreateTollRatesBatch();

  const [form, setForm] = useState({
    concessionId: '',
    name: '',
    location: '',
    highway: 'Ruta 5 Norte',
    stationType: 'TRONCAL' as 'TRONCAL' | 'LATERAL' | 'ACCESO',
    kmMarker: '',
    validFrom: getCurrentChileDateString(),
    liviano: '',
    camion2Ejes: '',
    camionPesado: '',
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.concessionId || !form.name || !form.location || !form.validFrom) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    const station = await createStation.mutateAsync({
      concessionId: form.concessionId,
      name: form.name.trim(),
      location: form.location.trim(),
      highway: form.highway.trim() || undefined,
      stationType: form.stationType,
      kmMarker: form.kmMarker ? Number(form.kmMarker) : undefined,
    });

    const rateRows = [
      { vehicleCategory: 'LIVIANO', rateAmount: Number(form.liviano) },
      { vehicleCategory: 'CAMION_2_EJES', rateAmount: Number(form.camion2Ejes) },
      { vehicleCategory: 'CAMION_PESADO', rateAmount: Number(form.camionPesado) },
    ].filter((rate) => Number.isFinite(rate.rateAmount) && rate.rateAmount > 0);

    await createRatesBatch.mutateAsync(
      rateRows.map((rate) => ({
        stationId: station.id,
        vehicleCategory: rate.vehicleCategory,
        rateAmount: rate.rateAmount,
        validFrom: form.validFrom,
      })),
    );

    setForm({
      concessionId: '',
      name: '',
      location: '',
      highway: 'Ruta 5 Norte',
      stationType: 'TRONCAL',
      kmMarker: '',
      validFrom: getCurrentChileDateString(),
      liviano: '',
      camion2Ejes: '',
      camionPesado: '',
    });
  };

  const isSaving = createStation.isPending || createRatesBatch.isPending;

  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-background">
        <CardTitle className="flex items-center gap-2 text-base">
          <PlusCircle className="size-4 text-emerald-700" />
          Alta manual de peaje
        </CardTitle>
        <CardDescription>
          Crea una plaza nueva y registra de inmediato sus tarifas vigentes para la flota.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Concesión *</Label>
              <Select
                value={form.concessionId}
                onValueChange={(value) => setForm((current) => ({ ...current, concessionId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona concesión" />
                </SelectTrigger>
                <SelectContent>
                  {concessions.map((concession) => (
                    <SelectItem key={concession.id} value={concession.id}>
                      {concession.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station-name">Nombre del peaje *</Label>
              <Input
                id="station-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Ej. Puerto Viejo Norte"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station-location">Ubicación *</Label>
              <Input
                id="station-location"
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Ej. Copiapó"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station-highway">Autopista</Label>
              <Input
                id="station-highway"
                value={form.highway}
                onChange={(event) => setForm((current) => ({ ...current, highway: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de peaje *</Label>
              <Select
                value={form.stationType}
                onValueChange={(value: 'TRONCAL' | 'LATERAL' | 'ACCESO') =>
                  setForm((current) => ({ ...current, stationType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRONCAL">TRONCAL</SelectItem>
                  <SelectItem value="LATERAL">LATERAL</SelectItem>
                  <SelectItem value="ACCESO">ACCESO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="station-km">Km referencial</Label>
              <Input
                id="station-km"
                type="number"
                min="0"
                value={form.kmMarker}
                onChange={(event) => setForm((current) => ({ ...current, kmMarker: event.target.value }))}
                placeholder="Ej. 653"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Milestone className="size-4 text-emerald-700" />
              <h2 className="text-sm font-semibold">Tarifas iniciales</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label htmlFor="station-valid-from">Vigente desde *</Label>
                <Input
                  id="station-valid-from"
                  type="date"
                  value={form.validFrom}
                  onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate-liviano">Liviano</Label>
                <Input
                  id="rate-liviano"
                  type="number"
                  min="0"
                  value={form.liviano}
                  onChange={(event) => setForm((current) => ({ ...current, liviano: event.target.value }))}
                  placeholder="900"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate-2-ejes">Camión 2 ejes</Label>
                <Input
                  id="rate-2-ejes"
                  type="number"
                  min="0"
                  value={form.camion2Ejes}
                  onChange={(event) => setForm((current) => ({ ...current, camion2Ejes: event.target.value }))}
                  placeholder="2900"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rate-pesado">Camión pesado</Label>
                <Input
                  id="rate-pesado"
                  type="number"
                  min="0"
                  value={form.camionPesado}
                  onChange={(event) => setForm((current) => ({ ...current, camionPesado: event.target.value }))}
                  placeholder="5300"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              <PlusCircle className="mr-2 size-4" />
              {isSaving ? 'Guardando...' : 'Crear peaje y tarifas'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const TollPdfUploader = () => {
  const { data: concessions = [] } = useTollConcessions();
  const applyRates = useApplyParsedRates();
  const fileRef = useRef<HTMLInputElement>(null);

  const [isParsing, setIsParsing] = useState(false);
  const [parsedRates, setParsedRates] = useState<ParsedTollRate[] | null>(null);
  const [concessionName, setConcessionName] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selectedConcession, setSelectedConcession] = useState('');
  const [validFrom, setValidFrom] = useState(getCurrentChileDateString());
  const [rawText, setRawText] = useState('');

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParsedRates(null);
    setWarnings([]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error('No autenticado');

      const form = new FormData();
      form.append('file', file);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-mop-toll-pdf`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: form,
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Error al parsear PDF');
      }

      setParsedRates(data.rates || []);
      setConcessionName(data.concessionName || null);
      setWarnings(data.warnings || []);
      setRawText(data.rawText || '');

      if (data.concessionName) {
        const normalizedDetected = String(data.concessionName).toLowerCase();
        const match = concessions.find(
          (concession) =>
            concession.name.toLowerCase().includes(normalizedDetected) ||
            normalizedDetected.includes(concession.name.toLowerCase()),
        );

        if (match) {
          setSelectedConcession(match.id);
        }
      }

      if ((data.rates || []).length > 0) {
        toast.success(`PDF parseado: ${data.rates.length} tarifas detectadas`);
      } else {
        toast.warning('No se detectaron tarifas. Revisa las advertencias antes de aplicar.');
      }
    } catch (error: any) {
      toast.error('Error al procesar PDF', { description: error.message });
    } finally {
      setIsParsing(false);
      if (fileRef.current) {
        fileRef.current.value = '';
      }
    }
  };

  const handleApply = async () => {
    if (!selectedConcession || !parsedRates?.length) return;

    await applyRates.mutateAsync({
      concessionId: selectedConcession,
      validFrom,
      rates: parsedRates,
    });

    setParsedRates(null);
    setWarnings([]);
    setRawText('');
    setConcessionName(null);
  };

  const relevantCategories = TOLL_VEHICLE_CATEGORIES.map((category) => category.value);

  return (
    <div className="space-y-5">
      <Card className="border-dashed border-amber-300 bg-gradient-to-br from-amber-50 via-background to-background">
        <CardContent className="space-y-4 p-6">
          <div className="text-center">
            <FileText className="mx-auto mb-3 size-9 text-amber-700" />
            <p className="text-sm font-semibold text-foreground">Subir PDF oficial del MOP</p>
            <p className="mx-auto mt-1 max-w-2xl text-xs text-muted-foreground">
              Descarga el PDF desde{' '}
              <a
                href="https://concesiones.mop.gob.cl/peajes-y-porticos/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-amber-700 underline underline-offset-4"
              >
                concesiones.mop.gob.cl
              </a>{' '}
              y súbelo aquí. El sistema extrae texto, detecta concesión y genera una vista previa antes de guardar.
            </p>
          </div>
          <div className="flex justify-center">
            <Button
              variant="outline"
              type="button"
              disabled={isParsing}
              onClick={() => fileRef.current?.click()}
              className="border-amber-300 bg-background"
            >
              <Upload className="mr-2 size-4" />
              {isParsing ? 'Procesando PDF...' : 'Seleccionar PDF'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTriangle className="size-4" />
          <AlertDescription className="space-y-1 text-sm">
            {warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {parsedRates && parsedRates.length > 0 && (
        <div className="space-y-5">
          <Card className="border-emerald-200 bg-emerald-50/40">
            <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {parsedRates.length} tarifas detectadas
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {concessionName ? `Concesión detectada: ${concessionName}` : 'Concesión no detectada automáticamente'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="w-fit border-emerald-300 bg-white text-emerald-800">
                Vigencia a aplicar: {formatBusinessDateLong(validFrom)}
              </Badge>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Vista previa de tarifas</CardTitle>
              <CardDescription>
                Confirma la concesión y revisa que los montos correspondan a la tabla oficial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Peaje</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Tarifa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRates
                    .filter((rate) => relevantCategories.includes(rate.vehicleCategory))
                    .map((rate, index) => (
                      <TableRow key={`${rate.stationName}-${rate.vehicleCategory}-${index}`}>
                        <TableCell>{rate.stationName}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={CATEGORY_COLORS[rate.vehicleCategory] ?? ''}
                          >
                            {rate.vehicleCategory}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatClp(rate.rateAmount)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Concesión a actualizar *</Label>
                  <Select value={selectedConcession} onValueChange={setSelectedConcession}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona concesión" />
                    </SelectTrigger>
                    <SelectContent>
                      {concessions.map((concession) => (
                        <SelectItem key={concession.id} value={concession.id}>
                          {concession.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pdf-valid-from">Vigente desde *</Label>
                  <Input
                    id="pdf-valid-from"
                    type="date"
                    value={validFrom}
                    onChange={(event) => setValidFrom(event.target.value)}
                  />
                </div>
              </div>

              <details className="rounded-xl border bg-muted/20 p-4">
                <summary className="cursor-pointer text-sm font-medium">Ver texto extraído del PDF</summary>
                <Textarea className="mt-3 min-h-48 font-mono text-xs" readOnly value={rawText} />
              </details>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setParsedRates(null);
                    setWarnings([]);
                    setRawText('');
                    setConcessionName(null);
                  }}
                >
                  Descartar
                </Button>
                <Button
                  onClick={handleApply}
                  disabled={!selectedConcession || applyRates.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="mr-2 size-4" />
                  {applyRates.isPending ? 'Aplicando...' : 'Aplicar tarifas'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

const TollManagement = () => {
  const { data: rates = [] } = useTollRatesCurrent();
  const { data: concessions = [] } = useTollConcessions();

  const stationCount = useMemo(() => new Set(rates.map((rate) => rate.stationId)).size, [rates]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Gestión de Peajes"
        description="Tarifas MOP Chile para la flota G5N. Administra vigencias, crea peajes manualmente y aplica reajustes semestrales desde PDF."
        badges={
          <>
            <Badge variant="outline" className="border-amber-300 bg-amber-100/70 text-amber-900">
              {concessions.length} concesiones
            </Badge>
            <Badge variant="outline">{stationCount} peajes activos</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1 bg-muted px-3 py-2 text-xs font-medium">
              <DollarSign className="size-3.5" />
              {rates.length} tarifas vigentes
            </Badge>
          </div>
        }
      />

      <Card className="border-amber-200/60 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.15),_transparent_30%),linear-gradient(135deg,rgba(255,251,235,0.9),rgba(255,255,255,1))]">
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-xl border bg-background/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sección 1
            </div>
            <div className="mt-2 text-sm font-semibold">Tarifas vigentes</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Visualiza por concesión y corrige una tarifa puntual sin perder historial.
            </p>
          </div>
          <div className="rounded-xl border bg-background/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sección 2
            </div>
            <div className="mt-2 text-sm font-semibold">Alta manual</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Agrega nuevos peajes y sus tres tarifas base cuando aún no exista seed o PDF listo.
            </p>
          </div>
          <div className="rounded-xl border bg-background/70 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Sección 3
            </div>
            <div className="mt-2 text-sm font-semibold">Reajuste por PDF MOP</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Sube el PDF oficial, confirma el preview y aplica vigencias nuevas en lote.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="rates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-1 gap-2 bg-transparent p-0 md:grid-cols-3">
          <TabsTrigger value="rates" className="border bg-card data-[state=active]:border-amber-300 data-[state=active]:bg-amber-50">
            Tarifas vigentes
          </TabsTrigger>
          <TabsTrigger value="manual" className="border bg-card data-[state=active]:border-emerald-300 data-[state=active]:bg-emerald-50">
            Alta manual
          </TabsTrigger>
          <TabsTrigger value="upload" className="border bg-card data-[state=active]:border-sky-300 data-[state=active]:bg-sky-50">
            Actualizar desde PDF MOP
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="mt-0">
          <TollRatesTable />
        </TabsContent>

        <TabsContent value="manual" className="mt-0">
          <ManualTollForm />
        </TabsContent>

        <TabsContent value="upload" className="mt-0">
          <TollPdfUploader />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TollManagement;
