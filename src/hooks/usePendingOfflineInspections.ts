import { useEffect, useState } from 'react';
import { createLogger } from '@/lib/logger';
import { listPendingInspections, OFFLINE_INSPECTIONS_EVENT } from '@/utils/operatorOffline';

const logger = createLogger('usePendingOfflineInspections');

export const usePendingOfflineInspections = () => {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const pending = await listPendingInspections();
        setPendingCount(pending.length);
      } catch (error) {
        logger.warn('Could not load pending offline inspections', error);
      }
    };

    load();
    window.addEventListener('online', load);
    window.addEventListener('focus', load);
    window.addEventListener(OFFLINE_INSPECTIONS_EVENT, load);

    return () => {
      window.removeEventListener('online', load);
      window.removeEventListener('focus', load);
      window.removeEventListener(OFFLINE_INSPECTIONS_EVENT, load);
    };
  }, []);

  return { pendingCount };
};
