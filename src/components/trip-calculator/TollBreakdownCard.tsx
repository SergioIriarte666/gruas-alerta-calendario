import { CheckCircle2, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { TollResultV3 } from '@/hooks/useTollCalculationV3';

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

interface TollBreakdownCardProps {
  result: TollResultV3;
}

export const TollBreakdownCard = ({ result }: TollBreakdownCardProps) => {
  const noTolls = result.totalCost === 0;

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
            <Badge
              variant="outline"
              className="text-xs font-normal bg-green-100 text-green-800 border-green-300"
            >
              Tarifas oficiales (GetAPI)
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {noTolls ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-green-600" />
            Sin peajes detectados en esta ruta
          </div>
        ) : (
          <div className="space-y-1">
            {result.breakdown.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-center justify-between border-b py-1 text-sm last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{item.name}</span>
                  {item.highway && (
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      — {item.highway}
                    </span>
                  )}
                </div>
                <span className="font-mono text-sm font-medium">{formatClp(item.amount)}</span>
              </div>
            ))}
          </div>
        )}

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
