import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useSyncMissingCommissions } from '@/hooks/commissions/useSyncMissingCommissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const SyncMissingCommissionsButton = () => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { mutate: syncCommissions, isPending } = useSyncMissingCommissions();

  const handleSync = () => {
    syncCommissions();
    setShowConfirmDialog(false);
  };

  return (
    <>
      <Button
        onClick={() => setShowConfirmDialog(true)}
        variant="outline"
        className="gap-2"
        disabled={isPending}
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Sincronizando...' : 'Sincronizar Comisiones'}
      </Button>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Sincronizar Comisiones Faltantes
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>
                Esta función detectará y creará automáticamente las comisiones faltantes 
                para servicios completados que tienen múltiples operadores.
              </p>
              <div className="bg-muted/50 p-3 rounded-lg space-y-2 text-sm">
                <p className="font-medium text-foreground">¿Qué hace esta función?</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Revisa servicios completados con operadores múltiples</li>
                  <li>Identifica comisiones faltantes en la tabla de costos</li>
                  <li>Crea automáticamente las comisiones que faltan</li>
                  <li>Evita duplicados verificando registros existentes</li>
                </ul>
              </div>
              <p className="text-sm text-muted-foreground">
                <strong>Nota:</strong> Solo se crearán comisiones que realmente falten. 
                No se modificarán ni duplicarán comisiones existentes.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSync}
              disabled={isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {isPending ? 'Sincronizando...' : 'Sincronizar Ahora'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
