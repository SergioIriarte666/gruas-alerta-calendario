import { businessClock } from '@/utils/businessClock';
import { useServiceCosts } from '@/hooks/useServiceCosts';
import { EnhancedService } from '@/types/serviceDetails';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { FileText, AlertTriangle, Calculator, TrendingDown, Info, Users } from 'lucide-react';

interface ServiceCostsSectionProps {
  serviceId: string;
  enhancedService?: EnhancedService | null;
}

const CATEGORY_COLORS = [
  { border: 'border-l-info', bg: 'bg-info/5', text: 'text-info', badge: 'bg-info/10 text-info border-0', dot: 'bg-info' },
  { border: 'border-l-warning', bg: 'bg-warning/5', text: 'text-warning', badge: 'bg-warning/10 text-warning border-0', dot: 'bg-warning' },
  { border: 'border-l-success', bg: 'bg-success/5', text: 'text-success', badge: 'bg-success/10 text-success border-0', dot: 'bg-success' },
  { border: 'border-l-danger', bg: 'bg-danger/5', text: 'text-danger', badge: 'bg-danger/10 text-danger border-0', dot: 'bg-danger' },
  { border: 'border-l-primary', bg: 'bg-primary/5', text: 'text-primary', badge: 'bg-primary/10 text-primary border-0', dot: 'bg-primary' },
  { border: 'border-l-muted-foreground', bg: 'bg-muted/40', text: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground border-0', dot: 'bg-muted-foreground' },
];

const COMMISSION_COLOR = {
  border: 'border-l-primary', bg: 'bg-primary/5', text: 'text-primary', badge: 'bg-primary/10 text-primary border-0', dot: 'bg-primary',
};

export const ServiceCostsSection = ({ serviceId, enhancedService }: ServiceCostsSectionProps) => {
  const { data: costs, isLoading, error } = useServiceCosts(serviceId);
  
  const allCosts = enhancedService?.serviceCosts || costs || [];
  const operatorsData = enhancedService?.operators || [];
  const totalCommissions = enhancedService?.totalCommissions || 0;
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const totalCosts = allCosts.reduce((sum, cost) => sum + Number(cost.amount), 0) || 0;
  const grandTotal = totalCosts + totalCommissions;

  const costsByCategory = allCosts.reduce((acc, cost) => {
    const categoryName = cost.cost_categories?.name || 'Sin categoría';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(cost);
    return acc;
  }, {} as Record<string, typeof allCosts>) || {};

  // Costeo por tramo: cuando hay relevo de operadores, el dueño necesita ver
  // quién gastó qué. Filas por concepto, columnas por operador, gran total —
  // el formato de la planilla con la que ya trabaja. Los costos sin operador
  // asignado caen en su propia columna en vez de desaparecer del cuadre.
  const UNASSIGNED_OPERATOR = '__sin_operador__';

  const operatorColumns = (() => {
    const seen = new Map<string, string>();
    allCosts.forEach(cost => {
      const id = cost.operator_id || UNASSIGNED_OPERATOR;
      if (!seen.has(id)) {
        seen.set(id, cost.operators?.name || 'Sin operador');
      }
    });
    // Con un solo operador (o ninguno) el cuadro no aporta nada que el listado
    // no diga ya: solo aparece cuando hay más de uno con costos.
    const realOperators = [...seen.keys()].filter(id => id !== UNASSIGNED_OPERATOR);
    if (realOperators.length < 2) return [];
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  })();

  const costsByConcept = operatorColumns.length > 0
    ? Object.entries(
        allCosts.reduce((acc, cost) => {
          const concept = cost.description?.trim() || 'Sin descripción';
          if (!acc[concept]) acc[concept] = {};
          const operatorKey = cost.operator_id || UNASSIGNED_OPERATOR;
          acc[concept][operatorKey] = (acc[concept][operatorKey] || 0) + Number(cost.amount);
          return acc;
        }, {} as Record<string, Record<string, number>>)
      )
    : [];

  const operatorTotals = operatorColumns.map(column => ({
    ...column,
    total: allCosts
      .filter(cost => (cost.operator_id || UNASSIGNED_OPERATOR) === column.id)
      .reduce((sum, cost) => sum + Number(cost.amount), 0),
  }));

  // Assign colors to categories
  const categoryKeys = Object.keys(costsByCategory);
  const categoryColorMap: Record<string, typeof CATEGORY_COLORS[0]> = {};
  categoryKeys.forEach((key, i) => {
    categoryColorMap[key] = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-x-2 text-destructive">
        <AlertTriangle className="size-4" />
        <span className="text-sm">Error al cargar los costos del servicio</span>
      </div>
    );
  }

  const hasCommissions = operatorsData.some(op => (op.commission || 0) > 0);

  if (!allCosts || (allCosts.length === 0 && !hasCommissions)) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <FileText className="size-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay costos ni comisiones registrados para este servicio</p>
        <p className="text-xs text-muted-foreground mt-1">
          Los costos se pueden agregar desde el formulario de edición del servicio
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen total */}
      <div className="rounded-lg border border-danger/20 bg-danger/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-2">
            <div className="p-1.5 rounded-lg bg-destructive/20">
              <Calculator className="size-5 text-destructive" />
            </div>
            <span className="font-semibold text-foreground">Total de Costos</span>
          </div>
          <span className="text-xl font-bold text-destructive">
            {formatCurrency(grandTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground mt-2">
          <span>{allCosts.length + (hasCommissions ? operatorsData.length : 0)} costo{(allCosts.length + (hasCommissions ? operatorsData.length : 0)) !== 1 ? 's' : ''} registrado{(allCosts.length + (hasCommissions ? operatorsData.length : 0)) !== 1 ? 's' : ''}</span>
          <span>{categoryKeys.length + (hasCommissions ? 1 : 0)} categoría{(categoryKeys.length + (hasCommissions ? 1 : 0)) !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Resumen por categorías */}
      {(categoryKeys.length > 1 || hasCommissions) && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-x-2 mb-3">
            <TrendingDown className="size-4 text-primary" />
            <span className="font-medium text-foreground text-sm">Resumen por Categoría</span>
          </div>
          <div className="space-y-2">
            {hasCommissions && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${COMMISSION_COLOR.dot}`} />
                  <span className="text-muted-foreground">Comisión Operador</span>
                </div>
                <span className={`font-semibold ${COMMISSION_COLOR.text}`}>{formatCurrency(totalCommissions)}</span>
              </div>
            )}
            {Object.entries(costsByCategory).map(([category, categoryCosts]) => {
              const categoryTotal = categoryCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
              const color = categoryColorMap[category];
              return (
                <div key={category} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`size-2.5 rounded-full ${color.dot}`} />
                    <span className="text-muted-foreground truncate">{category}</span>
                  </div>
                  <span className={`font-semibold ${color.text}`}>{formatCurrency(categoryTotal)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Costos por operador (solo con relevo: más de un operador con gastos) */}
      {operatorColumns.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center gap-x-2 mb-3">
            <Users className="size-4 text-primary" />
            <span className="font-medium text-foreground text-sm">Costos por operador</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Concepto</th>
                  {operatorColumns.map(column => (
                    <th key={column.id} className="pb-2 px-3 text-right font-medium text-muted-foreground whitespace-nowrap">
                      {column.name}
                    </th>
                  ))}
                  <th className="pb-2 pl-3 text-right font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {costsByConcept.map(([concept, amounts]) => {
                  const conceptTotal = Object.values(amounts).reduce((sum, value) => sum + value, 0);
                  return (
                    <tr key={concept} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-foreground">{concept}</td>
                      {operatorColumns.map(column => (
                        <td key={column.id} className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                          {amounts[column.id] ? formatCurrency(amounts[column.id]) : '—'}
                        </td>
                      ))}
                      <td className="py-2 pl-3 text-right tabular-nums font-medium text-foreground">
                        {formatCurrency(conceptTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border">
                  <td className="pt-2 pr-4 font-semibold text-foreground">Total por operador</td>
                  {operatorTotals.map(column => (
                    <td key={column.id} className="pt-2 px-3 text-right tabular-nums font-semibold text-foreground">
                      {formatCurrency(column.total)}
                    </td>
                  ))}
                  <td className="pt-2 pl-3 text-right tabular-nums font-bold text-destructive">
                    {formatCurrency(totalCosts)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            No incluye comisiones: se listan aparte porque las genera el cierre del servicio.
          </p>
        </div>
      )}

      {/* Comisiones de operadores */}
      {hasCommissions && (
        <div className="space-y-2">
          <h4 className={`font-semibold text-sm pb-1 flex items-center gap-2 ${COMMISSION_COLOR.text}`}>
            <span className={`w-1 h-4 rounded-full ${COMMISSION_COLOR.dot}`} />
            Comisión Operador ({operatorsData.length} costo{operatorsData.length !== 1 ? 's' : ''})
          </h4>
          
          <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-primary">
            <Info className="size-3.5 mt-0.5 shrink-0" />
            <span>Esta comisión también aparece en el módulo de <strong>Costos</strong> como categoría "Comisión Operador".</span>
          </div>

          {operatorsData.map((operatorData) => (
            <div key={operatorData.id} className={`rounded-lg p-4 border border-border border-l-4 ${COMMISSION_COLOR.border} ${COMMISSION_COLOR.bg}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-x-2 mb-2">
                    <h5 className="font-medium text-foreground">Comisión operador - Servicio {enhancedService?.folio || serviceId}</h5>
                    <Badge className={`text-xs border-0 ${COMMISSION_COLOR.badge}`}>
                      comisiones
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium">Fecha:</span>{' '}
                      {formatForDisplay(businessClock.nowISO())}
                    </p>
                    <p>
                      <span className="font-medium">Operador:</span>{' '}
                      {operatorData.operator?.name || 'N/A'}
                    </p>
                    <p>
                      <span className="font-medium">Folio:</span>{' '}
                      {enhancedService?.folio || serviceId}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className={`text-lg font-bold ${COMMISSION_COLOR.text}`}>
                    {formatCurrency(operatorData.commission || 0)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Costos agrupados por categoría */}
      {categoryKeys.length > 0 && (
        <div className="space-y-4">
          {Object.entries(costsByCategory).map(([category, categoryCosts]) => {
            const color = categoryColorMap[category];
            return (
              <div key={category} className="space-y-2">
                <h4 className={`font-semibold text-sm pb-1 flex items-center gap-2 ${color.text}`}>
                  <span className={`w-1 h-4 rounded-full ${color.dot}`} />
                  {category} ({categoryCosts.length} costo{categoryCosts.length !== 1 ? 's' : ''})
                </h4>
                
                {categoryCosts.map((cost) => (
                  <div key={cost.id} className={`rounded-lg p-4 border border-border border-l-4 ${color.border} ${color.bg}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-x-2 mb-2">
                          <h5 className="font-medium text-foreground">{cost.description}</h5>
                          {cost.subcategory && (
                            <Badge className={`text-xs border-0 ${color.badge}`}>
                              {cost.subcategory}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <p>
                            <span className="font-medium">Fecha:</span>{' '}
                            {formatForDisplay(cost.date)}
                          </p>
                          
                          {cost.cranes && (
                            <p>
                              <span className="font-medium">Grúa:</span>{' '}
                              {cost.cranes.brand} {cost.cranes.model} ({cost.cranes.license_plate})
                            </p>
                          )}
                          
                          {cost.operators && (
                            <p>
                              <span className="font-medium">Operador:</span>{' '}
                              {cost.operators.name}
                            </p>
                          )}

                          {cost.service_folio && (
                            <p>
                              <span className="font-medium">Folio:</span>{' '}
                              {cost.service_folio}
                            </p>
                          )}
                        </div>

                        {cost.notes && (
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            {cost.notes}
                          </p>
                        )}
                      </div>
                      
                      <div className="text-right">
                        <span className={`text-lg font-bold ${color.text}`}>
                          {formatCurrency(Number(cost.amount))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
