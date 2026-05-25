import React from 'react';
import { useServiceCosts } from '@/hooks/useServiceCosts';
import { EnhancedService } from '@/types/serviceDetails';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { DollarSign, FileText, AlertTriangle, Calculator, TrendingDown, Users } from 'lucide-react';

interface ServiceCostsSectionProps {
  serviceId: string;
  enhancedService?: EnhancedService | null;
}

const CATEGORY_COLORS = [
  { border: 'border-l-blue-500', bg: 'bg-blue-500/5', text: 'text-blue-700 dark:text-blue-300', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', dot: 'bg-blue-500' },
  { border: 'border-l-orange-500', bg: 'bg-orange-500/5', text: 'text-orange-700 dark:text-orange-300', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', dot: 'bg-orange-500' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { border: 'border-l-rose-500', bg: 'bg-rose-500/5', text: 'text-rose-700 dark:text-rose-300', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300', dot: 'bg-rose-500' },
  { border: 'border-l-amber-500', bg: 'bg-amber-500/5', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', dot: 'bg-amber-500' },
  { border: 'border-l-cyan-500', bg: 'bg-cyan-500/5', text: 'text-cyan-700 dark:text-cyan-300', badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300', dot: 'bg-cyan-500' },
];

const COMMISSION_COLOR = {
  border: 'border-l-violet-500', bg: 'bg-violet-500/5', text: 'text-violet-700 dark:text-violet-300', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', dot: 'bg-violet-500',
};

export const ServiceCostsSection = ({ serviceId, enhancedService }: ServiceCostsSectionProps) => {
  const { data: costs, isLoading, error } = useServiceCosts(serviceId);
  
  const allCosts = enhancedService?.serviceCosts || costs || [];
  const operatorsData = enhancedService?.operators || [];
  const totalCommissions = enhancedService?.totalCommissions || 0;
  const totalServiceCosts = enhancedService?.totalCosts || 0;

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
      <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
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
        <div className="bg-muted/50 rounded-lg p-4 border border-border">
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
