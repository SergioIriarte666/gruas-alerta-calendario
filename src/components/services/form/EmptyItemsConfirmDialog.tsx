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

interface EmptyItemsConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemCount: number;
  isSubmitting?: boolean;
  onConfirm: () => void;
}

export const EmptyItemsConfirmDialog = ({
  open,
  onOpenChange,
  itemCount,
  isSubmitting = false,
  onConfirm,
}: EmptyItemsConfirmDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar todos los ítems del desglose?</AlertDialogTitle>
          <AlertDialogDescription>
            Este servicio tiene {itemCount} ítem{itemCount === 1 ? '' : 's'} registrado{itemCount === 1 ? '' : 's'} en
            el desglose. Al guardar quedará sin ítems. Esta acción no se puede deshacer desde aquí.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? 'Eliminando...' : 'Sí, eliminar los ítems'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
