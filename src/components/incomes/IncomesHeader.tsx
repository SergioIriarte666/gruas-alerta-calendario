import { Plus, FileDown, DollarSign, Hash, LayoutList, Kanban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportMetricCard } from '@/components/reports/shared/ReportMetricCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from '@/hooks/use-mobile';

interface IncomesHeaderProps {
  onAddIncome: () => void;
  onExport: (format: 'pdf' | 'excel') => void;
  totalAmount: number;
  totalCount: number;
  viewMode: 'table' | 'pipeline';
  onViewModeChange: (mode: 'table' | 'pipeline') => void;
}

export const IncomesHeader = ({ onAddIncome, onExport, totalAmount, totalCount, viewMode, onViewModeChange }: IncomesHeaderProps) => {
  const isMobile = useIsMobile();

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">Ingresos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gestión de ingresos bancarios y extraordinarios
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {/* Toggle Vista */}
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('table')}
              className="h-8 px-3"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => onViewModeChange('pipeline')}
              className="h-8 px-3"
            >
              <Kanban className="h-4 w-4" />
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                {isMobile ? 'PDF/Excel' : 'Exportar'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport('pdf')}>
                Exportar como PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('excel')}>
                Exportar como Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={onAddIncome} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            {isMobile ? 'Nuevo' : 'Agregar Ingreso'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <ReportMetricCard
          icon={DollarSign}
          title="Total Ingresos"
          value={`$${totalAmount.toLocaleString('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          description="Suma de todos los ingresos registrados"
          valueClassName="text-green-400"
        />
        
        <ReportMetricCard
          icon={Hash}
          title="Cantidad de Registros"
          value={totalCount.toString()}
          description="Total de ingresos registrados"
          valueClassName="text-blue-400"
        />
      </div>
    </div>
  );
};
