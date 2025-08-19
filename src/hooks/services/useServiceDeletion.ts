import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const logger = createLogger('ServiceDeletion');

export const useServiceDeletion = () => {
  const deleteService = async (id: string): Promise<void> => {
    try {
      logger.info('Deleting service with cascade:', id);
      
      const { error } = await supabase.rpc('delete_service_cascade', {
        p_service_id: id
      });

      if (error) {
        logger.error('Error deleting service with cascade:', error);
        throw new Error(`Error al eliminar el servicio: ${error.message}`);
      }
      
      logger.info('Service deleted successfully with all related data:', id);
    } catch (error) {
      logger.error('Error in deleteService:', error);
      throw error;
    }
  };

  return { deleteService };
};