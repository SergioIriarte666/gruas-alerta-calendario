import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedProgressProps {
  value: number;
  className?: string;
  showPulse?: boolean;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  value,
  className,
  showPulse = true
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAtMilestone, setIsAtMilestone] = useState(false);

  useEffect(() => {
    // Smooth animation to target value
    const interval = setInterval(() => {
      setDisplayValue(prev => {
        if (prev < value) {
          return Math.min(prev + 1, value);
        }
        return prev;
      });
    }, 20);

    return () => clearInterval(interval);
  }, [value]);

  useEffect(() => {
    // Check for milestones
    const milestones = [25, 50, 75, 100];
    if (milestones.includes(Math.floor(displayValue))) {
      setIsAtMilestone(true);
      const timeout = setTimeout(() => setIsAtMilestone(false), 600);
      return () => clearTimeout(timeout);
    }
  }, [displayValue]);

  const getColorClass = () => {
    if (displayValue < 25) return 'bg-info';
    if (displayValue < 50) return 'bg-info';
    if (displayValue < 75) return 'bg-primary';
    if (displayValue < 100) return 'bg-success';
    return 'bg-primary';
  };

  const getGlowClass = () => {
    if (displayValue < 50) return 'shadow-glow-info';
    if (displayValue < 75) return 'shadow-glow-primary';
    return 'shadow-glow-success';
  };

  const boundedDisplayValue = Math.min(100, Math.max(0, displayValue));

  return (
    <div
      className={cn(
        "relative h-3 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      role="progressbar"
      aria-label="Progreso de carga"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(boundedDisplayValue)}
    >
      <div 
        className={cn(
          "absolute inset-y-0 left-0 max-w-full overflow-hidden rounded-full transition-[width] duration-500",
          getColorClass(),
          showPulse && "animate-progress-flow",
          isAtMilestone && "animate-scale-pulse",
          isAtMilestone && getGlowClass()
        )}
        style={{
          width: `${boundedDisplayValue}%`,
        }}
      >
        {/* Shimmer effect */}
        {showPulse && (
          <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-effect-highlight/30 to-transparent [background-size:200%_100%]" />
        )}
      </div>
    </div>
  );
};
