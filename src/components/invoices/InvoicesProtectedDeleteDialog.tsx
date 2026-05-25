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
import { Input } from '@/components/ui/input';
import { ShieldAlert } from 'lucide-react';

export interface InvoicesProtectedDeleteDialogState {
  isOpen: boolean;
  password: string;
  isVerifying: boolean;
  error: string;
  pendingFolio: string;
  pendingBatchDeleteIds: string[];
}

interface InvoicesProtectedDeleteDialogProps {
  state: InvoicesProtectedDeleteDialogState;
  onOpenChange: (open: boolean) => void;
  onPasswordChange: (password: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const InvoicesProtectedDeleteDialog = ({
  state,
  onOpenChange,
  onPasswordChange,
  onConfirm,
  onCancel,
}: InvoicesProtectedDeleteDialogProps) => {
  return (
    <AlertDialog open={state.isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" />
            Eliminar factura protegida
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              {state.pendingBatchDeleteIds.length > 0
                ? `Está a punto de eliminar ${state.pendingBatchDeleteIds.length} factura(s) de la aplicación. Esto revertirá los cierres y servicios asociados.`
                : `Está a punto de eliminar la factura ${state.pendingFolio}. Esto revertirá los cierres y servicios asociados.`
              }
            </p>
            <p className="font-medium text-destructive">
              Esta acción NO se puede deshacer.
            </p>
            <div className="pt-2">
              <label htmlFor="protected-invoice-password" className="text-sm text-muted-foreground">Ingrese su contraseña para confirmar:</label>
              <Input
                id="protected-invoice-password"
                value={state.password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Contraseña"
                type="password"
                className="mt-1"
                autoFocus
              />
              {state.error && <p className="text-xs text-destructive mt-1">{state.error}</p>}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={state.isVerifying || !state.password.trim()}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {state.isVerifying ? 'Verificando…' : 'Eliminar definitivamente'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
