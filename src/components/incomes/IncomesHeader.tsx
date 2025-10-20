import { Plus, FileDown, DollarSign, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReportMetricCard } from '@/components/reports/shared/ReportMetricCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface IncomesHeaderProps {
  onAddIncome: () => void;
  onExport: (format: 'pdf' | 'excel') => void;
  totalAmount: number;
  totalCount: number;
}

export const IncomesHeader = ({ onAddIncome, onExport, totalAmount, totalCount }: IncomesHeaderProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ingresos</h1>
          <p className="text-muted-foreground mt-1">
            Gestión de ingresos bancarios y extraordinarios
          </p>
        </div>
        
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileDown className="h-4 w-4 mr-2" />
                Exportar
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
            Agregar Ingreso
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
