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
  <DialogHeader className="border-b border-border/70 bg-muted/20 px-6 py-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <DialogTitle className="flex items-center gap-2 text-xl">
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="size-5" />
          </span>
          {title}
        </DialogTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="border-border/70 bg-background/70 px-3 py-1 text-xs">
          {fileName ? `Archivo: ${fileName}` : 'Esperando XML'}
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
  <div className={cn('grid grid-cols-2 gap-3 xl:grid-cols-4', className)}>
    {items.map(({ title, value, icon: Icon, tone = 'slate' }) => {
      const classes = toneClasses[tone];

      return (
        <Card key={title} className={classes.card}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={cn('rounded-xl p-3', classes.icon)}>
              <Icon className="size-5" />
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
