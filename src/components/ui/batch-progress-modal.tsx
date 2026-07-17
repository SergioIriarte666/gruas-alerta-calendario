import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RetroProgressBar } from './retro-progress-bar';
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react';
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
  const percentage = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const statusLabel = hasError ? 'Proceso interrumpido' : isComplete ? 'Proceso completado' : 'Procesando registros';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (isComplete || hasError) && onClose?.()}>
      <DialogContent className="app-overlay-surface overflow-hidden rounded-2xl border-border/80 bg-card p-0 shadow-2xl sm:max-w-[440px] [&>button]:hidden">
        <div className={cn('h-1 w-full', hasError ? 'bg-destructive' : isComplete ? 'bg-emerald-500' : 'bg-primary')} />

        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-3.5">
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl border',
                hasError
                  ? 'border-destructive/20 bg-destructive/10 text-destructive'
                  : isComplete
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-primary/20 bg-primary/10 text-primary'
              )}
            >
              {hasError ? (
                <XCircle className="size-5" />
              ) : isComplete ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <LoaderCircle className="size-5 animate-spin" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{statusLabel}</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{operationName}</h3>
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-2.5 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {hasError
                    ? `Error en ${current} de ${total}`
                    : isComplete
                      ? `${total} ${total === 1 ? 'elemento procesado' : 'elementos procesados'}`
                      : `${current} de ${total} ${total === 1 ? 'elemento' : 'elementos'}`}
                </p>
                {!hasError && !isComplete && (
                  <p className="mt-0.5 text-xs text-muted-foreground">Puedes mantener esta ventana abierta</p>
                )}
              </div>
              <span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">
                {Math.round(percentage)}%
              </span>
            </div>

            <RetroProgressBar value={percentage} hasError={hasError} showLabel={false} />
          </div>

          {currentItemName && !isComplete && !hasError && (
            <div className="mt-5 rounded-xl border border-border/70 bg-muted/55 px-3.5 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Elemento actual</p>
              <p className="mt-1 truncate text-sm font-medium text-foreground">{currentItemName}</p>
            </div>
          )}

          {hasError && errorMessage && (
            <p className="mt-5 break-words rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-sm leading-relaxed text-destructive">
              {errorMessage}
            </p>
          )}

          {(isComplete || hasError) && (
            <p className="mt-5 text-center text-xs text-muted-foreground">Haz clic fuera para cerrar</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

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
    setState(prev => ({ ...prev, current, currentItemName }));
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
    setState(prev => ({ ...prev, isOpen: false }));
  };

  return { state, start, update, complete, error, close };
};
