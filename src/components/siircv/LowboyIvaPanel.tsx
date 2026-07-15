import { useState } from 'react';
import { ChevronDown, Download, Info, Loader2, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLowboyIva, type LowboyIvaMonth } from '@/hooks/useSiiRcv';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { generateLowboyIvaPdf } from '@/utils/pdf/lowboyIvaPdfGenerator';

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
          ? 'border-orange-500/60 bg-orange-500/5'
          : 'border-emerald-500/60 bg-emerald-500/5'
      }`}
    >
      <CardContent className="p-6 sm:p-8">
        <div className="flex items-start gap-3">
          {debePagar ? (
            <TrendingUp className="mt-1 size-6 shrink-0 text-orange-600" />
          ) : (
            <TrendingDown className="mt-1 size-6 shrink-0 text-emerald-600" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {debePagar
                ? `IVA a pagar en F29 de ${f29Month}`
                : `F29 de ${f29Month} — sin pago`}
            </p>
            <p
              className={`mt-1 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl ${
                debePagar ? 'text-orange-600' : 'text-emerald-600'
              }`}
            >
              {debePagar ? formatCLP(latest.ivaPagar) : formatCLP(latest.remanenteSiguiente)}
            </p>
            {!debePagar && (
              <p className="mt-1 text-sm font-semibold text-emerald-600">
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
                      m.ivaPagar > 0 ? 'text-orange-600' : 'text-muted-foreground'
                    }`}
                  >
                    {formatCLP(m.ivaPagar)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {m.remanenteSiguiente > 0 ? (
                      <span className="text-emerald-600">{formatCLP(m.remanenteSiguiente)}</span>
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
              <span className={`text-lg font-bold ${m.ivaPagar > 0 ? 'text-orange-600' : 'text-emerald-600'}`}>
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
              <dd className="text-right text-emerald-600">{formatCLP(m.remanenteSiguiente)}</dd>
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
                          m.resultado >= 0 ? 'text-emerald-600' : 'text-destructive'
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

  const handleExport = async () => {
    if (!data?.latest || data.months.length === 0) return;
    setExporting(true);
    try {
      const blob = await generateLowboyIvaPdf({
        entityRut: entityRut.trim(),
        months: data.months,
        latest: data.latest,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Informe_IVA_LowBoy_${data.latest.month}.pdf`;
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

  if (!data || data.months.length === 0 || !data.latest) {
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
  const monthsDesc = [...data.months].reverse();

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />}
          Exportar PDF
        </Button>
      </div>

      <HeroCard latest={data.latest} />

      {isMobile ? <MonthlyCards months={monthsDesc} /> : <MonthlyTable months={monthsDesc} />}

      <DetailSection months={monthsDesc} />

      <p className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>{DISCLAIMER}</span>
      </p>
    </div>
  );
}
