import { cn } from '@/lib/utils';

interface RetroProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
  hasError?: boolean;
}

/**
 * Barra de progreso compartida. El nombre del componente se conserva para no
 * romper sus consumidores históricos, pero la presentación ya utiliza el
 * sistema visual actual.
 */
export const RetroProgressBar = ({
  value,
  className,
  showLabel = true,
  hasError = false,
}: RetroProgressBarProps) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  const roundedValue = Math.round(clampedValue);

  return (
    <div className={cn('w-full space-y-2', className)}>
      {showLabel && (
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className={cn('font-medium', hasError ? 'text-destructive' : 'text-muted-foreground')}>
            {hasError ? 'Requiere atención' : 'Procesando'}
          </span>
          <span className="font-semibold tabular-nums text-foreground">{roundedValue}%</span>
        </div>
      )}

      <div
        className="h-2.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={roundedValue}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out',
            hasError
              ? 'bg-destructive'
              : 'bg-primary shadow-glow-primary'
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
};
