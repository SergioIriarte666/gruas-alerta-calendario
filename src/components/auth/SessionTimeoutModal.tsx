import { useEffect, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RetroProgressBar } from '@/components/ui/retro-progress-bar';
import { Timer, LogOut, RefreshCw } from 'lucide-react';
import { playRetroSuccessSound, playRetroErrorSound } from '@/lib/sounds';
import { cn } from '@/lib/utils';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  remainingTime: number;
  totalTime: number;
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionTimeoutModal = ({
  isOpen,
  remainingTime,
  totalTime,
  onExtend,
  onLogout
}: SessionTimeoutModalProps) => {
  const progressPercent = useMemo(() => {
    return Math.max(0, Math.min(100, (remainingTime / totalTime) * 100));
  }, [remainingTime, totalTime]);

  const formattedTime = useMemo(() => {
    const minutes = Math.floor(remainingTime / 60000);
    const seconds = Math.floor((remainingTime % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [remainingTime]);

  const isLowTime = progressPercent <= 25;

  // Sonido de advertencia cuando abre el modal
  useEffect(() => {
    if (isOpen) {
      playRetroErrorSound();
    }
  }, [isOpen]);

  // Sonido de advertencia cuando queda poco tiempo
  useEffect(() => {
    if (isOpen && remainingTime <= 30000 && remainingTime > 29000) {
      playRetroErrorSound();
    }
  }, [isOpen, remainingTime]);

  const handleExtend = () => {
    playRetroSuccessSound();
    onExtend();
  };

  const handleLogout = () => {
    playRetroErrorSound();
    onLogout();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="app-overlay-surface overflow-hidden rounded-2xl border-border/80 bg-card p-0 shadow-2xl sm:max-w-md [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className={cn('h-1 w-full', isLowTime ? 'bg-destructive' : 'bg-amber-500')} />

        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-3.5">
            <div className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-xl border',
              isLowTime
                ? 'border-destructive/20 bg-destructive/10 text-destructive'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
            )}>
              <Timer className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Tu sesión está por vencer</h2>
              <p className="mt-1 text-sm text-muted-foreground">Se cerrará automáticamente por inactividad.</p>
            </div>
          </div>

          <div className="my-7 rounded-xl border border-border/70 bg-muted/45 px-5 py-5 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Tiempo restante</p>
            <span className={cn(
              'mt-1 block text-5xl font-semibold tabular-nums tracking-tight',
              isLowTime ? 'text-destructive' : 'text-foreground'
            )}>
              {formattedTime}
            </span>
          </div>

          <RetroProgressBar value={progressPercent} showLabel={false} hasError={isLowTime} />

          <div className="mt-7 grid grid-cols-2 gap-3">
            <Button onClick={handleExtend} className="h-11 font-semibold">
              <RefreshCw className="mr-2 size-4" />
              Continuar sesión
            </Button>
            <Button onClick={handleLogout} variant="outline" className="h-11 font-medium text-destructive hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="mr-2 size-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
