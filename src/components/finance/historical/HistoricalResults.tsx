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
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice } from '@/types';
import { SupplierInvoiceWithDetails } from '@/types/suppliers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

  // Period date range
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'this_year':
        return { from: startOfYear(now), to: endOfYear(now) };
      case 'last_year':
        return { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) };
      case 'custom':
        return { 
          from: customFrom || startOfYear(now), 
          to: customTo || endOfYear(now) 
        };
    }
  }, [period, customFrom, customTo]);

  // Filter sales
  const filteredSales = useMemo(() => {
    return salesInvoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      try {
        const d = parseISO(inv.issueDate);
        return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
      } catch { return false; }
    });
  }, [salesInvoices, dateRange]);

  // Filter purchases
  const filteredPurchases = useMemo(() => {
    return purchaseInvoices.filter(inv => {
      if (inv.status === 'cancelled') return false;
      try {
        const d = parseISO(inv.issue_date);
        return isWithinInterval(d, { start: dateRange.from, end: dateRange.to });
      } catch { return false; }
    });
  }, [purchaseInvoices, dateRange]);

  // KPIs
  const totalSales = useMemo(() => filteredSales.reduce((s, i) => s + (i.total || 0), 0), [filteredSales]);
  const totalPurchases = useMemo(() => filteredPurchases.reduce((s, i) => s + (i.amount || 0), 0), [filteredPurchases]);
  const grossMargin = totalSales - totalPurchases;
  const ratio = totalSales > 0 ? (totalPurchases / totalSales) * 100 : 0;

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

  // Interannual comparison
  const interannualData = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    const yearData: Record<number, { sales: number; purchases: number }> = {
      [lastYear]: { sales: 0, purchases: 0 },
      [thisYear]: { sales: 0, purchases: 0 },
    };

    salesInvoices.forEach(inv => {
      if (inv.status === 'cancelled') return;
      const y = parseInt(inv.issueDate.substring(0, 4));
      if (yearData[y]) yearData[y].sales += inv.total || 0;
    });

    purchaseInvoices.forEach(inv => {
      if (inv.status === 'cancelled') return;
      const y = parseInt(inv.issue_date.substring(0, 4));
      if (yearData[y]) yearData[y].purchases += inv.amount || 0;
    });

    return [
      { year: String(lastYear), ventas: yearData[lastYear].sales, compras: yearData[lastYear].purchases },
      { year: String(thisYear), ventas: yearData[thisYear].sales, compras: yearData[thisYear].purchases },
    ];
  }, [salesInvoices, purchaseInvoices]);

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
      const variation = prev && prev.margen !== 0
        ? ((m.margen - prev.margen) / Math.abs(prev.margen)) * 100
        : null;
      return { ...m, variation, isNegative: m.margen < 0 };
    });
  }, [monthlyData]);

  // Export functions
  const exportToExcel = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      const data = monthlySummary.map(m => ({
        'Mes': m.month,
        'Ventas': m.ventas,
        'Compras': m.compras,
        'Margen': m.margen,
        'Variación %': m.variation !== null ? `${m.variation.toFixed(1)}%` : 'N/A',
      }));
      data.push({
        'Mes': 'TOTAL',
        'Ventas': totalSales,
        'Compras': totalPurchases,
        'Margen': grossMargin,
        'Variación %': '',
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
      XLSX.writeFile(wb, `resultados-historicos-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Excel exportado correctamente');
    } catch { toast.error('Error al exportar Excel'); }
  }, [monthlySummary, totalSales, totalPurchases, grossMargin]);

  const exportToPDF = useCallback(() => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(18);
      doc.text('Resultados Históricos', 14, 20);
      doc.setFontSize(10);
      doc.text(`Período: ${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`, 14, 30);
      doc.text(`Total Ventas: ${formatCurrency(totalSales)}`, 14, 38);
      doc.text(`Total Compras: ${formatCurrency(totalPurchases)}`, 14, 44);
      doc.text(`Margen Bruto: ${formatCurrency(grossMargin)}`, 14, 50);

      autoTable(doc, {
        startY: 58,
        head: [['Mes', 'Ventas', 'Compras', 'Margen', 'Var. %']],
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

      doc.save(`resultados-historicos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exportado correctamente');
    } catch { toast.error('Error al exportar PDF'); }
  }, [monthlySummary, dateRange, totalSales, totalPurchases, grossMargin]);

  const isLoading = salesLoading || purchasesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {customFrom ? format(customFrom, 'dd/MM/yyyy') : 'Desde'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] text-left text-xs", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {customTo ? format(customTo, 'dd/MM/yyyy') : 'Hasta'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <Badge variant="secondary" className="text-[10px]">
            {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
          </Badge>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportToPDF}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={DollarSign} title="Total Ventas" value={formatCurrency(totalSales)} description={`${filteredSales.length} facturas`} />
        <KPICard icon={ShoppingCart} title="Total Compras" value={formatCurrency(totalPurchases)} description={`${filteredPurchases.length} facturas`} />
        <KPICard 
          icon={TrendingUp} 
          title="Margen Bruto" 
          value={formatCurrency(grossMargin)} 
          description={grossMargin >= 0 ? 'Positivo' : 'Negativo'}
          valueClassName={grossMargin >= 0 ? 'text-green-600' : 'text-destructive'}
        />
        <KPICard icon={Percent} title="Ratio C/V" value={`${ratio.toFixed(1)}%`} description="Compras / Ventas" />
      </div>

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
            <CardTitle className="text-sm font-semibold">Evolución del Margen Bruto</CardTitle>
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
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de proveedores</p>
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
            <CardTitle className="text-sm font-semibold">Comparación Interanual</CardTitle>
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
              <Trophy className="h-4 w-4 text-yellow-500" /> Top 5 Clientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topClients.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : topClients.map((c, i) => {
              const maxVal = topClients[0]?.total || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-[10px] shrink-0">{i + 1}</Badge>
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
              <Building2 className="h-4 w-4 text-blue-500" /> Top 5 Proveedores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topSuppliers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos</p>
            ) : topSuppliers.map((s, i) => {
              const maxVal = topSuppliers[0]?.total || 1;
              return (
                <div key={i} className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-[10px] shrink-0">{i + 1}</Badge>
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
          <Table>
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
                <TableRow key={i} className={m.isNegative ? 'bg-destructive/5' : ''}>
                  <TableCell className="text-xs font-medium capitalize">
                    {m.isNegative && <AlertTriangle className="h-3 w-3 text-destructive inline mr-1" />}
                    {m.month}
                  </TableCell>
                  <TableCell className="text-xs text-right">{formatCurrency(m.ventas)}</TableCell>
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
}> = ({ icon: Icon, title, value, description, valueClassName }) => (
  <Card className="bg-card border overflow-hidden">
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className={cn("text-lg sm:text-2xl font-bold truncate", valueClassName || 'text-foreground')}>{value}</div>
      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{description}</p>
    </CardContent>
  </Card>
);
