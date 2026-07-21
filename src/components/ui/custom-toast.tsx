
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  priority?: 'low' | 'normal' | 'high';
  technicalDetails?: string;
}

interface ToastContextType {
  toasts: Toast[];
  toast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((newToast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString();
    const toastWithId = { ...newToast, id };
    
    setToasts(prev => [...prev, toastWithId]);

    // Smart duration based on priority and type
    const getSmartDuration = (toast: Toast) => {
      if (toast.duration) return toast.duration;
      
      if (toast.priority === 'low') return 1500;
      if (toast.technicalDetails) return 12000;
      if (toast.priority === 'high') return 4000;
      
      switch (toast.type) {
        case 'success': return 2000;
        case 'error': return 3500;
        case 'warning': return 3000;
        case 'info': return 2500;
        default: return 2500;
      }
    };

    // Auto remove after smart duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, getSmartDuration(toastWithId));
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: Toast[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-2 sm:right-4 z-[99999] space-y-2 w-[calc(100vw-1rem)] sm:max-w-sm sm:w-auto">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

const ToastComponent: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="size-5 text-success" />;
      case 'error':
        return <AlertCircle className="size-5 text-danger" />;
      case 'warning':
        return <AlertCircle className="size-5 text-warning" />;
      case 'info':
        return <Info className="size-5 text-info" />;
    }
  };

  const getToneClasses = () => {
    switch (toast.type) {
      case 'success':
        return 'border-success/30 border-l-success bg-success-soft text-success-text';
      case 'error':
        return 'border-danger/30 border-l-danger bg-danger-soft text-danger-text';
      case 'warning':
        return 'border-warning/30 border-l-warning bg-warning-soft text-warning-text';
      case 'info':
        return 'border-info/30 border-l-info bg-info-soft text-info-text';
    }
  };

  return (
    <div 
      className={cn(
        "w-[calc(100vw-2rem)] max-w-[22.5rem] animate-in rounded-lg border border-l-4 p-4 shadow-lg transition-all duration-300 fade-in slide-in-from-right-full sm:min-w-[18.75rem]",
        getToneClasses()
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-x-3">
          {getIcon()}
          <div className="flex-1">
            {toast.title && (
              <h4 className="text-sm font-semibold text-current">
                {toast.title}
              </h4>
            )}
            {toast.description && (
              <p className="mt-1 text-sm text-current opacity-80">
                {toast.description}
              </p>
            )}
            {toast.technicalDetails && (
              <details className="mt-2 text-xs text-current">
                <summary className="cursor-pointer font-medium underline decoration-current underline-offset-2">
                  Ver detalle
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-current/30 bg-background/30 p-2 font-mono text-xs leading-4 text-current">
                  {toast.technicalDetails}
                </pre>
              </details>
            )}
          </div>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="ml-2 text-current opacity-70 transition-opacity hover:opacity-100"
          aria-label="Cerrar notificación"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
};
