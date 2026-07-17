
import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ServiceClosure } from '@/types';

interface InvoiceConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  closure: ServiceClosure | null;
  onConfirm: () => void;
}

const InvoiceConfirmationDialog: React.FC<InvoiceConfirmationDialogProps> = ({
  open,
  onOpenChange,
  closure,
  onConfirm
}) => {
  if (!closure) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="finance-dialog bg-card border">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">
            Cierre Creado Exitosamente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            El cierre <span className="font-semibold text-primary">{closure.folio}</span> ha sido creado correctamente.
            <br /><br />
            ¿Desea crear una factura para este cierre ahora?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            No
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            Sí, crear factura
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default InvoiceConfirmationDialog;
