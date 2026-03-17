import { toast } from 'sonner';

/**
 * Unified sync toast - shows a single consolidated toast
 * listing all cross-module actions that were executed.
 */

export interface SyncAction {
  module: 'costo' | 'pago' | 'inventario' | 'pieza' | 'proveedor';
  action: string;
  success: boolean;
}

const moduleIcons: Record<string, string> = {
  costo: '💰',
  pago: '💳',
  inventario: '📦',
  pieza: '🔧',
  proveedor: '🏢',
};

export const showSyncToast = (
  title: string,
  actions: SyncAction[]
) => {
  const successActions = actions.filter(a => a.success);
  const failedActions = actions.filter(a => !a.success);

  const lines = successActions
    .map(a => `${moduleIcons[a.module] || '✓'} ${a.action}`)
    .join('\n');

  const failedLines = failedActions
    .map(a => `✗ ${a.action}`)
    .join('\n');

  if (failedActions.length > 0) {
    toast.warning(title, {
      description: `${lines}${failedLines ? '\n' + failedLines : ''}`,
      duration: 5000,
    });
  } else if (successActions.length > 1) {
    toast.success(title, {
      description: lines,
      duration: 4000,
    });
  } else {
    toast.success(title);
  }
};
