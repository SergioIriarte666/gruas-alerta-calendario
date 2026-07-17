import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjectionHeader } from "@/components/projections/ProjectionHeader";
import { ProjectionFilters } from "@/components/projections/ProjectionFilters";
import { PendingInvoicesTable } from "@/components/projections/PendingInvoicesTable";
import { CashFlowChart } from "@/components/projections/CashFlowChart";
import { AgingReport } from "@/components/projections/AgingReport";
import { TopDebtorsCard } from "@/components/projections/TopDebtorsCard";
import { useIncomeProjections } from "@/hooks/projections/useIncomeProjections";
import { useProjectionFilters } from "@/hooks/projections/useProjectionFilters";
import { TrendingUp, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function IncomeProjections() {
  const {
    filters,
    setDateRange,
    setClientId,
    setStatus,
    clearFilters,
    hasActiveFilters,
  } = useProjectionFilters();

  const { data, isLoading } = useIncomeProjections({
    dateRange: filters.dateRange,
    clientId: filters.clientId,
    status: filters.status,
  });

  const invoices = data?.invoices || [];
  const metrics = data?.metrics || {
    totalProjectedInRange: 0,
    totalOverdue: 0,
    totalInCollection: 0,
    paidRateOpenPortfolio: 0,
  };

  return (
    <div className="income-projections-concept space-y-4 pb-6 sm:space-y-6">
      {/* Header */}
      <div>
        <span className="dashboard-section-kicker"><TrendingUp className="size-3.5" />Inteligencia de cobranza</span>
        <div>
          <h1 className="dashboard-section-title">Proyección de Ingresos</h1>
          <p className="dashboard-section-description">Flujo de caja esperado y priorización de facturas pendientes.</p>
        </div>
      </div>

      {/* KPI Metrics */}
      <ProjectionHeader metrics={metrics} dateRange={filters.dateRange} isLoading={isLoading} />

      {/* Filters */}
      <Card className="analysis-filter-panel">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Filtros de Análisis</CardTitle>
              <CardDescription>
                Personaliza el análisis según tus necesidades
              </CardDescription>
            </div>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="gap-2"
              >
                <X className="size-4" />
                Limpiar filtros
                <Badge variant="secondary" className="ml-1">
                  Activos
                </Badge>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <ProjectionFilters
            dateRange={filters.dateRange}
            onDateRangeChange={setDateRange}
            clientId={filters.clientId}
            onClientIdChange={setClientId}
            status={filters.status}
            onStatusChange={setStatus}
          />
        </CardContent>
      </Card>

      {/* Cash Flow Chart */}
      <CashFlowChart invoices={invoices} dateRange={filters.dateRange} />

      {/* Top Debtors */}
      <TopDebtorsCard 
        invoices={invoices} 
        onClientSelect={(clientId) => setClientId(clientId)}
      />

      {/* Aging Report */}
      <AgingReport invoices={invoices} />

      {/* Pending Invoices Table */}
      <Card className="analysis-panel">
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
