import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

type XMLImportStatTone = 'slate' | 'emerald' | 'blue' | 'red';

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

const toneClasses: Record<
  XMLImportStatTone,
  {
    card: string;
    icon: string;
    value: string;
  }
> = {
  slate: {
    card: 'border-slate-200/80 bg-gradient-to-br from-white to-slate-50 shadow-sm dark:from-background dark:to-muted/20',
    icon: 'bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300',
    value: '',
  },
  emerald: {
    card: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white shadow-sm dark:from-emerald-950/30 dark:to-background',
    icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    value: 'text-emerald-600 dark:text-emerald-400',
  },
  blue: {
    card: 'border-blue-200/80 bg-gradient-to-br from-blue-50 to-white shadow-sm dark:from-blue-950/20 dark:to-background',
    icon: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    value: '',
  },
  red: {
    card: 'border-red-200/80 bg-gradient-to-br from-red-50 to-white shadow-sm dark:from-red-950/20 dark:to-background',
    icon: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    value: 'text-red-600 dark:text-red-400',
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
  <DialogHeader className="border-b bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-4 dark:from-slate-950 dark:via-background dark:to-slate-950">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <DialogTitle className="flex items-center gap-2 text-xl">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-5 w-5" />
          </span>
          {title}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="bg-background/70 px-3 py-1 text-xs">
          {fileName ? `Archivo: ${fileName}` : 'Esperando XML'}
        </Badge>
        {typeof documentCount === 'number' && (
          <Badge variant="secondary" className="px-3 py-1 text-xs">
            {documentCount} {countLabel}
          </Badge>
        )}
      </div>
    </div>
  </DialogHeader>
);

export const XMLImportStatsGrid: React.FC<XMLImportStatsGridProps> = ({ items, className }) => (
  <div className={cn('grid grid-cols-2 gap-3 xl:grid-cols-4', className)}>
    {items.map(({ title, value, icon: Icon, tone = 'slate' }) => {
      const classes = toneClasses[tone];

      return (
        <Card key={title} className={classes.card}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={cn('rounded-xl p-3', classes.icon)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
              <div className={cn('text-2xl font-semibold', classes.value)}>{value}</div>
            </div>
          </CardContent>
        </Card>
      );
    })}
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
