
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  title?: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
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

    // Auto remove after duration
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, newToast.duration || 4000);
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
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
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
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-green-500';
      case 'error':
        return 'border-red-500';
      case 'warning':
        return 'border-yellow-500';
      case 'info':
        return 'border-blue-500';
    }
  };

  return (
    <div className={cn(
      "bg-white dark:bg-gray-800 border-l-4 rounded-lg shadow-lg p-4 min-w-[300px] animate-in slide-in-from-right-full",
      getBorderColor()
    )}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {getIcon()}
          <div className="flex-1">
            {toast.title && (
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                {toast.title}
              </h4>
            )}
            {toast.description && (
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                {toast.description}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Helper functions for easy usage
export const toast = {
  success: (title: string, description?: string) => {
    const context = React.useContext(ToastContext);
    if (context) {
      context.toast({ type: 'success', title, description });
    }
  },
  error: (title: string, description?: string) => {
    const context = React.useContext(ToastContext);
    if (context) {
      context.toast({ type: 'error', title, description });
    }
  },
  info: (title: string, description?: string) => {
    const context = React.useContext(ToastContext);
    if (context) {
      context.toast({ type: 'info', title, description });
    }
  },
  warning: (title: string, description?: string) => {
    const context = React.useContext(ToastContext);
    if (context) {
      context.toast({ type: 'warning', title, description });
    }
  }
};
