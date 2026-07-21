import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
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
      <h1 className="text-3xl font-bold text-foreground">Reportes</h1>
      <p className="text-foreground mt-1">
        Análisis detallado y métricas de rendimiento del negocio.
        {lastUpdate && (
          <span className="block text-sm text-foreground mt-1">
            Última actualización: {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </p>
    </div>
    <div className="flex items-center gap-2">
      {onRefresh && (
        <Button 
          variant="outline" 
          onClick={onRefresh}
          disabled={isLoading}
          className="border hover:bg-muted/10"
        >
          <RefreshCw className={`size-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-primary hover:bg-primary/90">
            <Download className="size-4 mr-2" />
            Exportar Métricas
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExport('pdf')}>
            <FileText className="size-4 mr-2" />
            Exportar como PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExport('excel')}>
            <FileSpreadsheet className="size-4 mr-2" />
            Exportar como Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-secondary hover:bg-secondary/90 text-foreground">
            <Download className="size-4 mr-2" />
            Informe de Servicios
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExportServiceReport('pdf')}>
            <FileText className="size-4 mr-2" />
            Exportar como PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportServiceReport('excel')}>
            <FileSpreadsheet className="size-4 mr-2" />
            Exportar como Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="bg-accent hover:bg-accent/90 text-foreground">
            <Download className="size-4 mr-2" />
            Informe de Costos
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onExportCostReport('pdf')}>
            <FileText className="size-4 mr-2" />
            Exportar como PDF
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onExportCostReport('excel')}>
            <FileSpreadsheet className="size-4 mr-2" />
            Exportar como Excel
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);