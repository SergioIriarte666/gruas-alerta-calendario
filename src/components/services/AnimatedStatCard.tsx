import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedStatCardProps {
  label: string;
  value: number;
  variant: 'total' | 'valid' | 'error' | 'warning';
  isAnimating?: boolean;
}

export const AnimatedStatCard: React.FC<AnimatedStatCardProps> = ({
  label,
  value,
  variant,
  isAnimating = false
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const increment = value / (duration / 16);

    const animate = () => {
      start += increment;
      if (start < value) {
        setDisplayValue(Math.floor(start));
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animate();
  }, [value]);

  const variantStyles = {
    total: {
      bg: 'bg-blue-500/20',
      text: 'text-blue-600',
      glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]'
    },
    valid: {
      bg: 'bg-green-500/20',
      text: 'text-green-600',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]'
    },
    error: {
      bg: 'bg-red-500/20',
      text: 'text-red-600',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]'
    },
    warning: {
      bg: 'bg-yellow-500/20',
      text: 'text-yellow-600',
      glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]'
    }
  };

  const style = variantStyles[variant];

  return (
    <div 
      className={cn(
        "p-4 rounded-lg transition-all duration-500 border border-border/50",
        style.bg,
        isAnimating && "animate-scale-pulse",
        isAnimating && style.glow
      )}
    >
      <p className={cn("text-sm font-medium mb-1", style.text)}>
        {label}
      </p>
      <p className={cn(
        "text-2xl font-bold text-foreground transition-all duration-300",
        isAnimating && "animate-bounce-in"
      )}>
        {displayValue}
      </p>
    </div>
  );
};
