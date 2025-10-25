import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProjectionHeader } from "@/components/projections/ProjectionHeader";
import { ProjectionFilters } from "@/components/projections/ProjectionFilters";
import { PendingInvoicesTable } from "@/components/projections/PendingInvoicesTable";
import { CashFlowChart } from "@/components/projections/CashFlowChart";
import { AgingReport } from "@/components/projections/AgingReport";
import { useIncomeProjections } from "@/hooks/projections/useIncomeProjections";
import { TrendingUp } from "lucide-react";

export default function IncomeProjections() {
  const [dateRange, setDateRange] = useState(30);
  const [clientId, setClientId] = useState<string | null>(null);
  const [status, setStatus] = useState<string[]>(['sent', 'partial', 'overdue']);

  const { data, isLoading } = useIncomeProjections({
    dateRange,
    clientId,
    status,
  });

  const invoices = data?.invoices || [];
  const metrics = data?.metrics || {
    totalProjected30Days: 0,
    totalOverdue: 0,
    totalInCollection: 0,
    collectionRate: 0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-lg bg-primary/10">
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Proyección de Ingresos</h1>
          <p className="text-muted-foreground">
            Análisis y proyección de cobros basado en facturas pendientes
          </p>
        </div>
      </div>

      {/* KPI Metrics */}
      <ProjectionHeader metrics={metrics} isLoading={isLoading} />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros de Análisis</CardTitle>
          <CardDescription>
            Personaliza el análisis según tus necesidades
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectionFilters
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            clientId={clientId}
            onClientIdChange={setClientId}
            status={status}
            onStatusChange={setStatus}
          />
        </CardContent>
      </Card>

      {/* Cash Flow Chart */}
      <CashFlowChart invoices={invoices} dateRange={dateRange} />

      {/* Aging Report */}
      <AgingReport invoices={invoices} />

      {/* Pending Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas Pendientes</CardTitle>
          <CardDescription>
            Ordenadas por fecha de vencimiento • {invoices.length} facturas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PendingInvoicesTable invoices={invoices} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
