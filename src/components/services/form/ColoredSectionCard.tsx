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
    border: 'border-l-blue-500',
    bg: 'bg-blue-500/5',
    iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    title: 'text-blue-700 dark:text-blue-300',
  },
  green: {
    border: 'border-l-green-500',
    bg: 'bg-green-500/5',
    iconBg: 'bg-green-500/10 text-green-600 dark:text-green-400',
    title: 'text-green-700 dark:text-green-300',
  },
  purple: {
    border: 'border-l-purple-500',
    bg: 'bg-purple-500/5',
    iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    title: 'text-purple-700 dark:text-purple-300',
  },
  orange: {
    border: 'border-l-orange-500',
    bg: 'bg-orange-500/5',
    iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    title: 'text-orange-700 dark:text-orange-300',
  },
  cyan: {
    border: 'border-l-cyan-500',
    bg: 'bg-cyan-500/5',
    iconBg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    title: 'text-cyan-700 dark:text-cyan-300',
  },
  pink: {
    border: 'border-l-pink-500',
    bg: 'bg-pink-500/5',
    iconBg: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
    title: 'text-pink-700 dark:text-pink-300',
  },
  amber: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    title: 'text-amber-700 dark:text-amber-300',
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
