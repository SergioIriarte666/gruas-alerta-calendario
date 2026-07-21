import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Info, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLowboyIva, type LowboyIvaMonth } from '@/hooks/useSiiRcv';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { generateLowboyIvaPdf } from '@/utils/pdf/lowboyIvaPdfGenerator';

const ALL_YEARS = 'all';
const ALL_MONTHS = 'all';

/** 'MM' → 'Enero' (nombre de mes en español, sin corrimiento de zona horaria). */
const monthName = (mm: string): string => {
  const l = safeParseDateOnly(`2000-${mm}-01`).toLocaleDateString('es-CL', { month: 'long' });
  return l.charAt(0).toUpperCase() + l.slice(1);
};

const formatCLP = (value: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);

/** 'YYYY-MM' → 'julio 2026' (fecha civil, sin corrimiento de zona horaria). */
const monthLabel = (ym: string): string => {
  const label = safeParseDateOnly(`${ym}-01`).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

/** Mes siguiente en formato 'YYYY-MM' mediante aritmética pura de string (sin Date). */
const nextMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
};

const DISCLAIMER =
  'Estimación según RCV importado. El F29 real puede diferir (PPM, retenciones, IVA de uso común, ' +
  'remanente reajustado por UTM). Verificar que el período esté completamente importado antes de declarar.';

