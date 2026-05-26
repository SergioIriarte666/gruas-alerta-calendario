import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type SectionColor = 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink' | 'amber';

interface ColoredSectionCardProps {
  title: string;
  icon: React.ReactNode;
  color: SectionColor;
  children: React.ReactNode;
  className?: string;
  hasError?: boolean;
  required?: boolean;
}

const colorConfig: Record<SectionColor, { border: string; bg: string; iconBg: string; title: string }> = {
  blue: {
    border: 'border-l-info',
    bg: 'bg-info/5',
    iconBg: 'bg-info/10 text-info',
    title: 'text-foreground',
  },
  green: {
    border: 'border-l-success',
    bg: 'bg-success/5',
    iconBg: 'bg-success/10 text-success',
    title: 'text-foreground',
  },
  purple: {
    border: 'border-l-primary',
    bg: 'bg-primary/5',
    iconBg: 'bg-primary/10 text-primary',
    title: 'text-foreground',
  },
  orange: {
    border: 'border-l-warning',
    bg: 'bg-warning/5',
    iconBg: 'bg-warning/10 text-warning',
    title: 'text-foreground',
  },
  cyan: {
    border: 'border-l-info',
    bg: 'bg-info/5',
    iconBg: 'bg-info/10 text-info',
    title: 'text-foreground',
  },
  pink: {
    border: 'border-l-danger',
    bg: 'bg-danger/5',
    iconBg: 'bg-danger/10 text-danger',
    title: 'text-foreground',
  },
  amber: {
    border: 'border-l-warning',
    bg: 'bg-warning/5',
    iconBg: 'bg-warning/10 text-warning',
    title: 'text-foreground',
  },
};

export const ColoredSectionCard = ({
  title,
  icon,
  color,
  children,
  className,
  hasError,
  required,
}: ColoredSectionCardProps) => {
  const config = colorConfig[color];

  return (
    <Card
      className={cn(
        "border-l-4 transition-all duration-200 animate-fade-in",
        config.border,
        config.bg,
        hasError && "border-l-destructive bg-destructive/5",
        className
      )}
    >
      <CardHeader className="pb-3 px-3 sm:px-6">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
          <div className={cn(
            "p-1.5 sm:p-2 rounded-lg flex-shrink-0",
            hasError ? "bg-destructive/10 text-destructive" : config.iconBg
          )}>
            {icon}
          </div>
          <span className={cn(
            "font-semibold",
            hasError ? "text-destructive" : config.title
          )}>
            {title}
          </span>
          {required && (
            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded flex-shrink-0">
              Requerido
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">{children}</CardContent>
    </Card>
  );
};
