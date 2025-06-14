
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ReportsHeaderProps {
  onExport: () => void;
}

export const ReportsHeader = ({ onExport }: ReportsHeaderProps) => (
  <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
    <div>
      <h1 className="text-3xl font-bold text-white">Reportes</h1>
      <p className="text-gray-300 mt-1">Análisis detallado y métricas de rendimiento del negocio.</p>
    </div>
    <Button onClick={onExport} className="bg-tms-green hover:bg-tms-green/90">
      <Download className="w-4 h-4 mr-2" />
      Exportar Reporte
    </Button>
  </div>
);
