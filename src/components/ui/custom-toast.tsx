
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
        return <CheckCircle className="w-5 h-5 text-tms-green" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return 'border-l-tms-green';
      case 'error':
        return 'border-l-red-400';
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
        return 'bg-red-500/10 border-red-500/30';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30';
    }
  };

  return (
    <div 
      className={cn(
        "border-l-4 rounded-lg shadow-lg p-4 min-w-[300px] animate-in slide-in-from-right-full border",
        getBorderColor(),
        getBackgroundColor()
      )}
      style={{
        background: '#000000',
        borderColor: toast.type === 'success' ? '#9cfa24' : 
                   toast.type === 'error' ? '#ef4444' : 
                   toast.type === 'warning' ? '#f59e0b' : '#3b82f6'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {getIcon()}
          <div className="flex-1">
            {toast.title && (
              <h4 className="font-semibold text-white text-sm" style={{ color: '#ffffff !important' }}>
                {toast.title}
              </h4>
            )}
            {toast.description && (
              <p className="text-white/90 text-sm mt-1" style={{ color: 'rgba(255, 255, 255, 0.9) !important' }}>
                {toast.description}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-white/70 hover:text-white ml-2 transition-colors"
          style={{ color: 'rgba(255, 255, 255, 0.7)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
