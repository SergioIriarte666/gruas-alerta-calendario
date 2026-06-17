import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useCommissionRepair');

export const useCommissionRepair = () => {
  const [auditing, setAuditing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [repairData, setRepairData] = useState<any>(null);

  const audit = async () => {
    try {
      setAuditing(true);
      const { data, error } = await supabase.rpc('audit_commission_system');
      if (error) throw error;
      setAuditData(data);
      toast.success('Auditoría completada');
    } catch (error: any) {
      logger.error('Error in audit:', error);
      toast.error(error.message || 'Error al ejecutar auditoría');
    } finally {
      setAuditing(false);
    }
  };

  const repair = async () => {
    try {
      setRepairing(true);
      const { data, error } = await supabase.rpc('repair_commission_system');
      if (error) throw error;
      const info = data as any;
      setRepairData(info);
      toast.success(
        `Sistema reparado: ${info.commissions_created} comisiones creadas, ${info.services_synced} servicios sincronizados`,
      );
      await audit();
    } catch (error: any) {
      logger.error('Error in repair:', error);
      toast.error(error.message || 'Error al reparar sistema');
    } finally {
      setRepairing(false);
    }
  };

  return { audit, repair, auditing, repairing, auditData, repairData };
};
