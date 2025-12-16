import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { RetroProgressBar } from './retro-progress-bar';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BatchProgressState {
  isOpen: boolean;
  current: number;
  total: number;
  operationName: string;
  currentItemName?: string;
  isComplete?: boolean;
}

interface BatchProgressModalProps {
  state: BatchProgressState;
  onClose?: () => void;
}

export const BatchProgressModal = ({ state, onClose }: BatchProgressModalProps) => {
  const { isOpen, current, total, operationName, currentItemName, isComplete } = state;
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && isComplete && onClose?.()}>
      <DialogContent 
        className="sm:max-w-md bg-gray-950 border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(0,255,255,0.2)] [&>button]:hidden"
      >
        <div className="py-6 px-2">
          {/* Header */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-mono font-bold text-cyan-400 tracking-wide">
              {operationName}
            </h3>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <RetroProgressBar value={percentage} />
          </div>

          {/* Counter */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : (
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              )}
              <span className={cn(
                'font-mono text-sm',
                isComplete ? 'text-green-400' : 'text-gray-300'
              )}>
                {isComplete 
                  ? `¡${total} ${total === 1 ? 'elemento procesado' : 'elementos procesados'}!`
                  : `${current} de ${total} ${total === 1 ? 'elemento' : 'elementos'}`
                }
              </span>
            </div>
            
            {/* Current item being processed */}
            {currentItemName && !isComplete && (
              <p className="text-xs text-gray-500 font-mono truncate max-w-[280px] mx-auto">
                {currentItemName}
              </p>
            )}
          </div>

          {/* Completion message */}
          {isComplete && (
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400">
                Haz clic fuera para cerrar
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Hook helper for managing batch progress state
export const useBatchProgress = () => {
  const [state, setState] = useState<BatchProgressState>({
    isOpen: false,
    current: 0,
    total: 0,
    operationName: '',
  });

  const start = (operationName: string, total: number) => {
    setState({
      isOpen: true,
      current: 0,
      total,
      operationName,
      isComplete: false,
    });
  };

  const update = (current: number, currentItemName?: string) => {
    setState(prev => ({
      ...prev,
      current,
      currentItemName,
    }));
  };

  const complete = () => {
    setState(prev => ({
      ...prev,
      current: prev.total,
      isComplete: true,
      currentItemName: undefined,
    }));
  };

  const close = () => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  };

  return { state, start, update, complete, close };
};

import { useState } from 'react';
