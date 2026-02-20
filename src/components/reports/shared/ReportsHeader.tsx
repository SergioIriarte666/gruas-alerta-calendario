import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet, RefreshCw, BarChart3, Truck, DollarSign } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface ReportsHeaderProps {
  onExport: (format: 'pdf' | 'excel') => void;
  onExportServiceReport: (format: 'pdf' | 'excel') => void;
  onExportCostReport: (format: 'pdf' | 'excel') => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  lastUpdate?: Date;
}

export const ReportsHeader = ({ onExport, onExportServiceReport, onExportCostReport, onRefresh, isLoading, lastUpdate }: ReportsHeaderProps) => (
  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
    <div>
      <h1 className="text-2xl font-bold text-foreground">Reportes</h1>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-sm text-muted-foreground">
          Análisis y métricas de rendimiento del negocio
        </p>
        {lastUpdate && (
          <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/30 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            Actualizado: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2">
      {onRefresh && (
        <Button 
          variant="outline" 
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="border-input text-foreground hover:bg-muted/50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-popover border z-50">
          <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="w-3.5 h-3.5" />
            Métricas Generales
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onExport('pdf')}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar como PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('excel')}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar como Excel
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
            <Truck className="w-3.5 h-3.5" />
            Informe de Servicios
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onExportServiceReport('pdf')}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar como PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportServiceReport('excel')}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar como Excel
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuLabel className="flex items-center gap-2 text-muted-foreground">
            <DollarSign className="w-3.5 h-3.5" />
            Informe de Costos
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onExportCostReport('pdf')}>
            <FileText className="w-4 h-4 mr-2" />
            Exportar como PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportCostReport('excel')}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Exportar como Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);
