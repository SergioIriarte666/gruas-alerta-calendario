import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
  listPendingInspections,
  removePendingInspection,
  updatePendingInspection,
} from '@/utils/operatorOffline';
import { submitInspectionPipeline } from '@/utils/inspectionSubmission';
import { operatorServiceKeys, operatorServicesKeys } from '@/hooks/operatorServicesQueryKeys';
import { useQueryClient } from '@tanstack/react-query';

const logger = createLogger('useOperatorOfflineSync');

export const useOperatorOfflineSync = () => {
  const queryClient = useQueryClient();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const flushPendingInspections = async () => {
      if (!navigator.onLine || isSyncingRef.current) return;

      isSyncingRef.current = true;

      try {
        const pending = await listPendingInspections();
        if (pending.length === 0) return;

        toast.info(`Sincronizando ${pending.length} inspección(es) pendiente(s)...`);

        for (const item of pending) {
          try {
            await updatePendingInspection(item.id, {
              status: 'syncing',
              retryCount: item.retryCount + 1,
              lastError: null,
            });

            await submitInspectionPipeline({
              service: item.serviceSnapshot,
              serviceId: item.serviceId,
              values: item.values,
              phase: item.phase,
            });

            await removePendingInspection(item.id);
            if (item.phase === 'final') {
              item.values.photographicSet?.forEach((photo) => {
                localStorage.removeItem(`photo-${photo.fileName}`);
              });
              localStorage.removeItem(`inspection_${item.serviceId}`);
              localStorage.removeItem(`inspection_metadata_${item.serviceId}`);
            }
          } catch (error) {
            logger.error('Error syncing pending inspection', { id: item.id, error });
            await updatePendingInspection(item.id, {
              status: 'failed',
              lastError: error instanceof Error ? error.message : String(error),
            });
          }
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: operatorServicesKeys.all }),
          queryClient.invalidateQueries({ queryKey: operatorServiceKeys.all }),
        ]);

        toast.success('Sincronización de terreno completada');
      } finally {
        isSyncingRef.current = false;
      }
    };

    flushPendingInspections().catch((error) => {
      logger.error('Initial offline sync failed', error);
    });

    const handleOnline = () => {
      flushPendingInspections().catch((error) => {
        logger.error('Online offline-sync failed', error);
      });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);
};
