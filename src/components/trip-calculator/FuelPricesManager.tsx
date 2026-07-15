import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toLocalDateString } from '@/utils/timezoneUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Fuel, Pencil, Trash2, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import {
  useCurrentFuelPrices,
  useFuelPriceHistory,
  useDeleteFuelPrice,
  FUEL_TYPES,
  REFERENCE_FUEL_STATION,
  REFERENCE_FUEL_STATION_LABEL,
  REFERENCE_FUEL_SOURCE,
  useSyncReferenceFuelPrices,
  type FuelPrice,
} from '@/hooks/useFuelPrices';
import { FuelPriceForm } from './FuelPriceForm';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

/** Get Monday of the week for a given date string (YYYY-MM-DD) */
const getWeekMonday = (dateStr: string): string => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return toLocalDateString(monday);
};

/** Format week label like "Sem 24-Feb" */
const formatWeekLabel = (mondayStr: string): string => {
  const d = new Date(`${mondayStr}T12:00:00Z`);
  const day = d.getDate();
  const month = d.toLocaleDateString('es-CL', { month: 'short' });
  return `Sem ${day}-${month.charAt(0).toUpperCase() + month.slice(1)}`;
};

const NUM_WEEKS = 10;

interface WeeklyPivot {
  weeks: string[]; // monday date strings, newest first
  matrix: Record<string, Record<string, FuelPrice | undefined>>; // fuel_type -> week -> price
}

function buildWeeklyPivot(history: FuelPrice[]): WeeklyPivot {
  // Collect all weeks
  const weekSet = new Set<string>();
  const byTypeAndWeek: Record<string, Record<string, FuelPrice>> = {};

  for (const fp of history) {
    const week = getWeekMonday(fp.price_date);
    weekSet.add(week);
    if (!byTypeAndWeek[fp.fuel_type]) byTypeAndWeek[fp.fuel_type] = {};
    // Keep the most recent entry per type+week
    const existing = byTypeAndWeek[fp.fuel_type][week];
    if (!existing || fp.price_date > existing.price_date) {
      byTypeAndWeek[fp.fuel_type][week] = fp;
    }
  }

  const weeks = Array.from(weekSet).sort((a, b) => b.localeCompare(a)).slice(0, NUM_WEEKS);

  const matrix: Record<string, Record<string, FuelPrice | undefined>> = {};
  for (const { value } of FUEL_TYPES) {
    matrix[value] = {};
    for (const w of weeks) {
      matrix[value][w] = byTypeAndWeek[value]?.[w];
    }
  }

  return { weeks, matrix };
}