function HeroCard({ latest }: { latest: LowboyIvaMonth }) {
  const debePagar = latest.ivaPagar > 0;
  const f29Month = monthLabel(nextMonth(latest.month));

  return (
    <Card
      className={`overflow-hidden border-2 ${
        debePagar
          ? 'border-warning/60 bg-warning-soft'
          : 'border-success/60 bg-success-soft'
      }`}
    >
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start gap-3">
          {debePagar ? (
            <TrendingUp className="mt-1 size-6 shrink-0 text-warning" />
          ) : (
            <TrendingDown className="mt-1 size-6 shrink-0 text-success" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {debePagar
                ? `IVA a pagar en F29 de ${f29Month}`
                : `F29 de ${f29Month} — sin pago`}
            </p>
            <p
              className={`mt-1 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl ${
                debePagar ? 'text-warning' : 'text-success'
              }`}
            >
              {debePagar ? formatCLP(latest.ivaPagar) : formatCLP(latest.remanenteSiguiente)}
            </p>
            {!debePagar && (
              <p className="mt-1 text-sm font-semibold text-success">
                Remanente a favor para el mes siguiente
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground sm:text-sm">
              Período {monthLabel(latest.month)} · Débito {formatCLP(latest.ivaDebito)} · Crédito{' '}
              {formatCLP(latest.ivaCredito)} · Remanente usado {formatCLP(latest.remanenteAnterior)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyTable({ months }: { months: LowboyIvaMonth[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mes</TableHead>
                <TableHead className="text-right">IVA débito</TableHead>
                <TableHead className="text-right">IVA crédito</TableHead>
                <TableHead className="text-right">Remanente anterior</TableHead>
                <TableHead className="text-right">IVA a pagar</TableHead>
                <TableHead className="text-right">Remanente siguiente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="whitespace-nowrap font-medium">{monthLabel(m.month)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatCLP(m.ivaDebito)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatCLP(m.ivaCredito)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">{formatCLP(m.remanenteAnterior)}</TableCell>
                  <TableCell
                    className={`whitespace-nowrap text-right font-bold ${
                      m.ivaPagar > 0 ? 'text-warning' : 'text-muted-foreground'
                    }`}
                  >
                    {formatCLP(m.ivaPagar)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {m.remanenteSiguiente > 0 ? (
                      <span className="text-success">{formatCLP(m.remanenteSiguiente)}</span>
                    ) : (
                      formatCLP(0)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyCards({ months }: { months: LowboyIvaMonth[] }) {
  return (
    <div className="space-y-3">
      {months.map((m) => (
        <Card key={m.month}>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{monthLabel(m.month)}</span>
              <span className={`text-lg font-bold ${m.ivaPagar > 0 ? 'text-warning' : 'text-success'}`}>
                {m.ivaPagar > 0 ? formatCLP(m.ivaPagar) : formatCLP(0)}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">IVA débito</dt>
              <dd className="text-right">{formatCLP(m.ivaDebito)}</dd>
              <dt className="text-muted-foreground">IVA crédito</dt>
              <dd className="text-right">{formatCLP(m.ivaCredito)}</dd>
              <dt className="text-muted-foreground">Remanente anterior</dt>
              <dd className="text-right">{formatCLP(m.remanenteAnterior)}</dd>
              <dt className="text-muted-foreground">Remanente siguiente</dt>
              <dd className="text-right text-success">{formatCLP(m.remanenteSiguiente)}</dd>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DetailSection({ months }: { months: LowboyIvaMonth[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
          <span className="text-sm font-semibold">Detalle compra/venta</span>
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Ventas netas</TableHead>
                    <TableHead className="text-right">Compras netas</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {months.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell className="whitespace-nowrap font-medium">{monthLabel(m.month)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{formatCLP(m.ventasNet)}</TableCell>
                      <TableCell className="whitespace-nowrap text-right">{formatCLP(m.comprasNet)}</TableCell>
                      <TableCell
                        className={`whitespace-nowrap text-right font-medium ${
                          m.resultado >= 0 ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {formatCLP(m.resultado)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

interface LowboyIvaPanelProps {
  entityRut: string;
}

export function LowboyIvaPanel({ entityRut }: LowboyIvaPanelProps) {
  const isMobile = useIsMobile();
  const { data, isLoading } = useLowboyIva(entityRut.trim());
  const [exporting, setExporting] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>(ALL_YEARS);
  const [selectedMonth, setSelectedMonth] = useState<string>(ALL_MONTHS);
  const [yearInitialized, setYearInitialized] = useState(false);

  // Años presentes en los datos, del más reciente al más antiguo.
  const years = useMemo(
    () => (data ? [...new Set(data.months.map((m) => m.month.slice(0, 4)))].sort((a, b) => b.localeCompare(a)) : []),
    [data],
  );

  // Meses (MM) presentes en el año seleccionado, del más reciente al más antiguo.
  const monthsOfYear = useMemo(() => {
    if (!data || selectedYear === ALL_YEARS) return [];
    return [...new Set(
      data.months.filter((m) => m.month.slice(0, 4) === selectedYear).map((m) => m.month.slice(5, 7)),
    )].sort((a, b) => b.localeCompare(a));
  }, [data, selectedYear]);

  // Por defecto, el año más reciente con datos (el héroe muestra el F29 vigente).
  useEffect(() => {
    if (yearInitialized || years.length === 0) return;
    setSelectedYear(years[0]);
    setYearInitialized(true);
  }, [years, yearInitialized]);

  // Cambiar de año (o volver a "Todos los años") reinicia el mes a "Todos".
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setSelectedMonth(ALL_MONTHS);
  };

  // Filtro de vista. El arrastre de remanente ya viene calculado sobre el historial
  // completo desde useLowboyIva; aquí solo se acota qué meses se muestran/exportan.
  const filteredMonths = useMemo(() => {
    if (!data) return [];
    return data.months.filter((m) => {
      if (selectedYear !== ALL_YEARS && m.month.slice(0, 4) !== selectedYear) return false;
      if (selectedMonth !== ALL_MONTHS && m.month.slice(5, 7) !== selectedMonth) return false;
      return true;
    });
  }, [data, selectedYear, selectedMonth]);
  const filteredLatest = filteredMonths.length > 0 ? filteredMonths[filteredMonths.length - 1] : null;

  const handleExport = async () => {
    if (!filteredLatest || filteredMonths.length === 0) return;
    setExporting(true);
    try {
      const blob = await generateLowboyIvaPdf({
        entityRut: entityRut.trim(),
        months: filteredMonths,
        latest: filteredLatest,
        monthKeys: filteredMonths.map((m) => m.month),
      });
      const suffix = selectedYear === ALL_YEARS
        ? 'historico'
        : selectedMonth === ALL_MONTHS ? selectedYear : `${selectedYear}-${selectedMonth}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Informe_IVA_LowBoy_${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Informe de IVA exportado.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No fue posible exportar el PDF.');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Calculando IVA…
      </div>
    );
  }

  if (!data || data.months.length === 0 || !filteredLatest) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <Info className="size-8 text-muted-foreground" />
          <p className="font-medium">Sin registros para calcular el IVA</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Importa el RCV de compras y ventas en la pestaña «Importar / Registros» para ver el IVA a pagar por período.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Tabla/cards en orden descendente (mes más reciente primero).
  const monthsDesc = [...filteredMonths].reverse();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="w-36" aria-label="Filtrar por año">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_YEARS}>Todos los años</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
            disabled={selectedYear === ALL_YEARS || monthsOfYear.length === 0}
          >
            <SelectTrigger className="w-40" aria-label="Filtrar por mes">
              <SelectValue placeholder="Todos los meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MONTHS}>Todos los meses</SelectItem>
              {monthsOfYear.map((mm) => (
                <SelectItem key={mm} value={mm}>{monthName(mm)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
          Exportar PDF
        </Button>
      </div>

      <HeroCard latest={filteredLatest} />

      {isMobile ? <MonthlyCards months={monthsDesc} /> : <MonthlyTable months={monthsDesc} />}

      <DetailSection months={monthsDesc} />

      <p className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{DISCLAIMER}</span>
      </p>
    </div>
  );
}
