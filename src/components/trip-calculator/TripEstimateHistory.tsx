import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Eye, History } from 'lucide-react';
import { useTripEstimates, useDeleteTripEstimate } from '@/hooks/useTripEstimates';
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

export const TripEstimateHistory = () => {
  const { data: estimates = [], isLoading } = useTripEstimates();
  const { mutate: deleteEstimate } = useDeleteTripEstimate();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (estimates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <History className="size-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Sin estimaciones guardadas</p>
          <p className="text-sm">Las estimaciones calculadas aparecerán aquí cuando las guardes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {estimates.map((est) => (
        <Card key={est.id} className="hover:shadow-md transition-shadow">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-foreground">
                  {est.route_name || `${est.origin} → ${est.destination}`}
                </p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {est.crane_type && <Badge variant="outline">{est.crane_type}</Badge>}
                  {est.distance_km && (
                    <Badge variant="secondary">{est.distance_km} km</Badge>
                  )}
                  <Badge variant="secondary">
                    {new Date(est.created_at).toLocaleDateString('es-CL')}
                  </Badge>
                </div>
                <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                  <span>Combustible: {formatCurrency(est.fuel_cost || 0)}</span>
                  <span>Peajes: {formatCurrency(est.toll_cost || 0)}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <p className="text-lg font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(est.total_estimate || 0)}
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive">
                      <Trash2 className="size-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar estimación?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() =>
                          deleteEstimate(est.id, {
                            onSuccess: () => toast.success('Estimación eliminada'),
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
