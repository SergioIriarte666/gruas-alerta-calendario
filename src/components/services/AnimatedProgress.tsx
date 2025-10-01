import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
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
    if (displayValue < 25) return 'bg-blue-500';
    if (displayValue < 50) return 'bg-cyan-500';
    if (displayValue < 75) return 'bg-tms-green';
    if (displayValue < 100) return 'bg-green-500';
    return 'bg-primary';
  };

  const getGlowClass = () => {
    if (displayValue < 25) return 'shadow-[0_0_20px_rgba(59,130,246,0.5)]';
    if (displayValue < 50) return 'shadow-[0_0_20px_rgba(6,182,212,0.5)]';
    if (displayValue < 75) return 'shadow-[0_0_20px_rgba(156,250,36,0.5)]';
    return 'shadow-[0_0_20px_rgba(34,197,94,0.5)]';
  };

  return (
    <div className="relative">
      <Progress 
        value={displayValue} 
        className={cn(
          "h-3 transition-all duration-300 overflow-visible",
          className
        )}
      />
      <div 
        className={cn(
          "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
          getColorClass(),
          showPulse && "animate-progress-flow",
          isAtMilestone && "animate-scale-pulse",
          isAtMilestone && getGlowClass()
        )}
        style={{ 
          width: `${displayValue}%`,
          background: displayValue >= 25 
            ? `linear-gradient(90deg, 
                hsl(84, 100%, 58%) 0%, 
                hsl(84, 100%, 65%) 50%, 
                hsl(84, 100%, 58%) 100%)`
            : undefined,
          backgroundSize: '200% 100%',
        }}
      >
        {/* Shimmer effect */}
        {showPulse && (
          <div 
            className="absolute inset-0 animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              backgroundSize: '200% 100%'
            }}
          />
        )}
      </div>
    </div>
  );
};
