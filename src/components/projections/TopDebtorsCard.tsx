import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProjectedInvoice } from "@/hooks/projections/useIncomeProjections";
import { formatCurrency } from "@/lib/utils";
import { Users, TrendingUp } from "lucide-react";

interface TopDebtor {
  clientId: string;
  clientName: string;
  clientRut: string;
  totalPending: number;
  invoiceCount: number;
  avgDaysOverdue: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface TopDebtorsCardProps {
  invoices: ProjectedInvoice[];
  onClientSelect: (clientId: string) => void;
}

export const TopDebtorsCard = ({ invoices, onClientSelect }: TopDebtorsCardProps) => {
  // Agrupar por cliente
  const debtorMap = invoices.reduce((acc, invoice) => {
    const key = invoice.client_id;
    if (!acc[key]) {
      acc[key] = {
        clientId: invoice.client_id,
        clientName: invoice.client_name,
        clientRut: invoice.client_rut,
        totalPending: 0,
        invoiceCount: 0,
        totalDaysOverdue: 0,
        overdueCount: 0,
      };
    }
    
    acc[key].totalPending += invoice.remaining_amount;
    acc[key].invoiceCount += 1;
    
    if (invoice.status === 'overdue') {
      acc[key].totalDaysOverdue += invoice.days_overdue;
      acc[key].overdueCount += 1;
    }
    
    return acc;
  }, {} as Record<string, any>);

  // Convertir a array y calcular métricas
  const debtors: TopDebtor[] = Object.values(debtorMap)
    .map((debtor: any) => {
      const avgDaysOverdue = debtor.overdueCount > 0 
        ? Math.round(debtor.totalDaysOverdue / debtor.overdueCount)
        : 0;
      
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (avgDaysOverdue > 90) riskLevel = 'critical';
      else if (avgDaysOverdue > 60) riskLevel = 'high';
      else if (avgDaysOverdue > 30) riskLevel = 'medium';
      
      return {
        clientId: debtor.clientId,
        clientName: debtor.clientName,
        clientRut: debtor.clientRut,
        totalPending: debtor.totalPending,
        invoiceCount: debtor.invoiceCount,
        avgDaysOverdue,
        riskLevel,
      };
    })
    .sort((a, b) => b.totalPending - a.totalPending)
    .slice(0, 5);

  const getRiskBadge = (level: string) => {
    const config = {
      low: { label: 'Bajo', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
      medium: { label: 'Medio', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
      high: { label: 'Alto', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
      critical: { label: 'Crítico', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    };
    
    const { label, className } = config[level as keyof typeof config];
    return <Badge variant="outline" className={className}>{label}</Badge>;
  };

  if (debtors.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle>Top 5 Clientes por Cobrar</CardTitle>
            <CardDescription>
              Clientes con mayor monto pendiente de cobro
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {debtors.map((debtor, index) => (
            <div
              key={debtor.clientId}
              className="p-4 rounded-lg border bg-card hover:shadow-md transition-all cursor-pointer group"
              onClick={() => onClientSelect(debtor.clientId)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      #{index + 1}
                    </Badge>
                    <span className="font-semibold text-foreground truncate">
                      {debtor.clientName}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {debtor.clientRut}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{debtor.invoiceCount} facturas</span>
                    {debtor.avgDaysOverdue > 0 && (
                      <>
                        <span>•</span>
                        <span>{debtor.avgDaysOverdue}d mora promedio</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-foreground mb-2">
                    {formatCurrency(debtor.totalPending)}
                  </div>
                  {getRiskBadge(debtor.riskLevel)}
                </div>
              </div>
              <div className="mt-2 pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs group-hover:bg-primary/10"
                >
                  Ver facturas del cliente
                  <TrendingUp className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
