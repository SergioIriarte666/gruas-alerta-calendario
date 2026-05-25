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
        className="sm:max-w-md border-2 border-cyan-500/50 bg-gray-950/95 backdrop-blur-sm shadow-[0_0_30px_rgba(0,255,255,0.2)]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Scanline effect overlay */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] pointer-events-none rounded-lg" />
        
        {/* Header with retro icon */}
        <div className="relative flex flex-col items-center space-y-4 pt-4">
          {/* Animated icon container */}
          <div className={cn(
            "relative p-4 rounded-lg border-2",
            isLowTime 
              ? "border-red-500/70 bg-red-950/30 shadow-[0_0_20px_rgba(255,0,0,0.4)]" 
              : "border-yellow-500/70 bg-yellow-950/30 shadow-[0_0_20px_rgba(255,200,0,0.3)]"
          )}>
            <Timer className={cn(
              "size-10",
              isLowTime 
                ? "text-red-400 animate-pulse" 
                : "text-yellow-400"
            )} />
            
            {/* Pixel corners */}
            <div className="absolute -top-1 -left-1 size-2 bg-cyan-400" />
            <div className="absolute -top-1 -right-1 size-2 bg-cyan-400" />
            <div className="absolute -bottom-1 -left-1 size-2 bg-cyan-400" />
            <div className="absolute -bottom-1 -right-1 size-2 bg-cyan-400" />
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h2 className="text-xl font-mono font-bold tracking-wider text-cyan-400 animate-pulse">
              ⚠ SESIÓN EXPIRANDO ⚠
            </h2>
            <p className="text-sm font-mono text-gray-400">
              Tu sesión se cerrará por inactividad
            </p>
          </div>
        </div>

        {/* Countdown display */}
        <div className="relative my-6">
          {/* Large digital countdown */}
          <div className={cn(
            "text-center py-4 px-6 rounded-lg border-2 bg-gray-900/80",
            isLowTime 
              ? "border-red-500/50 shadow-[inset_0_0_20px_rgba(255,0,0,0.2)]" 
              : "border-cyan-500/50 shadow-[inset_0_0_20px_rgba(0,255,255,0.1)]"
          )}>
            <span className={cn(
              "text-5xl font-mono font-bold tabular-nums tracking-widest",
              isLowTime 
                ? "text-red-400 animate-pulse" 
                : "text-white"
            )}>
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mb-6">
          <RetroProgressBar 
            value={progressPercent} 
            showLabel={false}
            hasError={isLowTime}
          />
        </div>

        {/* Action buttons with glow effects */}
        <div className="relative flex gap-4">
          {/* Extend session button - Green glow */}
          <Button
            onClick={handleExtend}
            className={cn(
              "flex-1 h-12 font-mono font-bold tracking-wide text-sm",
              "bg-gradient-to-b from-green-600 to-green-700",
              "border-2 border-green-400/50",
              "hover:from-green-500 hover:to-green-600",
              "shadow-[0_0_15px_rgba(0,255,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]",
              "hover:shadow-[0_0_25px_rgba(0,255,0,0.5),inset_0_1px_0_rgba(255,255,255,0.3)]",
              "transition-all duration-200",
              "text-white"
            )}
          >
            <RefreshCw className="mr-2 size-4" />
            CONTINUAR
          </Button>

          {/* Logout button - Red glow */}
          <Button
            onClick={handleLogout}
            variant="outline"
            className={cn(
              "flex-1 h-12 font-mono font-bold tracking-wide text-sm",
              "bg-gradient-to-b from-red-900/50 to-red-950/50",
              "border-2 border-red-500/50",
              "hover:from-red-800/60 hover:to-red-900/60",
              "shadow-[0_0_15px_rgba(255,0,0,0.2)]",
              "hover:shadow-[0_0_25px_rgba(255,0,0,0.4)]",
              "transition-all duration-200",
              "text-red-400 hover:text-red-300"
            )}
          >
            <LogOut className="mr-2 size-4" />
            SALIR
          </Button>
        </div>

        {/* Bottom decoration */}
        <div className="flex justify-center gap-1 mt-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div 
              key={i}
              className={cn(
                "size-2 rounded-sm",
                i < Math.ceil((progressPercent / 100) * 7)
                  ? isLowTime ? "bg-red-500" : "bg-cyan-500"
                  : "bg-gray-700"
              )}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
