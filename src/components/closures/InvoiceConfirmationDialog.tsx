
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
      <AlertDialogContent className="bg-gray-900 border-gray-700">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            Cierre Creado Exitosamente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300">
            El cierre <span className="font-semibold text-tms-green">{closure.folio}</span> ha sido creado correctamente.
            <br /><br />
            ¿Desea crear una factura para este cierre ahora?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-800">
            No
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-tms-green hover:bg-tms-green/90 text-white"
          >
            Sí, crear factura
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default InvoiceConfirmationDialog;
