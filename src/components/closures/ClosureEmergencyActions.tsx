
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Unlock, AlertTriangle } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClosureEmergencyActionsProps {
  closureId: string;
  closureFolio: string;
  onClosureFreed: () => void;
}

const ClosureEmergencyActions: React.FC<ClosureEmergencyActionsProps> = ({
  closureId,
  closureFolio,
  onClosureFreed
}) => {
  const { user } = useUser();
  const [confirmationText, setConfirmationText] = useState('');
  const [isFreeing, setIsFreeing] = useState(false);
  const expectedText = `LIBERAR ${closureFolio}`;

  // Only show for admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

  const handleFreeClosure = async () => {
    if (confirmationText !== expectedText) {
      toast.error('Confirmación incorrecta', {
        description: `Debes escribir exactamente: ${expectedText}`,
      });
      return;
    }

    setIsFreeing(true);
    
    try {
      console.log('Emergency closure liberation - Starting for closure:', closureId);

      // 1. Get services in this closure
      const { data: closureServices, error: servicesError } = await supabase
        .from('closure_services')
        .select('service_id')
        .eq('closure_id', closureId);

      if (servicesError) throw servicesError;

      const serviceIds = closureServices?.map(cs => cs.service_id) || [];

      // 2. Revert services status to 'completed'
      if (serviceIds.length > 0) {
        const { error: revertError } = await supabase
          .from('services')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .in('id', serviceIds);

        if (revertError) throw revertError;
        console.log('Emergency liberation - Reverted', serviceIds.length, 'services to completed');
      }

      // 3. Delete closure service relationships
      const { error: relationError } = await supabase
        .from('closure_services')
        .delete()
        .eq('closure_id', closureId);

      if (relationError) throw relationError;

      // 4. Delete the closure
      const { error: closureError } = await supabase
        .from('service_closures')
        .delete()
        .eq('id', closureId);

      if (closureError) throw closureError;

      console.log('Emergency liberation - Successfully freed closure:', closureFolio);
      
      toast.success('Cierre liberado completamente', {
        description: `El cierre ${closureFolio} ha sido eliminado y los ${serviceIds.length} servicios están disponibles para nuevo cierre.`,
      });

      onClosureFreed();
      setConfirmationText('');

    } catch (error: any) {
      console.error('Emergency liberation failed:', error);
      toast.error('Error en liberación de emergencia', {
        description: 'No se pudo completar la liberación. Revisa los logs para más detalles.',
      });
    } finally {
      setIsFreeing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-orange-400 hover:text-orange-300 hover:bg-orange-400/10 border border-orange-400/50"
          title="Liberar cierre (Solo Admin)"
        >
          <Unlock className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-gray-900 border-orange-500/50">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-orange-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            LIBERACIÓN DE EMERGENCIA
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300">
            <div className="space-y-3">
              <p className="font-medium text-orange-300">
                ATENCIÓN: Esta acción liberará completamente el cierre {closureFolio} y:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Eliminará el registro del cierre</li>
                <li>Liberará todos los servicios asociados</li>
                <li>Cambiará el estado de los servicios a 'completado'</li>
                <li>Los servicios quedarán disponibles para un nuevo cierre</li>
              </ul>
              <p className="text-xs text-gray-400 mt-3">
                Esta acción NO se puede deshacer. Úsala solo cuando un cierre esté bloqueado.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="my-4">
          <Label htmlFor="confirmation" className="text-gray-300">
            Para confirmar, escribe exactamente: <span className="font-mono font-bold text-orange-300">{expectedText}</span>
          </Label>
          <Input
            id="confirmation"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            className="mt-2 bg-gray-800 border-orange-500/50 text-white"
            placeholder={expectedText}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel className="border-gray-700 text-gray-300">
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleFreeClosure}
            disabled={confirmationText !== expectedText || isFreeing}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isFreeing ? 'Liberando...' : 'LIBERAR CIERRE'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ClosureEmergencyActions;
