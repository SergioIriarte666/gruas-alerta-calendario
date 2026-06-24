import { useState } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { RetroProgressBar } from './retro-progress-bar';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playRetroSuccessSound, playRetroErrorSound } from '@/lib/sounds';

export interface BatchProgressState {
  isOpen: boolean;
  current: number;
  total: number;
  operationName: string;
  currentItemName?: string;
  isComplete?: boolean;
  hasError?: boolean;
  errorMessage?: string;
}

interface BatchProgressModalProps {
  state: BatchProgressState;
  onClose?: () => void;
}

export const BatchProgressModal = ({ state, onClose }: BatchProgressModalProps) => {
  const { isOpen, current, total, operationName, currentItemName, isComplete, hasError, errorMessage } = state;
  const percentage = total > 0 ? (current / total) * 100 : 0;

  const getBorderColor = () => {
    if (hasError) return 'border-red-500/50 shadow-[0_0_30px_rgba(255,0,0,0.2)]';
    if (isComplete) return 'border-green-500/50 shadow-[0_0_30px_rgba(0,255,0,0.2)]';
    return 'border-cyan-500/50 shadow-[0_0_30px_rgba(0,255,255,0.2)]';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (isComplete || hasError) && onClose?.()}>
      <DialogContent 
        className={cn(
          "sm:max-w-md bg-gray-950 border-2 [&>button]:hidden",
          getBorderColor()
        )}
      >
        <div className="py-6 px-2">
          {/* Header */}
          <div className="text-center mb-6">
            <h3 className={cn(
              "text-lg font-mono font-bold tracking-wide",
              hasError ? 'text-red-400' : 'text-cyan-400'
            )}>
              {operationName}
            </h3>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <RetroProgressBar value={percentage} hasError={hasError} />
          </div>

          {/* Counter */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              {hasError ? (
                <XCircle className="size-5 text-red-500" />
              ) : isComplete ? (
                <CheckCircle2 className="size-5 text-green-500" />
              ) : (
                <Loader2 className="size-5 text-cyan-400 animate-spin" />
              )}
              <span className={cn(
                'font-mono text-sm',
                hasError ? 'text-red-400' : isComplete ? 'text-green-400' : 'text-gray-300'
              )}>
                {hasError 
                  ? `Error en ${current} de ${total}`
                  : isComplete 
                    ? `¡${total} ${total === 1 ? 'elemento procesado' : 'elementos procesados'}!`
                    : `${current} de ${total} ${total === 1 ? 'elemento' : 'elementos'}`
                }
              </span>
            </div>
            
            {/* Current item being processed */}
            {currentItemName && !isComplete && !hasError && (
              <p className="text-xs text-gray-500 font-mono truncate max-w-[280px] mx-auto">
                {currentItemName}
              </p>
            )}

            {/* Error message */}
            {hasError && errorMessage && (
              <p className="mx-auto max-w-[360px] break-words rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-left font-mono text-xs leading-relaxed text-red-300">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Completion/Error message */}
          {(isComplete || hasError) && (
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
      hasError: false,
      errorMessage: undefined,
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
    playRetroSuccessSound();
    setState(prev => ({
      ...prev,
      current: prev.total,
      isComplete: true,
      hasError: false,
      currentItemName: undefined,
    }));
  };

  const error = (message?: string) => {
    playRetroErrorSound();
    setState(prev => ({
      ...prev,
      hasError: true,
      isComplete: false,
      errorMessage: message,
      currentItemName: undefined,
    }));
  };

  const close = () => {
    setState(prev => ({
      ...prev,
      isOpen: false,
    }));
  };

  return { state, start, update, complete, error, close };
};
