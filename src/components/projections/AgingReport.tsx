import { parseDateValue } from '@/utils/calendarDate';
import { businessClock } from '@/utils/businessClock';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectedInvoice } from "@/hooks/projections/useIncomeProjections";
import { formatCurrency } from "@/lib/utils";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { AlertCircle, Clock, AlertTriangle, XCircle } from "lucide-react";

interface AgingReportProps {
  invoices: ProjectedInvoice[];
}

interface AgingBucket {
  label: string;
  range: string;
  amount: number;
  count: number;
  color: string;
  icon: React.ReactNode;
}

export const AgingReport = ({ invoices }: AgingReportProps) => {
  const today = startOfDay(businessClock.todayDate());

  // Filtrar solo facturas vencidas (por status o por fecha)
  const overdueInvoices = invoices.filter(inv => inv.status === 'overdue');

  // Agrupar por antigüedad
  const buckets: AgingBucket[] = [
    {
      label: "1-30 días",
      range: "recent",
      amount: 0,
      count: 0,
      color: "text-warning",
      icon: <Clock className="size-5" />,
    },
    {
      label: "31-60 días",
      range: "moderate",
      amount: 0,
      count: 0,
      color: "text-warning-text",
      icon: <AlertCircle className="size-5" />,
    },
    {
      label: "61-90 días",
      range: "serious",
      amount: 0,
      count: 0,
      color: "text-danger",
      icon: <AlertTriangle className="size-5" />,
    },
    {
      label: "+90 días",
      range: "critical",
      amount: 0,
      count: 0,
      color: "text-destructive",
      icon: <XCircle className="size-5" />,
    },
  ];

  // Clasificar facturas en buckets
  overdueInvoices.forEach(invoice => {
    const daysOverdue = differenceInCalendarDays(today, parseDateValue(invoice.due_date));
    
    if (daysOverdue <= 30) {
      buckets[0].amount += invoice.remaining_amount;
      buckets[0].count += 1;
    } else if (daysOverdue <= 60) {
      buckets[1].amount += invoice.remaining_amount;
      buckets[1].count += 1;
    } else if (daysOverdue <= 90) {
      buckets[2].amount += invoice.remaining_amount;
      buckets[2].count += 1;
    } else {
      buckets[3].amount += invoice.remaining_amount;
      buckets[3].count += 1;
    }
  });

  const totalOverdue = buckets.reduce((sum, bucket) => sum + bucket.amount, 0);
  const totalCount = buckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Antigüedad de Cuentas por Cobrar</CardTitle>
        <CardDescription>
          Facturas vencidas agrupadas por días de mora • {totalCount} facturas vencidas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Total Overview */}
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Vencido</p>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(totalOverdue)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-muted-foreground">Facturas</p>
              <p className="text-2xl font-bold text-destructive">{totalCount}</p>
            </div>
          </div>
        </div>

        {/* Aging Buckets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {buckets.map((bucket) => (
            <div
              key={bucket.range}
              className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={bucket.color}>
                  {bucket.icon}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{bucket.label}</p>
                  <p className="text-xs text-muted-foreground">{bucket.count} facturas</p>
                </div>
              </div>
              <p className={`text-xl font-bold ${bucket.color}`}>
                {formatCurrency(bucket.amount)}
              </p>
              {totalOverdue > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {((bucket.amount / totalOverdue) * 100).toFixed(1)}% del total
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
