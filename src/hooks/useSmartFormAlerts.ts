import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/custom-toast';

interface SmartAlertOptions {
  formId: string;
  title?: string;
  message?: string;
  duration?: number;
  showDismissOption?: boolean;
}

export const useSmartFormAlerts = () => {
  const { toast } = useToast();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set(JSON.parse(localStorage.getItem('dismissed_form_alerts') || '[]'))
  );

  const showFormAlert = useCallback((options: SmartAlertOptions) => {
    const {
      formId,
      title = 'Formulario Guardado',
      message = 'Los datos se han guardado automáticamente',
      duration = 2000,
      showDismissOption = true
    } = options;

    // No mostrar si el usuario ya la deshabilitó para este formulario
    if (dismissedAlerts.has(formId)) return;

    toast({
      title,
      description: showDismissOption 
        ? `${message}. Click aquí para no mostrar más.` 
        : message,
      type: 'success',
      duration,
      priority: 'low'
    });
  }, [toast, dismissedAlerts]);

  const dismissAlert = useCallback((formId: string) => {
    const newDismissed = new Set(dismissedAlerts);
    newDismissed.add(formId);
    setDismissedAlerts(newDismissed);
    localStorage.setItem('dismissed_form_alerts', JSON.stringify(Array.from(newDismissed)));
  }, [dismissedAlerts]);

  const resetAlert = useCallback((formId: string) => {
    const newDismissed = new Set(dismissedAlerts);
    newDismissed.delete(formId);
    setDismissedAlerts(newDismissed);
    localStorage.setItem('dismissed_form_alerts', JSON.stringify(Array.from(newDismissed)));
  }, [dismissedAlerts]);

  return {
    showFormAlert,
    dismissAlert,
    resetAlert,
    isAlertDismissed: (formId: string) => dismissedAlerts.has(formId)
  };
};