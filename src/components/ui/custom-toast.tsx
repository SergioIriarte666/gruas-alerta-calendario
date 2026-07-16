
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
        return <CheckCircle className="size-5 text-tms-green" />;
      case 'error':
        return <AlertCircle className="size-5 text-white" />;
      case 'warning':
        return <AlertCircle className="size-5 text-yellow-400" />;
      case 'info':
        return <Info className="size-5 text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-l-tms-green';
      case 'error':
        return 'border-red-950/70';
      case 'warning':
        return 'border-l-yellow-400';
      case 'info':
        return 'border-l-blue-400';
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-tms-green/10 border-tms-green/30';
      case 'error':
        return 'text-white';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <div 
      className={cn(
        "border-l-4 rounded-lg shadow-lg p-4 w-[calc(100vw-2rem)] max-w-[360px] sm:min-w-[300px] animate-in slide-in-from-right-full fade-in border transition-all duration-300",
        getBorderColor(),
        getBackgroundColor()
      )}
      style={toast.type === 'error' ? {
        background: 'color-mix(in srgb, hsl(var(--destructive)) 70%, black)',
        borderColor: 'color-mix(in srgb, hsl(var(--destructive)) 45%, black)',
      } : {
        background: 'hsl(var(--card))',
        borderColor: toast.type === 'success' ? 'hsl(var(--success))' :
          toast.type === 'warning' ? 'hsl(var(--warning))' : 'hsl(var(--primary))',
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-x-3">
          {getIcon()}
          <div className="flex-1">
            {toast.title && (
              <h4 className={cn("font-semibold text-sm", toast.type === 'error' ? 'text-white' : 'text-card-foreground')}>
                {toast.title}
              </h4>
            )}
            {toast.description && (
              <p className={cn("text-sm mt-1", toast.type === 'error' ? 'text-white/95' : 'text-muted-foreground')}>
                {toast.description}
              </p>
            )}
            {toast.technicalDetails && (
              <details className="mt-2 text-xs text-white">
                <summary className="cursor-pointer font-medium underline decoration-white/60 underline-offset-2">
                  Ver detalle
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded border border-white/30 bg-black/20 p-2 font-mono text-[11px] leading-4 text-white">
                  {toast.technicalDetails}
                </pre>
              </details>
            )}
          </div>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className={cn(
            "ml-2 transition-colors",
            toast.type === 'error' ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label="Cerrar notificación"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
};
