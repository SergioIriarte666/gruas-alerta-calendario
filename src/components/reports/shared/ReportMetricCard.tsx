import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface ReportMetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  valueClassName?: string;
  icon?: React.ComponentType<{ className?: string }>;
  showSensitiveData?: boolean;
}

export const ReportMetricCard = ({ title, value, description, valueClassName }: ReportMetricCardProps) => (
  <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
    <CardContent className="p-3 sm:p-4">
      <p className="text-xs sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <div className={`text-lg sm:text-2xl font-bold mt-1 truncate ${valueClassName || 'text-foreground'}`}>{value}</div>
      {description && <p className="text-xs sm:text-xs text-muted-foreground mt-0.5 truncate">{description}</p>}
    </CardContent>
  </Card>
);
