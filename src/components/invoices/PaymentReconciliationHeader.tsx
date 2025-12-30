import { Button } from '@/components/ui/button';
import { Plus, History, RefreshCw, Eye, EyeOff, LayoutGrid, List } from 'lucide-react';
import { PaymentDateFilter } from './PaymentQuickFilters';

interface PaymentReconciliationHeaderProps {
  onRegisterPayment: () => void;
  onShowHistory: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
  viewMode?: 'table' | 'cards';
  onViewModeChange?: (mode: 'table' | 'cards') => void;
  activeDateFilter?: PaymentDateFilter;
  showSensitiveData?: boolean;
  onToggleSensitiveData?: () => void;
}

const getActivePeriodLabel = (filter: PaymentDateFilter): string => {
  switch (filter) {
    case 'today': return 'Hoy';
    case 'week': return 'Esta Semana';
    case 'month': return 'Este Mes';
    default: return 'Todos';
  }
};

export const PaymentReconciliationHeader = ({
  onRegisterPayment,
  onShowHistory,
  onRefresh,
  isLoading = false,
  viewMode = 'table',
  onViewModeChange,
  activeDateFilter = 'all',
  showSensitiveData = true,
  onToggleSensitiveData,
}: PaymentReconciliationHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">Conciliación de Pagos</h2>
          {activeDateFilter !== 'all' && (
            <span className="px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">
              {getActivePeriodLabel(activeDateFilter)}
            </span>
          )}
        </div>
        <p className="text-muted-foreground mt-1">
          Gestiona la aplicación de pagos a facturas
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle datos sensibles */}
        {onToggleSensitiveData && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSensitiveData}
            className="text-muted-foreground hover:text-foreground"
            title={showSensitiveData ? 'Ocultar montos' : 'Mostrar montos'}
          >
            {showSensitiveData ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Toggle vista */}
        {onViewModeChange && (
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('table')}
              className="h-7 px-2"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('cards')}
              className="h-7 px-2"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        )}

        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>

        <Button
          onClick={onShowHistory}
          variant="outline"
          size="sm"
        >
          <History className="h-4 w-4 mr-2" />
          Historial
        </Button>

        <Button
          onClick={onRegisterPayment}
          size="sm"
          className="bg-violet-600 hover:bg-violet-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Registrar Pago
        </Button>
      </div>
    </div>
  );
};
