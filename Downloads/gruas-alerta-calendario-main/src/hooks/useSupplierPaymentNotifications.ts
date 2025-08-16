import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNotifications } from '@/contexts/NotificationContext';
import { toast } from 'sonner';
import {
  SupplierPaymentNotification,
  PaymentAlert,
  PaymentAlertSettings,
  ScheduledPayment
} from '@/types/supplierPayments';
import { addDays, isAfter, isBefore, differenceInDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

export const useSupplierPaymentNotifications = () => {
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();

  // Obtener configuración de alertas
  const { data: alertSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['payment-alert-settings'],
    queryFn: async (): Promise<PaymentAlertSettings> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data, error } = await supabase
        .from('payment_alert_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || {
        user_id: user.id,
        payment_due_alerts_enabled: true,
        payment_overdue_alerts_enabled: true,
        due_soon_days: 3,
        critical_amount_threshold: 1000000,
        email_notifications: true,
        push_notifications: true,
        auto_schedule_reminders: true
      };
    }
  });

  // Generar alertas de pagos
  const generatePaymentAlerts = async (payments: ScheduledPayment[]): Promise<PaymentAlert[]> => {
    if (!alertSettings) return [];

    const alerts: PaymentAlert[] = [];
    const today = new Date();
    const dueSoonDate = addDays(today, alertSettings.due_soon_days);

    payments.forEach(payment => {
      const dueDate = new Date(payment.due_date);
      const amount = payment.amount;

      // Pagos vencidos
      if (isAfter(today, dueDate) && payment.status === 'pending') {
        const daysOverdue = differenceInDays(today, dueDate);
        alerts.push({
          id: `overdue-${payment.id}`,
          type: 'overdue',
          title: 'Pago Vencido',
          message: `Pago a ${payment.supplier_name} vencido hace ${daysOverdue} días`,
          priority: daysOverdue > 7 ? 'critical' : 'high',
          paymentId: payment.id,
          supplierId: payment.supplier_id,
          amount,
          dueDate,
          daysOverdue,
          actionRequired: true
        });
      }

      // Pagos que vencen hoy
      else if (format(dueDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd') && payment.status === 'pending') {
        alerts.push({
          id: `due-today-${payment.id}`,
          type: 'due_today',
          title: 'Pago Vence Hoy',
          message: `Pago a ${payment.supplier_name} vence hoy`,
          priority: amount >= alertSettings.critical_amount_threshold ? 'critical' : 'high',
          paymentId: payment.id,
          supplierId: payment.supplier_id,
          amount,
          dueDate,
          actionRequired: true
        });
      }

      // Pagos que vencen pronto
      else if (isBefore(dueDate, dueSoonDate) && isAfter(dueDate, today) && payment.status === 'pending') {
        const daysUntilDue = differenceInDays(dueDate, today);
        alerts.push({
          id: `due-soon-${payment.id}`,
          type: 'due_soon',
          title: 'Pago Próximo a Vencer',
          message: `Pago a ${payment.supplier_name} vence en ${daysUntilDue} días`,
          priority: amount >= alertSettings.critical_amount_threshold ? 'high' : 'medium',
          paymentId: payment.id,
          supplierId: payment.supplier_id,
          amount,
          dueDate,
          actionRequired: false
        });
      }

      // Pagos de alto monto
      if (amount >= alertSettings.critical_amount_threshold && payment.status === 'pending') {
        alerts.push({
          id: `high-amount-${payment.id}`,
          type: 'high_amount',
          title: 'Pago de Alto Monto',
          message: `Pago de alto monto programado para ${payment.supplier_name}`,
          priority: 'high',
          paymentId: payment.id,
          supplierId: payment.supplier_id,
          amount,
          dueDate,
          actionRequired: false
        });
      }
    });

    return alerts;
  };

  // Crear notificación de pago
  const createPaymentNotification = (alert: PaymentAlert): SupplierPaymentNotification => {
    const notificationTypes = {
      'due_today': 'payment_due' as const,
      'due_soon': 'payment_due' as const,
      'overdue': 'payment_overdue' as const,
      'high_amount': 'payment_scheduled' as const,
      'cash_flow_warning': 'payment_scheduled' as const
    };

    return {
      id: alert.id,
      title: alert.title,
      message: alert.message,
      type: notificationTypes[alert.type],
      priority: alert.priority,
      timestamp: new Date(),
      read: false,
      paymentId: alert.paymentId,
      supplierId: alert.supplierId,
      invoiceId: undefined,
      amount: alert.amount,
      dueDate: alert.dueDate,
      actionType: alert.actionRequired ? 'pay' : 'navigate',
      actionData: {
        paymentId: alert.paymentId,
        supplierId: alert.supplierId
      }
    };
  };

  // Procesar alertas y crear notificaciones
  const processPaymentAlerts = useMutation({
    mutationFn: async (payments: ScheduledPayment[]) => {
      const alerts = await generatePaymentAlerts(payments);
      
      // Crear notificaciones para alertas críticas y de alta prioridad
      alerts
        .filter(alert => alert.priority === 'critical' || alert.priority === 'high')
        .forEach(alert => {
          const notification = createPaymentNotification(alert);
          addNotification({
            title: notification.title,
            message: notification.message,
            type: notification.type === 'payment_overdue' ? 'error' : 'warning',
            actionType: notification.actionType,
            actionData: notification.actionData
          });
        });

      return alerts;
    },
    onSuccess: (alerts) => {
      const criticalCount = alerts.filter(a => a.priority === 'critical').length;
      const highCount = alerts.filter(a => a.priority === 'high').length;
      
      if (criticalCount > 0) {
        toast.error(`${criticalCount} alertas críticas de pagos`);
      } else if (highCount > 0) {
        toast.warning(`${highCount} alertas importantes de pagos`);
      }
    },
    onError: (error) => {
      console.error('Error procesando alertas de pagos:', error);
      toast.error('Error al procesar alertas de pagos');
    }
  });

  // Actualizar configuración de alertas
  const updateAlertSettings = useMutation({
    mutationFn: async (settings: Partial<PaymentAlertSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data, error } = await supabase
        .from('payment_alert_settings')
        .upsert({
          ...settings,
          user_id: user.id,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-alert-settings'] });
      toast.success('Configuración de alertas actualizada');
    },
    onError: (error) => {
      console.error('Error actualizando configuración:', error);
      toast.error('Error al actualizar configuración de alertas');
    }
  });

  return {
    alertSettings,
    settingsLoading,
    generatePaymentAlerts,
    processPaymentAlerts,
    updateAlertSettings,
    createPaymentNotification
  };
};