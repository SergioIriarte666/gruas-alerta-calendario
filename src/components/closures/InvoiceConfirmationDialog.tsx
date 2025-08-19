
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
      <AlertDialogContent 
        className="bg-black border-tms-green/30"
        style={{ background: '#000000', borderColor: 'rgba(156, 250, 36, 0.3)' }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white" style={{ color: '#ffffff' }}>
            Cierre Creado Exitosamente
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/90" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
            El cierre <span className="font-semibold text-tms-green" style={{ color: '#9cfa24' }}>{closure.folio}</span> ha sido creado correctamente.
            <br /><br />
            ¿Desea crear una factura para este cierre ahora?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel 
            className="border-tms-green/30 text-white hover:bg-tms-green/10"
            style={{ 
              color: '#ffffff',
              borderColor: 'rgba(156, 250, 36, 0.3)',
              backgroundColor: 'transparent'
            }}
          >
            No
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm}
            className="bg-tms-green hover:bg-tms-green/80 text-black"
            style={{ 
              backgroundColor: '#9cfa24',
              color: '#000000'
            }}
          >
            Sí, crear factura
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default InvoiceConfirmationDialog;
