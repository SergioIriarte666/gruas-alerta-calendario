import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface XMLImportDialogHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  fileName?: string | null;
  documentCount?: number | null;
  countLabel?: string;
}

type XMLImportStatTone = 'neutral' | 'success' | 'info' | 'danger';

interface XMLImportStatItem {
  title: string;
  value: React.ReactNode;
  icon: LucideIcon;
  tone?: XMLImportStatTone;
}

interface XMLImportStatsGridProps {
  items: XMLImportStatItem[];
  className?: string;
}

interface XMLImportProgressCardProps {
  label: string;
  value: number;
  className?: string;
}

interface XMLImportStepGuideProps {
  step: number;
  title: string;
  description: string;
}

const toneClasses: Record<
  XMLImportStatTone,
  {
    card: string;
    icon: string;
    value: string;
  }
> = {
  neutral: {
    card: 'border-border/70 bg-card shadow-sm',
    icon: 'bg-muted/50 text-muted-foreground',
    value: '',
  },
  success: {
    card: 'border-success/20 bg-success/10 shadow-sm',
    icon: 'bg-success/15 text-success',
    value: 'text-success',
  },
  info: {
    card: 'border-info/20 bg-info/10 shadow-sm',
    icon: 'bg-info/15 text-info',
    value: '',
  },
  danger: {
    card: 'border-danger/20 bg-danger/10 shadow-sm',
    icon: 'bg-danger/15 text-danger',
    value: 'text-danger',
  },
};

export const XMLImportDialogHeader: React.FC<XMLImportDialogHeaderProps> = ({
  icon: Icon,
  title,
  description,
  fileName,
  documentCount,
  countLabel = 'doc(s)',
}) => (
  <DialogHeader className="relative overflow-hidden border-b border-border/70 bg-card px-4 py-5 text-left sm:px-6">
    <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary" />
    <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-primary/10 blur-3xl" />
    <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_hsl(var(--primary))]">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          {title}
        </DialogTitle>
        <DialogDescription className="pl-[3.25rem] text-sm leading-relaxed">{description}</DialogDescription>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="max-w-full border-border/70 bg-background/80 px-3 py-1.5 text-xs shadow-sm">
          <span className="truncate">
          {fileName ? `Archivo: ${fileName}` : 'Esperando XML'}
          </span>
        </Badge>
        {typeof documentCount === 'number' && (
          <Badge variant="secondary" className="border-border/70 bg-muted/40 px-3 py-1 text-xs">
            {documentCount} {countLabel}
          </Badge>
        )}
      </div>
    </div>
  </DialogHeader>
);

export const XMLImportStatsGrid: React.FC<XMLImportStatsGridProps> = ({ items, className }) => (
  <div className={cn('grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 xl:grid-cols-4', className)}>
    {items.map(({ title, value, icon: Icon, tone = 'neutral' }) => {
      const classes = toneClasses[tone];

      return (
        <Card key={title} className={cn('overflow-hidden transition-colors', classes.card)}>
          <CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
            <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl sm:size-11', classes.icon)}>
              <Icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</p>
              <div className={cn('truncate text-xl font-bold tabular-nums sm:text-2xl', classes.value)}>{value}</div>
            </div>
          </CardContent>
        </Card>
      );
    })}
  </div>
);

export const XMLImportStepGuide: React.FC<XMLImportStepGuideProps> = ({ step, title, description }) => (
  <div className="relative overflow-hidden rounded-xl border border-border/70 bg-card px-4 py-4 shadow-sm sm:pl-16">
    <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
    <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary sm:absolute sm:left-4 sm:top-4 sm:mb-0">
      {String(step).padStart(2, '0')}
    </div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Paso {step}</p>
    <p className="mt-0.5 font-semibold text-foreground">{title}</p>
    <p className="mt-1 max-w-4xl text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
);

export const XMLImportProgressCard: React.FC<XMLImportProgressCardProps> = ({
  label,
  value,
  className,
}) => (
  <Card className={cn('border bg-card', className)}>
    <CardContent className="p-4">
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-foreground">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
        <Progress value={value} className="h-2" />
      </div>
    </CardContent>
  </Card>
);
