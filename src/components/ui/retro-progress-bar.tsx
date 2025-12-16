import { cn } from '@/lib/utils';

interface RetroProgressBarProps {
  value: number;
  className?: string;
  showLabel?: boolean;
  hasError?: boolean;
}

export const RetroProgressBar = ({ value, className, showLabel = true, hasError = false }: RetroProgressBarProps) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  
  // Calculate color based on progress (red → orange → yellow → green) or error state
  const getGradientColor = () => {
    if (hasError) {
      return 'from-red-700 via-red-600 to-red-500';
    }
    if (clampedValue <= 25) {
      return 'from-red-600 via-red-500 to-red-400';
    } else if (clampedValue <= 50) {
      return 'from-red-500 via-orange-500 to-orange-400';
    } else if (clampedValue <= 75) {
      return 'from-orange-500 via-yellow-500 to-yellow-400';
    } else {
      return 'from-yellow-500 via-lime-500 to-green-500';
    }
  };

  const getBorderColor = () => {
    if (hasError) return 'border-red-500/70 shadow-[0_0_15px_rgba(255,0,0,0.3)]';
    return 'border-cyan-500/70 shadow-[0_0_15px_rgba(0,255,255,0.3)]';
  };

  const getLabelColor = () => {
    if (hasError) return 'text-red-400';
    return 'text-cyan-400';
  };

  // Generate segments for retro effect
  const totalSegments = 20;
  const filledSegments = Math.floor((clampedValue / 100) * totalSegments);

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="text-center mb-2">
          <span className={cn(
            'text-xs font-mono tracking-widest animate-pulse',
            getLabelColor()
          )}>
            {hasError ? 'ERROR' : 'PROCESANDO...'}
          </span>
        </div>
      )}
      
      {/* Outer container with retro border */}
      <div className={cn(
        "relative p-1 bg-gray-950 rounded-sm border-2",
        getBorderColor()
      )}>
        {/* Inner track */}
        <div className="relative h-6 bg-gray-900 rounded-sm overflow-hidden border border-gray-700">
          {/* Segments container */}
          <div className="absolute inset-0 flex gap-0.5 p-0.5">
            {Array.from({ length: totalSegments }).map((_, index) => (
              <div
                key={index}
                className={cn(
                  'flex-1 rounded-sm transition-all duration-150',
                  index < filledSegments
                    ? cn(
                        'bg-gradient-to-b',
                        getGradientColor(),
                        'shadow-[inset_0_-2px_4px_rgba(0,0,0,0.3)]'
                      )
                    : 'bg-gray-800/50'
                )}
              />
            ))}
          </div>
          
          {/* Shimmer effect - only when not error */}
          {!hasError && clampedValue > 0 && clampedValue < 100 && (
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]"
              style={{ 
                width: `${clampedValue}%`,
                animation: 'shimmer 1.5s infinite'
              }}
            />
          )}
          
          {/* Scanline effect */}
          <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)] pointer-events-none" />
        </div>
      </div>
      
      {/* Percentage display */}
      <div className="text-center mt-2">
        <span className={cn(
          "text-lg font-mono font-bold tabular-nums",
          hasError ? 'text-red-400' : 'text-white'
        )}>
          {Math.round(clampedValue)}%
        </span>
      </div>
    </div>
  );
};