export const FuelPricesManager = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<FuelPrice | null>(null);
  const hasAutoSyncedRef = useRef(false);
  const { user, loading: authLoading } = useAuth();
  const { user: profileUser, loading: profileLoading } = useUser();
  const { data: currentPrices = [], isLoading: loadingCurrent } = useCurrentFuelPrices();
  const { data: history = [], isLoading: loadingHistory } = useFuelPriceHistory();
  const { mutate: deletePrice } = useDeleteFuelPrice();
  const { mutate: syncReferencePrices, isPending: isSyncing } = useSyncReferenceFuelPrices();

  const pivot = useMemo(() => buildWeeklyPivot(history), [history]);
  const canSyncReferencePrices = profileUser?.role === 'admin';

  useEffect(() => {
    if (
      hasAutoSyncedRef.current ||
      loadingCurrent ||
      authLoading ||
      profileLoading ||
      !user ||
      !canSyncReferencePrices
    ) {
      return;
    }

    hasAutoSyncedRef.current = true;
    syncReferencePrices(undefined, {
      onError: (error) => {
        console.error('No se pudo sincronizar precios de combustible automáticamente', error);
      },
    });
  }, [authLoading, canSyncReferencePrices, loadingCurrent, profileLoading, syncReferencePrices, user]);

  const handleEdit = (price: FuelPrice) => {
    setEditingPrice(price);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingPrice(null);
  };

  const handleManualSync = () => {
    syncReferencePrices(undefined, {
      onSuccess: (result) => {
        if (result.synced > 0) {
          toast.success(`Se actualizaron ${result.synced} precios desde ${result.stationLabel}`);
          return;
        }

        toast.success(`Los precios de ${result.stationLabel} ya estaban al día`);
      },
      onError: (error) =>
        toast.error(error instanceof Error ? error.message : 'No se pudo actualizar desde la estación de referencia'),
    });
  };

  if (loadingCurrent) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Precios de Combustible</h2>
          <p className="text-sm text-muted-foreground">
            Referencia automática: {REFERENCE_FUEL_STATION_LABEL}, {REFERENCE_FUEL_STATION.address}, {REFERENCE_FUEL_STATION.region}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleManualSync}
            disabled={isSyncing || profileLoading || !canSyncReferencePrices}
            title={!canSyncReferencePrices ? 'Solo administradores pueden actualizar desde COPEC' : undefined}
          >
            <RefreshCw className={`size-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Actualizar desde COPEC
          </Button>
          <Button
            onClick={() => setIsFormOpen(true)}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="size-4 mr-2" />
            Nuevo Precio
          </Button>
        </div>
      </div>

      {/* Current prices cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FUEL_TYPES.map(({ value, label }) => {
          const price = currentPrices.find((p) => p.fuel_type === value);
          return (
            <Card key={value} className={price ? 'border-green-500/50' : 'border-dashed border-muted-foreground/30'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Fuel className="size-4" />
                    {label}
                  </span>
                  {price && <Badge className="bg-green-600 text-white text-xs">Vigente</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {price ? (
                  <>
                    <p className="text-3xl font-bold text-foreground">
                      {formatCurrency(price.price_per_liter)}
                      <span className="text-sm font-normal text-muted-foreground">/litro</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Desde {new Date(`${price.price_date}T12:00:00Z`).toLocaleDateString('es-CL')}
                      {price.source && ` • ${price.source}`}
                    </p>
                    {price.source === REFERENCE_FUEL_SOURCE && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Estación: {REFERENCE_FUEL_STATION.address}, {REFERENCE_FUEL_STATION.comuna}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-3">Sin precio registrado</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!profileLoading && !canSyncReferencePrices && (
        <p className="text-sm text-muted-foreground">
          La sincronización automática desde COPEC está disponible solo para administradores.
        </p>
      )}

      {/* Weekly pivot table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Historial Semanal de Precios</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <Skeleton className="h-48 w-full" />
          ) : pivot.weeks.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sin registros históricos</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10 min-w-[130px]">
                      Tipo Combustible
                    </TableHead>
                    {pivot.weeks.map((week, idx) => (
                      <TableHead
                        key={week}
                        className={`text-center min-w-[110px] ${idx === 0 ? 'bg-primary/5 font-semibold' : ''}`}
                      >
                        {formatWeekLabel(week)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FUEL_TYPES.map(({ value, label }) => (
                    <TableRow key={value}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        <span className="flex items-center gap-2">
                          <Fuel className="size-3.5 text-muted-foreground" />
                          {label}
                        </span>
                      </TableCell>
                      {pivot.weeks.map((week, weekIdx) => {
                        const fp = pivot.matrix[value]?.[week];
                        const prevWeek = pivot.weeks[weekIdx + 1];
                        const prevFp = prevWeek ? pivot.matrix[value]?.[prevWeek] : undefined;
                        const variation = fp && prevFp
                          ? ((fp.price_per_liter - prevFp.price_per_liter) / prevFp.price_per_liter) * 100
                          : null;

                        return (
                          <TableCell
                            key={week}
                            className={`text-center ${weekIdx === 0 ? 'bg-primary/5' : ''}`}
                          >
                            {fp ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="w-full text-center hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
                                    <span className="font-medium text-sm">
                                      {formatCurrency(fp.price_per_liter)}
                                    </span>
                                    {variation !== null && variation !== 0 && (
                                      <span className={`flex items-center justify-center gap-0.5 text-xs mt-0.5 ${
                                        variation > 0 ? 'text-destructive' : 'text-green-600'
                                      }`}>
                                        {variation > 0 ? (
                                          <TrendingUp className="size-3" />
                                        ) : (
                                          <TrendingDown className="size-3" />
                                        )}
                                        {Math.abs(variation).toFixed(1)}%
                                      </span>
                                    )}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" align="center">
                                  <div className="space-y-1 text-xs">
                                    <p className="text-muted-foreground">
                                      {new Date(`${fp.price_date}T12:00:00Z`).toLocaleDateString('es-CL')}
                                    </p>
                                    {fp.region && <p>Región: {fp.region}</p>}
                                    {fp.source && <p>Fuente: {fp.source}</p>}
                                    <div className="flex gap-1 pt-1 border-t">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs flex-1"
                                        onClick={() => handleEdit(fp)}
                                      >
                                        <Pencil className="size-3 mr-1" />
                                        Editar
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs text-destructive flex-1"
                                          >
                                            <Trash2 className="size-3 mr-1" />
                                            Eliminar
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>¿Eliminar precio?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Se eliminará este registro de precio de combustible.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() =>
                                                deletePrice(fp.id, {
                                                  onSuccess: () => toast.success('Precio eliminado'),
                                                })
                                              }
                                            >
                                              Eliminar
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FuelPriceForm
        open={isFormOpen}
        onClose={handleClose}
        editingPrice={editingPrice}
      />
    </div>
  );
};
