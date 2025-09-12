
import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface ReportMetricCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  description: string;
  valueClassName?: string;
}

export const ReportMetricCard = ({ icon: Icon, title, value, description, valueClassName }: ReportMetricCardProps) => (
  <Card className="bg-card border hover:bg-muted/50 transition-colors">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-black">{title}</CardTitle>
      <Icon className="h-4 w-4 text-black" />
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold text-foreground ${valueClassName}`}>{value}</div>
      <p className="text-xs text-black">{description}</p>
    </CardContent>
  </Card>
);
