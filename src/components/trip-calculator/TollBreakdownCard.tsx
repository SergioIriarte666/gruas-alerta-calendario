import { AlertTriangle, CheckCircle2, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TollResultV2 } from '@/hooks/useTollCalculationV2';

const formatClp = (amount: number) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);

const CATEGORY_LABELS: Record<string, string> = {
  LIVIANO: 'Liviano',
  CAMION_2_EJES: 'Camión 2 Ejes',
  CAMION_PESADO: 'Camión Pesado',
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  route_geometry: {
    label: 'Ruta real + coordenadas',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  getapi_matched: {
    label: 'Ruta exacta verificada',
    color: 'bg-green-100 text-green-800 border-green-300',
  },
  fallback_range: {
    label: 'Estimación por tramo',
    color: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  manual: {
    label: 'Ingreso manual',
    color: 'bg-slate-100 text-slate-800 border-slate-300',
  },
};

interface TollBreakdownCardProps {
  result: TollResultV2;
}

export const TollBreakdownCard = ({ result }: TollBreakdownCardProps) => {
  const sourceInfo = SOURCE_LABELS[result.source];

  return (
    <Card className="border-2 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="size-4 text-amber-600" />
            Desglose de peajes
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-normal">
              {CATEGORY_LABELS[result.category] ?? result.category}
            </Badge>
            {sourceInfo && (
              <Badge variant="outline" className={`text-xs font-normal ${sourceInfo.color}`}>
                {sourceInfo.label}
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {result.warning && (
          <Alert className="py-2">
            <AlertTriangle className="size-3.5" />
            <AlertDescription className="text-xs">{result.warning}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-1">
          {result.breakdown.map((item, index) => (
            <div
              key={`${item.stationName}-${item.vehicleCategory}-${index}`}
              className="flex items-center justify-between border-b py-1 text-sm last:border-0"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="px-1.5 text-xs font-normal">
                  {item.stationType}
                </Badge>
                <span className="text-foreground">{item.stationName}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  — {item.concessionName}
                </span>
              </div>
              <span className="font-mono text-sm font-medium">{formatClp(item.rateAmount)}</span>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-t-2 pt-1.5">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Ida ({CATEGORY_LABELS[result.category] ?? result.category})</span>
            <span className="font-mono">{formatClp(result.idaCost)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Vuelta ({CATEGORY_LABELS[result.returnCategory] ?? result.returnCategory})</span>
            <span className="font-mono">{formatClp(result.vueltaCost)}</span>
          </div>
          <div className="flex items-center justify-between border-t pt-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CheckCircle2 className="size-4 text-green-600" />
              Total peajes (ida + vuelta)
            </div>
            <span className="font-mono text-base font-bold">{formatClp(result.totalCost)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
