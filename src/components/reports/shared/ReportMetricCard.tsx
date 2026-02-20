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
  <Card className="bg-card border">
    <CardContent className="p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <div className={`text-2xl font-bold mt-1 ${valueClassName || 'text-foreground'}`}>{value}</div>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </CardContent>
  </Card>
);
