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
    collectionRate: 0,
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6">
        <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
          <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">Proyección de Ingresos</h1>
          <p className="text-muted-foreground text-sm">
            Análisis y proyección de cobros basado en facturas pendientes
          </p>
        </div>
      </div>

      {/* KPI Metrics */}
      <ProjectionHeader metrics={metrics} dateRange={filters.dateRange} isLoading={isLoading} />

      {/* Filters */}
      <Card>
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
                <X className="h-4 w-4" />
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
