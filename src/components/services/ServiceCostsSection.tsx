import { useServiceCosts } from '@/hooks/useServiceCosts';
import { EnhancedService } from '@/types/serviceDetails';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { FileText, AlertTriangle, Calculator, TrendingDown, Info } from 'lucide-react';

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
            <div className="p-1.5 rounded-lg bg-destructive/15">
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

      {/* Comisiones de operadores */}
      {hasCommissions && (
        <div className="space-y-2">
          <h4 className={`font-semibold text-sm pb-1 flex items-center gap-2 ${COMMISSION_COLOR.text}`}>
            <span className={`w-1 h-4 rounded-full ${COMMISSION_COLOR.dot}`} />
            Comisión Operador ({operatorsData.length} costo{operatorsData.length !== 1 ? 's' : ''})
          </h4>
          
          <div className="flex items-start gap-2 rounded-lg bg-violet-500/5 border border-violet-500/20 px-3 py-2 text-xs text-violet-700 dark:text-violet-400">
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
                      {formatForDisplay(new Date())}
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
                            {formatForDisplay(parseFromDatabase(cost.date))}
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
