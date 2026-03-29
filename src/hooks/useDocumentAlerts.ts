import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DocumentAlert {
  id: string;
  craneId: string;
  documentType: 'technical_review' | 'insurance' | 'circulation_permit';
  alertDays: number;
  emailNotifications: boolean;
  pushNotifications: boolean;
  isActive: boolean;
}

export interface ExpiryAlert {
  craneId: string;
  craneLicensePlate: string;
  documentType: string;
  expiryDate: string;
  daysUntilExpiry: number;
}

const DOCUMENT_ALERTS_SELECT = `
  id,
  crane_id,
  document_type,
  alert_days,
  email_notifications,
  push_notifications,
  is_active
`;

export const useDocumentAlerts = (craneId?: string) => {
  return useQuery({
    queryKey: ['document-alerts', craneId],
    queryFn: async (): Promise<DocumentAlert[]> => {
      let query = supabase.from('document_alerts').select(DOCUMENT_ALERTS_SELECT);
      
      if (craneId) {
        query = query.eq('crane_id', craneId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching document alerts:', error);
        throw error;
      }

      return (data || []).map(alert => ({
        id: alert.id,
        craneId: alert.crane_id,
        documentType: alert.document_type as DocumentAlert['documentType'],
        alertDays: alert.alert_days,
        emailNotifications: alert.email_notifications,
        pushNotifications: alert.push_notifications,
        isActive: alert.is_active
      }));
    }
  });
};

export const useExpiryAlerts = () => {
  return useQuery({
    queryKey: ['expiry-alerts'],
    queryFn: async (): Promise<ExpiryAlert[]> => {
      const { data, error } = await supabase.rpc('get_document_expiry_alerts');

      if (error) {
        console.error('Error fetching expiry alerts:', error);
        throw error;
      }

      return (data || []).map(alert => ({
        craneId: alert.crane_id,
        craneLicensePlate: alert.crane_license_plate,
        documentType: alert.document_type,
        expiryDate: alert.expiry_date,
        daysUntilExpiry: alert.days_until_expiry
      }));
    }
  });
};

export const useCreateDocumentAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alert: Omit<DocumentAlert, 'id'>) => {
      const { data, error } = await supabase
        .from('document_alerts')
        .insert({
          crane_id: alert.craneId,
          document_type: alert.documentType,
          alert_days: alert.alertDays,
          email_notifications: alert.emailNotifications,
          push_notifications: alert.pushNotifications,
          is_active: alert.isActive
        })
        .select(DOCUMENT_ALERTS_SELECT)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
      toast.success('Alerta de documento configurada exitosamente');
    },
    onError: (error) => {
      console.error('Error creating document alert:', error);
      toast.error('Error al configurar la alerta de documento');
    }
  });
};

export const useUpdateDocumentAlert = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DocumentAlert> }) => {
      const { data, error } = await supabase
        .from('document_alerts')
        .update({
          alert_days: updates.alertDays,
          email_notifications: updates.emailNotifications,
          push_notifications: updates.pushNotifications,
          is_active: updates.isActive
        })
        .eq('id', id)
        .select(DOCUMENT_ALERTS_SELECT)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-alerts'] });
      toast.success('Alerta de documento actualizada exitosamente');
    },
    onError: (error) => {
      console.error('Error updating document alert:', error);
      toast.error('Error al actualizar la alerta de documento');
    }
  });
};
