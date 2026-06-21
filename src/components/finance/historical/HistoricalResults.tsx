import React, { useState, useMemo, useCallback } from 'react';
import { useInvoices } from '@/hooks/useInvoices';
import { usePurchaseInvoices } from '@/hooks/usePurchaseInvoices';
import { formatCurrency } from '@/lib/utils';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { 
  DollarSign, ShoppingCart, TrendingUp, Percent, Download, CalendarIcon, 
  AlertTriangle, Trophy, Building2, FileSpreadsheet, FileText 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Invoice } from '@/types';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import { businessClock } from '@/utils/businessClock';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip as UiTooltip,
  TooltipContent as UiTooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { SourceFilter, SOURCE_FILTER_OPTIONS, matchesSource } from './useSourceFilter';
import { HistoricalEmptyState } from './HistoricalEmptyState';

type PeriodType = 'this_year' | 'last_year' | 'custom';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 220 70% 50%))',
  'hsl(var(--chart-3, 280 65% 60%))',
  'hsl(var(--chart-4, 30 80% 55%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(var(--muted-foreground))',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }} className="text-xs">
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
};

export const HistoricalResults: React.FC = () => {
  const { invoices: salesInvoices, loading: salesLoading } = useInvoices();
  const { invoices: purchaseInvoices, isLoading: purchasesLoading } = usePurchaseInvoices();

  const [period, setPeriod] = useState<PeriodType>('this_year');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [source, setSource] = useState<SourceFilter>('all');

  // Valida que "Desde" no sea posterior a "Hasta": si se viola, ajusta el otro extremo.
  const handleCustomFromChange = (date: Date | undefined) => {
    setCustomFrom(date);
    if (date && customTo && date > customTo) setCustomTo(date);
  };
  const handleCustomToChange = (date: Date | undefined) => {
    setCustomTo(date);
    if (date && customFrom && date < customFrom) setCustomFrom(date);
  };

  // Period date range
  const dateRange = useMemo(() => {
    const now = businessClock.todayDate();
    switch (period) {
      case 'this_year':
        // No incluir meses/días futuros: el tope es hoy, no el 31 de diciembre.
        return { from: startOfYear(now), to: now };
      case 'last_year':
        return { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) };
      case 'custom':
        return {
          from: customFrom || startOfYear(now),
          to: customTo || now
        };
    }
  }, [period, customFrom, customTo]);

  // Período anterior equivalente (mismo N° de días inmediatamente anterior a dateRange.from)
  const previousDateRange = useMemo(() => {
    const days = Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1);
    const to = new Date(dateRange.from.getTime() - 86400000);
    const from = new Date(to.getTime() - (days - 1) * 86400000);
    return { from, to };
  }, [dateRange]);

  // Filter sales
  const filteredSales = useMemo(() => {
    return salesInvoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      if (!matchesSource(inv.source, source)) return false;
      try {
        const d = parseISO(inv.issueDate);
        return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
      } catch { return false; }
    });
  }, [salesInvoices, dateRange, source]);

  // Filter purchases
  const filteredPurchases = useMemo(() => {
    return purchaseInvoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      if (!matchesSource(inv.source, source)) return false;
      try {
        const d = parseISO(inv.issue_date);
        return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
      } catch { return false; }
    });
  }, [purchaseInvoices, dateRange, source]);

  // Período anterior equivalente, para mostrar variación % en los KPIs principales.
  const previousTotals = useMemo(() => {
    const prevSales = salesInvoices.filter(inv => {
      if (inv.status === 'cancelled' || !matchesSource(inv.source, source)) return false;
      try {
        const d = parseISO(inv.issueDate);
        return isWithinInterval(d, { start: previousDateRange.from, end: previousDateRange.to });
      } catch { return false; }
    });
    const prevPurchases = purchaseInvoices.filter(inv => {
      if (inv.status === 'cancelled' || !matchesSource(inv.source, source)) return false;
      try {
        const d = parseISO(inv.issue_date);
        return isWithinInterval(d, { start: previousDateRange.from, end: previousDateRange.to });
      } catch { return false; }
    });
    const sales = prevSales.reduce((s, i) => s + (i.total || 0), 0);
    const purchases = prevPurchases.reduce((s, i) => s + (i.amount || 0), 0);
    return { sales, purchases, margin: sales - purchases };
  }, [salesInvoices, purchaseInvoices, previousDateRange, source]);

  const variationPct = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  // KPIs
  const totalSales = useMemo(() => filteredSales.reduce((s, i) => s + (i.total || 0), 0), [filteredSales]);
  const totalPurchases = useMemo(() => filteredPurchases.reduce((s, i) => s + (i.amount || 0), 0), [filteredPurchases]);
  // Resultado simple ventas - compras; NO es "margen bruto" contable (no descuenta COGS).
  const grossMargin = totalSales - totalPurchases;
  const ratio = totalSales > 0 ? (totalPurchases / totalSales) * 100 : 0;

  const salesVariation = variationPct(totalSales, previousTotals.sales);
  const purchasesVariation = variationPct(totalPurchases, previousTotals.purchases);
  const marginVariation = variationPct(grossMargin, previousTotals.margin);

  // Monthly data for charts
  const monthlyData = useMemo(() => {
    const months: Record<string, { sales: number; purchases: number; label: string; monthNum: number }> = {};

    // Generate all months in range
    let cursor = startOfMonth(dateRange.from);
    const end = endOfMonth(dateRange.to);
    while (cursor <= end) {
      const key = format(cursor, 'yyyy-MM');
      months[key] = {
        sales: 0,
        purchases: 0,
        label: format(cursor, 'MMM yy', { locale: es }),
        monthNum: cursor.getMonth(),
      };
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    filteredSales.forEach(inv => {
      const key = inv.issueDate.substring(0, 7);
      if (months[key]) months[key].sales += inv.total || 0;
    });

    filteredPurchases.forEach(inv => {
      const key = inv.issue_date.substring(0, 7);
      if (months[key]) months[key].purchases += inv.amount || 0;
    });

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({
        month: val.label,
        ventas: val.sales,
        compras: val.purchases,
        margen: val.sales - val.purchases,
      }));
  }, [filteredSales, filteredPurchases, dateRange]);

  // Comparación interanual: el año de referencia es el del período filtrado
  // (dateRange.to), no siempre "hoy" — así depende del período seleccionado.
  const interannualData = useMemo(() => {
    const refYear = dateRange.to.getFullYear();
    const prevYear = refYear - 1;

    const yearData: Record<number, { sales: number; purchases: number }> = {
      [prevYear]: { sales: 0, purchases: 0 },
      [refYear]: { sales: 0, purchases: 0 },
    };

    salesInvoices.forEach(inv => {
      if (inv.status === 'cancelled' || !matchesSource(inv.source, source)) return;
      const y = parseInt(inv.issueDate.substring(0, 4));
      if (yearData[y]) yearData[y].sales += inv.total || 0;
    });

    purchaseInvoices.forEach(inv => {
      if (inv.status === 'cancelled' || !matchesSource(inv.source, source)) return;
      const y = parseInt(inv.issue_date.substring(0, 4));
      if (yearData[y]) yearData[y].purchases += inv.amount || 0;
    });

    return [
      { year: String(prevYear), ventas: yearData[prevYear].sales, compras: yearData[prevYear].purchases },
      { year: String(refYear), ventas: yearData[refYear].sales, compras: yearData[refYear].purchases },
    ];
  }, [salesInvoices, purchaseInvoices, dateRange, source]);

  // Pie chart - purchases by supplier
  const supplierDistribution = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    filteredPurchases.forEach(inv => {
      const name = inv.supplier?.name || 'Sin Proveedor';
      const id = inv.supplier_id || 'none';
      if (!map[id]) map[id] = { name, total: 0 };
      map[id].total += inv.amount || 0;
    });
    const sorted = Object.values(map).sort((a, b) => b.total - a.total);
    const top5 = sorted.slice(0, 5);
    const othersTotal = sorted.slice(5).reduce((s, v) => s + v.total, 0);
    const result = top5.map(s => ({ name: s.name, value: s.total }));
    if (othersTotal > 0) result.push({ name: 'Otros', value: othersTotal });
    return result;
  }, [filteredPurchases]);

  // Rankings
  const topClients = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    filteredSales.forEach(inv => {
      const id = inv.clientId || 'unknown';
      const name = inv.client?.name || 'Sin Cliente';
      if (!map[id]) map[id] = { name, total: 0 };
      map[id].total += inv.total || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredSales]);

  const topSuppliers = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {};
    filteredPurchases.forEach(inv => {
      const id = inv.supplier_id || 'unknown';
      const name = inv.supplier?.name || 'Sin Proveedor';
      if (!map[id]) map[id] = { name, total: 0 };
      map[id].total += inv.amount || 0;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filteredPurchases]);

  // Monthly summary table
  const monthlySummary = useMemo(() => {
    return monthlyData.map((m, i) => {
      const prev = i > 0 ? monthlyData[i - 1] : null;
      const next = i < monthlyData.length - 1 ? monthlyData[i + 1] : null;
      const variation = prev && prev.margen !== 0
        ? ((m.margen - prev.margen) / Math.abs(prev.margen)) * 100
        : null;
      const isMissingData = m.ventas === 0 && m.compras === 0 &&
        ((prev && (prev.ventas > 0 || prev.compras > 0)) || (next && (next.ventas > 0 || next.compras > 0)));
      return { ...m, variation, isNegative: m.margen < 0, isMissingData };
    });
  }, [monthlyData]);

  const sourceLabel = SOURCE_FILTER_OPTIONS.find((o) => o.value === source)?.label || 'Todos';

  // Export functions. Las librerías xlsx/jspdf se cargan dinámicamente solo al exportar
  // (no se incluyen en el bundle inicial) y el reporte incluye período, origen y fecha de generación.
  const exportToExcel = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const data = monthlySummary.map(m => ({
        'Mes': m.month,
        'Ventas': m.ventas,
        'Compras': m.compras,
        'Resultado (Ventas - Compras)': m.margen,
        'Variación %': m.variation !== null ? `${m.variation.toFixed(1)}%` : 'N/A',
      }));
      data.push({
        'Mes': 'TOTAL',
        'Ventas': totalSales,
        'Compras': totalPurchases,
        'Resultado (Ventas - Compras)': grossMargin,
        'Variación %': '',
      });
      const metaRows = [
        { 'Mes': `Período: ${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}` },
        { 'Mes': `Origen: ${sourceLabel}` },
        { 'Mes': `Generado: ${businessClock.format(businessClock.todayDate(), 'dd/MM/yyyy HH:mm')}` },
        { 'Mes': '' },
      ];
      const ws = XLSX.utils.json_to_sheet([...metaRows, ...data]);
      ws['!cols'] = [{ wch: 28 }, { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
      XLSX.writeFile(wb, `resultados-historicos-${businessClock.today()}.xlsx`);
      toast.success('Excel exportado correctamente');
    } catch { toast.error('Error al exportar Excel'); }
  }, [monthlySummary, totalSales, totalPurchases, grossMargin, dateRange, sourceLabel]);

  const exportToPDF = useCallback(async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Resultados Históricos', 14, 20);
      doc.setFontSize(10);
      doc.text(`Período: ${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`, 14, 30);
      doc.text(`Origen: ${sourceLabel}`, 14, 36);
      doc.text(`Generado: ${businessClock.format(businessClock.todayDate(), 'dd/MM/yyyy HH:mm')}`, 14, 42);
      doc.text(`Total Ventas: ${formatCurrency(totalSales)}`, 14, 50);
      doc.text(`Total Compras: ${formatCurrency(totalPurchases)}`, 14, 56);
      doc.text(`Resultado (Ventas - Compras): ${formatCurrency(grossMargin)}`, 14, 62);

      autoTable(doc, {
        startY: 70,
        head: [['Mes', 'Ventas', 'Compras', 'Resultado', 'Var. %']],
        body: monthlySummary.map(m => [
          m.month,
          formatCurrency(m.ventas),
          formatCurrency(m.compras),
          formatCurrency(m.margen),
          m.variation !== null ? `${m.variation.toFixed(1)}%` : 'N/A',
        ]),
        foot: [['Total', formatCurrency(totalSales), formatCurrency(totalPurchases), formatCurrency(grossMargin), '']],
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8 },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      });

      doc.save(`resultados-historicos-${businessClock.today()}.pdf`);
      toast.success('PDF exportado correctamente');
    } catch { toast.error('Error al exportar PDF'); }
  }, [monthlySummary, dateRange, totalSales, totalPurchases, grossMargin, sourceLabel]);

  const isLoading = salesLoading || purchasesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full size-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar: Filters + Export */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_year">Este año</SelectItem>
              <SelectItem value="last_year">Año anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] text-left text-xs", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 size-3" />
                    {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'Desde'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={handleCustomFromChange} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] text-left text-xs", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 size-3" />
                    {customTo ? format(customTo, 'dd/MM/yyyy') : 'Hasta'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={handleCustomToChange} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Origen" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="text-[10px]">
            Período: {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')} · Origen: {sourceLabel}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="size-4 mr-1" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={exportToExcel}>
              <FileSpreadsheet className="size-4 mr-2" /> Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF}>
              <FileText className="size-4 mr-2" /> PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          icon={DollarSign}
          title="Total Ventas"
          value={formatCurrency(totalSales)}
          description={`${filteredSales.length} facturas`}
          variation={salesVariation}
        />
        <KPICard
          icon={ShoppingCart}
          title="Total Compras"
          value={formatCurrency(totalPurchases)}
          description={`${filteredPurchases.length} facturas`}
          variation={purchasesVariation}
        />
        <KPICard
          icon={TrendingUp}
          title="Resultado (Ventas − Compras)"
          value={formatCurrency(grossMargin)}
          description={grossMargin >= 0 ? 'Positivo' : 'Negativo'}
          valueClassName={grossMargin >= 0 ? 'text-green-600' : 'text-destructive'}
          variation={marginVariation}
          tooltip="Diferencia simple entre ventas y compras del período. No es un margen bruto contable (no descuenta costo de ventas/COGS)."
        />
        <KPICard icon={Percent} title="Ratio C/V" value={`${ratio.toFixed(1)}%`} description="Compras / Ventas" />
      </div>
      <p className="text-xs text-muted-foreground">
        Comparación vs. período anterior equivalente ({format(previousDateRange.from, 'dd/MM/yy')} - {format(previousDateRange.to, 'dd/MM/yy')}).
      </p>

      {/* Charts Row 1: Bar + Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ventas vs Compras por Mes</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="compras" name="Compras" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolución del Resultado (Ventas − Compras)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="margen" name="Margen" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2: Pie + Interannual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribución Compras por Proveedor</CardTitle>
          </CardHeader>
          <CardContent>
            {supplierDistribution.length === 0 ? (
              <HistoricalEmptyState variant={purchaseInvoices.length === 0 ? 'none' : 'filtered'} />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={supplierDistribution}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={{ strokeWidth: 1 }}
                    style={{ fontSize: 10 }}
                  >
                    {supplierDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => formatCurrency(val)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Comparación Interanual (según período seleccionado)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={interannualData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="compras" name="Compras" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Trophy className="size-4 text-yellow-500" /> Top 5 Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topClients.length === 0 ? (
              <HistoricalEmptyState variant={salesInvoices.length === 0 ? 'none' : 'filtered'} className="py-2" />
            ) : topClients.map((c, i) => {
              const maxVal = topClients[0]?.total || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <Badge variant="outline" className="size-6 flex items-center justify-center text-[10px] shrink-0">{i + 1}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{c.name}</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${(c.total / maxVal) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-foreground shrink-0">{formatCurrency(c.total)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-blue-500" /> Top 5 Proveedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSuppliers.length === 0 ? (
              <HistoricalEmptyState variant={purchaseInvoices.length === 0 ? 'none' : 'filtered'} className="py-2" />
            ) : topSuppliers.map((s, i) => {
              const maxVal = topSuppliers[0]?.total || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <Badge variant="outline" className="size-6 flex items-center justify-center text-[10px] shrink-0">{i + 1}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{s.name}</p>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                      <div className="bg-destructive rounded-full h-1.5 transition-all" style={{ width: `${(s.total / maxVal) * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-foreground shrink-0">{formatCurrency(s.total)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Summary Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Resumen Mensual</CardTitle>
          <CardDescription className="text-xs">Desglose mensual de ventas, compras y margen con variación porcentual</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Mes</TableHead>
                <TableHead className="text-xs text-right">Ventas</TableHead>
                <TableHead className="text-xs text-right">Compras</TableHead>
                <TableHead className="text-xs text-right">Margen</TableHead>
                <TableHead className="text-xs text-right">Var. %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlySummary.map((m, i) => (
                <TableRow key={i} className={cn(m.isNegative && 'bg-destructive/5', m.isMissingData && 'bg-amber-50/50 dark:bg-amber-950/20')}>
                  <TableCell className="text-xs font-medium capitalize">
                    {m.isNegative && <AlertTriangle className="size-3 text-destructive inline mr-1" />}
                    {m.isMissingData && <AlertTriangle className="size-3 text-amber-500 inline mr-1" />}
                    {m.month}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {m.isMissingData ? (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400">
                        Sin datos - ¿Falta importación?
                      </Badge>
                    ) : formatCurrency(m.ventas)}
                  </TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(m.compras)}</TableCell>
                  <TableCell className={cn("text-xs text-right font-semibold", m.isNegative ? 'text-destructive' : 'text-green-600')}>
                    {formatCurrency(m.margen)}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {m.variation !== null ? (
                      <Badge variant={m.variation >= 0 ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                        {m.variation >= 0 ? '+' : ''}{m.variation.toFixed(1)}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell className="text-xs font-bold">TOTAL</TableCell>
                <TableCell className="text-xs text-right font-bold">{formatCurrency(totalSales)}</TableCell>
                <TableCell className="text-xs text-right font-bold">{formatCurrency(totalPurchases)}</TableCell>
                <TableCell className={cn("text-xs text-right font-bold", grossMargin >= 0 ? 'text-green-600' : 'text-destructive')}>
                  {formatCurrency(grossMargin)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// KPI Card subcomponent
const KPICard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  description: string;
  valueClassName?: string;
  /** Variación % vs. período anterior equivalente, si hay datos para compararla. */
  variation?: number | null;
  /** Texto aclaratorio mostrado en un ícono de información, para KPIs cuyo nombre podría confundirse con un término contable. */
  tooltip?: string;
}> = ({ icon: Icon, title, value, description, valueClassName, variation, tooltip }) => (
  <Card className="bg-card border overflow-hidden">
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
          {title}
          {tooltip && (
            <TooltipProvider>
              <UiTooltip>
                <TooltipTrigger asChild>
                  <Info className="size-3 text-muted-foreground/70" aria-label={`Aclaración sobre ${title}`} />
                </TooltipTrigger>
                <UiTooltipContent className="max-w-[220px] text-xs">{tooltip}</UiTooltipContent>
              </UiTooltip>
            </TooltipProvider>
          )}
        </p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className={cn("text-lg sm:text-2xl font-bold truncate", valueClassName || 'text-foreground')}>{value}</div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className="text-[10px] sm:text-xs text-muted-foreground">{description}</p>
        {variation !== undefined && variation !== null && (
          <span
            className={cn(
              "text-[10px] font-medium px-1 rounded",
              variation >= 0 ? 'text-green-700 bg-green-50' : 'text-destructive bg-destructive/10'
            )}
            title="Variación vs. período anterior equivalente"
          >
            {variation >= 0 ? '▲' : '▼'} {Math.abs(variation).toFixed(1)}%
          </span>
        )}
      </div>
    </CardContent>
  </Card>
);
