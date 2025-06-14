
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface ReportsHeaderProps {
  onExport: (format: 'pdf' | 'excel') => void;
}

export const ReportsHeader = ({ onExport }: ReportsHeaderProps) => (
  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
    <div>
      <h1 className="text-3xl font-bold text-white">Reportes</h1>
      <p className="text-gray-300 mt-1">Análisis detallado y métricas de rendimiento del negocio.</p>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-tms-green hover:bg-tms-green/90">
          <Download className="w-4 h-4 mr-2" />
          Exportar Reporte
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onExport('pdf')}>
          <FileText className="w-4 h-4 mr-2" />
          Exportar como PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('excel')}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar como Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
);
