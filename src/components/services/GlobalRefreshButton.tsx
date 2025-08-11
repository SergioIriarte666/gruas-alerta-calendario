import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshAllServiceData } from '@/utils/globalDataRefresh';
import { toast } from 'sonner';

export const GlobalRefreshButton = () => {
  const queryClient = useQueryClient();

  const handleGlobalRefresh = async () => {
    try {
      toast.info("Actualizando datos...", {
        description: "Refrescando todos los datos del sistema",
      });
      
      await refreshAllServiceData(queryClient);
      
      toast.success("Datos actualizados", {
        description: "Todos los datos han sido actualizados exitosamente",
      });
    } catch (error) {
      console.error('Error en refresh global:', error);
      toast.error("Error", {
        description: "No se pudieron actualizar los datos",
      });
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleGlobalRefresh}
      className="gap-2"
    >
      <RefreshCw className="h-4 w-4" />
      Actualizar Todo
    </Button>
  );
};