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
      bg: 'bg-info/20',
      text: 'text-info-text',
      glow: 'shadow-glow-info'
    },
    valid: {
      bg: 'bg-success/20',
      text: 'text-success-text',
      glow: 'shadow-glow-success'
    },
    error: {
      bg: 'bg-danger/20',
      text: 'text-danger-text',
      glow: 'shadow-glow-danger'
    },
    warning: {
      bg: 'bg-warning/20',
      text: 'text-warning-text',
      glow: 'shadow-glow-warning'
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
