
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InvoiceEmergencyActionsProps {
  invoiceId: string;
  invoiceFolio: string;
  onInvoiceDeleted: () => void;
}

const InvoiceEmergencyActions: React.FC<InvoiceEmergencyActionsProps> = ({
  invoiceId,
  invoiceFolio,
  onInvoiceDeleted
}) => {
  const { user } = useUser();
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const expectedText = `ELIMINAR ${invoiceFolio}`;

  // Only show for admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

  const handleDeleteInvoice = async () => {
    if (confirmationText !== expectedText) {
      toast.error('Confirmación incorrecta', {
        description: `Debes escribir exactamente: ${expectedText}`,
      });
      return;
    }

    setIsDeleting(true);
    
    try {
      console.log('Emergency deletion - Starting for invoice:', invoiceId);

      // 1. Get invoice closure relationships
      const { data: invoiceClosures, error: closureError } = await supabase
        .from('invoice_closures')
        .select('closure_id')
        .eq('invoice_id', invoiceId);

      if (closureError) throw closureError;

      // 2. Get services from closures to revert their status
      const closureIds = invoiceClosures?.map(ic => ic.closure_id) || [];
      
      if (closureIds.length > 0) {
        const { data: closureServices, error: servicesError } = await supabase
          .from('closure_services')
          .select('service_id')
          .in('closure_id', closureIds);

        if (servicesError) throw servicesError;

        const serviceIds = closureServices?.map(cs => cs.service_id) || [];

        // 3. Revert services status from 'invoiced' to 'completed' and clear invoice data
        if (serviceIds.length > 0) {
          const { error: revertError } = await supabase
            .from('services')
            .update({ 
              status: 'completed', 
              invoice_folio: null,
              invoice_numero_fiscal: null,
              updated_at: new Date().toISOString() 
            })
            .in('id', serviceIds)
            .eq('status', 'invoiced');

          if (revertError) throw revertError;
          console.log('Emergency deletion - Reverted', serviceIds.length, 'services to completed (cleared invoice data)');
        }

        // 4. Revert closure status from 'invoiced' to 'closed'
        const { error: closureRevertError } = await supabase
          .from('service_closures')
          .update({ status: 'closed', updated_at: new Date().toISOString() })
          .in('id', closureIds)
          .eq('status', 'invoiced');

        if (closureRevertError) throw closureRevertError;
        console.log('Emergency deletion - Reverted', closureIds.length, 'closures to closed');
      }

      // 4b. Also revert services linked directly via invoice_services
      const { data: directServices } = await supabase
        .from('invoice_services')
        .select('service_id')
        .eq('invoice_id', invoiceId);

      if (directServices && directServices.length > 0) {
        const directServiceIds = directServices.map(ds => ds.service_id);
        await supabase
          .from('services')
          .update({ 
            status: 'completed', 
            invoice_folio: null,
            invoice_numero_fiscal: null,
            updated_at: new Date().toISOString() 
          })
          .in('id', directServiceIds)
          .eq('status', 'invoiced');

        await supabase
          .from('invoice_services')
          .delete()
          .eq('invoice_id', invoiceId);
        
        console.log('Emergency deletion - Reverted', directServiceIds.length, 'direct services');
      }

      // 5. Delete invoice closure relationships
      const { error: relationError } = await supabase
        .from('invoice_closures')
        .delete()
        .eq('invoice_id', invoiceId);

      if (relationError) throw relationError;

      // 6. Delete the invoice
      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      console.log('Emergency deletion - Successfully deleted invoice:', invoiceFolio);
      
      toast.success('Factura eliminada completamente', {
        description: `La factura ${invoiceFolio} y todas sus relaciones han sido eliminadas. Los servicios están disponibles para nuevo cierre.`,
      });

      onInvoiceDeleted();
      setConfirmationText('');

    } catch (error: any) {
      console.error('Emergency deletion failed:', error);
      toast.error('Error en eliminación de emergencia', {
        description: 'No se pudo completar la eliminación. Revisa los logs para más detalles.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/50"
          title="Eliminar factura completa (Solo Admin)"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-gray-900 border-red-500/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            ELIMINACIÓN DE EMERGENCIA
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300">
            <div className="space-y-3">
              <p className="font-medium text-red-300">
                ATENCIÓN: Esta acción eliminará completamente la factura {invoiceFolio} y:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Eliminará el registro de la factura</li>
                <li>Revertirá el estado de los servicios de 'facturado' a 'completado'</li>
                <li>Revertirá el estado de los cierres de 'facturado' a 'cerrado'</li>
                <li>Los servicios quedarán disponibles para nuevo cierre</li>
              </ul>
              <p className="text-xs text-gray-400 mt-3">
                Esta acción NO se puede deshacer. Úsala solo en emergencias.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="my-4">
          <Label htmlFor="confirmation" className="text-gray-300">
            Para confirmar, escribe exactamente: <span className="font-mono font-bold text-red-300">{expectedText}</span>
          </Label>
          <Input
            id="confirmation"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className="mt-2 bg-gray-800 border-red-500/50 text-white"
            placeholder={expectedText}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="border-gray-700 text-gray-300">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteInvoice}
            disabled={confirmationText !== expectedText || isDeleting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isDeleting ? 'Eliminando...' : 'ELIMINAR FACTURA'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default InvoiceEmergencyActions;
