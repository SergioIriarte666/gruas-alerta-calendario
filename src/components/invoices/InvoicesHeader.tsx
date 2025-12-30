import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileDown, LayoutGrid, List, Eye, EyeOff } from 'lucide-react';
import { DateFilterType } from './InvoicesQuickFilters';

interface InvoicesHeaderProps {
  onCreateInvoice: () => void;
  onOpenExportModal: () => void;
  viewMode?: 'table' | 'cards';
  onViewModeChange?: (mode: 'table' | 'cards') => void;
  activeDateFilter?: DateFilterType;
  showSensitiveData?: boolean;
  onToggleSensitiveData?: () => void;
}

const getActivePeriodLabel = (filter: DateFilterType): string => {
  switch (filter) {
    case 'today':
      return 'Hoy';
    case 'week':
      return 'Esta Semana';
    case 'month':
      return 'Este Mes';
    default:
      return 'Todas';
  }
};

const InvoicesHeader = ({ 
  onCreateInvoice, 
  onOpenExportModal,
  viewMode = 'table',
  onViewModeChange,
  activeDateFilter = 'all',
  showSensitiveData = true,
  onToggleSensitiveData
}: InvoicesHeaderProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Facturas</h1>
            <p className="text-muted-foreground mt-1">Gestión de facturación y pagos</p>
          </div>
          {activeDateFilter !== 'all' && (
            <Badge variant="secondary" className="bg-violet-100 text-violet-700 border-violet-200">
              {getActivePeriodLabel(activeDateFilter)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Sensitive data toggle */}
          {onToggleSensitiveData && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSensitiveData}
              title={showSensitiveData ? 'Ocultar montos' : 'Mostrar montos'}
              className="text-muted-foreground hover:text-foreground"
            >
              {showSensitiveData ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </Button>
          )}
          
          {/* View mode toggle */}
          {onViewModeChange && (
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('table')}
                className={`h-8 px-3 ${viewMode === 'table' ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onViewModeChange('cards')}
                className={`h-8 px-3 ${viewMode === 'cards' ? 'bg-violet-600 hover:bg-violet-700' : ''}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenExportModal}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            Exportar
          </Button>
          <Button
            onClick={onCreateInvoice}
            className="bg-violet-600 hover:bg-violet-700 text-white"
            title="Crear nueva factura"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Factura
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InvoicesHeader;
