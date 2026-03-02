import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, Fuel } from 'lucide-react';
import {
  useCurrentFuelPrices,
  useFuelPriceHistory,
  useDeleteFuelPrice,
  getFuelTypeLabel,
  FUEL_TYPES,
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

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);

const fuelTypeColors: Record<string, string> = {
  diesel: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  gasolina_93: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  gasolina_95: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export const FuelPricesManager = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<FuelPrice | null>(null);
  const [filterType, setFilterType] = useState('all');
  const { data: currentPrices = [], isLoading: loadingCurrent } = useCurrentFuelPrices();
  const { data: history = [], isLoading: loadingHistory } = useFuelPriceHistory(filterType);
  const { mutate: deletePrice } = useDeleteFuelPrice();

  const handleEdit = (price: FuelPrice) => {
    setEditingPrice(price);
    setIsFormOpen(true);
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setEditingPrice(null);
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
          <p className="text-sm text-muted-foreground">Registro semanal de precios (actualización cada jueves)</p>
        </div>
        <Button
          onClick={() => setIsFormOpen(true)}
          className="bg-tms-green hover:bg-tms-green/90 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Precio
        </Button>
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
                    <Fuel className="h-4 w-4" />
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
                      Desde {new Date(price.price_date + 'T00:00:00').toLocaleDateString('es-CL')}
                      {price.source && ` • ${price.source}`}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-3">Sin precio registrado</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar por:</span>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {FUEL_TYPES.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* History table */}
      <Card>
        <CardContent className="pt-4">
          {loadingHistory ? (
            <Skeleton className="h-48 w-full" />
          ) : history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sin registros históricos</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">Tipo</th>
                    <th className="pb-2 font-medium text-right">Precio/L</th>
                    <th className="pb-2 font-medium">Región</th>
                    <th className="pb-2 font-medium">Fuente</th>
                    <th className="pb-2 font-medium">Estado</th>
                    <th className="pb-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((fp) => (
                    <tr key={fp.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="py-2.5">
                        {new Date(fp.price_date + 'T00:00:00').toLocaleDateString('es-CL')}
                      </td>
                      <td>
                        <Badge variant="outline" className={fuelTypeColors[fp.fuel_type] || ''}>
                          {getFuelTypeLabel(fp.fuel_type)}
                        </Badge>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(fp.price_per_liter)}</td>
                      <td>{fp.region || '-'}</td>
                      <td className="text-muted-foreground">{fp.source || '-'}</td>
                      <td>
                        {fp.is_current ? (
                          <Badge className="bg-green-600 text-white text-xs">Vigente</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Histórico</Badge>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(fp)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
