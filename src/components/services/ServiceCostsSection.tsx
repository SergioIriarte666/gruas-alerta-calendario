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

export const ServiceCostsSection = ({ serviceId, enhancedService }: ServiceCostsSectionProps) => {
  console.log('[ServiceCostsSection] Rendered for serviceId:', serviceId);
  console.log('[ServiceCostsSection] Enhanced service provided:', !!enhancedService);
  
  const { data: costs, isLoading, error } = useServiceCosts(serviceId);
  
  // Usar datos del enhanced service si están disponibles
  const allCosts = enhancedService?.serviceCosts || costs || [];
  const operatorsData = enhancedService?.operators || [];
  const totalCommissions = enhancedService?.totalCommissions || 0;
  const totalServiceCosts = enhancedService?.totalCosts || 0;
  
  console.log('[ServiceCostsSection] Using enhanced data:', {
    allCostsCount: allCosts.length,
    operatorsCount: operatorsData.length,
    totalCommissions,
    totalServiceCosts,
    fallbackToRegularCosts: !enhancedService
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const totalCosts = allCosts.reduce((sum, cost) => sum + Number(cost.amount), 0) || 0;
  const grandTotal = totalCosts + totalCommissions;

  // Group costs by category for better visualization
  const costsByCategory = allCosts.reduce((acc, cost) => {
    const categoryName = cost.cost_categories?.name || 'Sin categoría';
    if (!acc[categoryName]) {
      acc[categoryName] = [];
    }
    acc[categoryName].push(cost);
    return acc;
  }, {} as Record<string, typeof allCosts>) || {};

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (error) {
    console.error('[ServiceCostsSection] Error loading costs:', error);
    return (
      <div className="flex items-center space-x-2 text-red-400">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-sm">Error al cargar los costos del servicio</span>
      </div>
    );
  }

  if (!allCosts || (allCosts.length === 0 && operatorsData.length === 0)) {
    return (
      <div className="text-center py-6 text-gray-400">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay costos ni comisiones registrados para este servicio</p>
        <p className="text-xs text-gray-500 mt-1">
          Los costos se pueden agregar desde el formulario de edición del servicio
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen de costos */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-red-400" />
            <span className="font-medium text-white">Total de Costos</span>
          </div>
          <span className="text-lg font-bold text-red-400">
            {formatCurrency(grandTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-400 mt-2">
          <span>{allCosts.length + operatorsData.length} costo{(allCosts.length + operatorsData.length) !== 1 ? 's' : ''} registrado{(allCosts.length + operatorsData.length) !== 1 ? 's' : ''}</span>
          <span>{Object.keys(costsByCategory).length + (operatorsData.length > 0 ? 1 : 0)} categoría{(Object.keys(costsByCategory).length + (operatorsData.length > 0 ? 1 : 0)) !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Resumen por categorías */}
      {(Object.keys(costsByCategory).length > 1 || operatorsData.length > 0) && (
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2 mb-3">
            <TrendingDown className="w-4 h-4 text-blue-400" />
            <span className="font-medium text-white text-sm">Resumen por Categoría</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {operatorsData.length > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400 truncate">Comisión Operador:</span>
                <span className="text-red-400 font-medium">{formatCurrency(totalCommissions)}</span>
              </div>
            )}
            {Object.entries(costsByCategory).map(([category, categoryCosts]) => {
              const categoryTotal = categoryCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
              return (
                <div key={category} className="flex justify-between text-sm">
                  <span className="text-gray-400 truncate">{category}:</span>
                  <span className="text-red-400 font-medium">{formatCurrency(categoryTotal)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sección de comisiones de operadores */}
      {operatorsData.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-white text-sm border-b border-gray-700 pb-1">
            Comisión Operador ({operatorsData.length} costo{operatorsData.length !== 1 ? 's' : ''})
          </h4>
          
          {operatorsData.map((operatorData) => (
            <div key={operatorData.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h5 className="font-medium text-white">Comisión operador - Servicio {enhancedService?.folio || serviceId}</h5>
                    <Badge variant="outline" className="text-xs">
                      comisiones
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400">
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
                  <span className="text-lg font-bold text-red-400">
                    {formatCurrency(operatorData.commission || 0)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de costos agrupados por categoría */}
      {Object.keys(costsByCategory).length > 0 && (
        <div className="space-y-4">
          {Object.entries(costsByCategory).map(([category, categoryCosts]) => (
            <div key={category} className="space-y-2">
              <h4 className="font-medium text-white text-sm border-b border-gray-700 pb-1">
                {category} ({categoryCosts.length} costo{categoryCosts.length !== 1 ? 's' : ''})
              </h4>
              
              {categoryCosts.map((cost) => (
                <div key={cost.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h5 className="font-medium text-white">{cost.description}</h5>
                        {cost.subcategory && (
                          <Badge variant="outline" className="text-xs">
                            {cost.subcategory}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400">
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
                        <p className="text-sm text-gray-300 mt-2 italic">
                          {cost.notes}
                        </p>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <span className="text-lg font-bold text-red-400">
                        {formatCurrency(Number(cost.amount))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};