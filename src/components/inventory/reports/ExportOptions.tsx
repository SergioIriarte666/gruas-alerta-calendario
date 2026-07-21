import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, FileText, Table, X } from 'lucide-react';
import { InventoryReportFilters } from '@/hooks/useInventoryReports';
import { toast } from 'sonner';

interface ExportOptionsProps {
  activeReport: string;
  filters?: InventoryReportFilters;
  onClose: () => void;
}

export const ExportOptions: React.FC<ExportOptionsProps> = ({
  activeReport,
  filters,
  onClose
}) => {
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeDetails, setIncludeDetails] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const reportNames = {
    dashboard: 'Dashboard Ejecutivo',
    stock: 'Reporte de Stock',
    movements: 'Reporte de Movimientos',
    costs: 'Análisis de Costos',
    predictive: 'Análisis Predictivo'
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // Simulate export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Reporte exportado', {
        description: `El reporte ha sido descargado en formato ${exportFormat.toUpperCase()}`
      });
      
      onClose();
    } catch (_error) {
      toast.error('Error al exportar', {
        description: 'No se pudo generar el reporte. Inténtalo nuevamente.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const formatOptions = [
    {
      value: 'pdf',
      label: 'PDF',
      description: 'Documento con formato completo',
      icon: FileText
    },
    {
      value: 'excel',
      label: 'Excel',
      description: 'Hoja de cálculo con datos',
      icon: Table
    },
    {
      value: 'csv',
      label: 'CSV',
      description: 'Datos en formato texto',
      icon: Table
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Exportar Reporte</h3>
          <p className="text-sm text-muted-foreground">
            {reportNames[activeReport as keyof typeof reportNames]}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {/* Format Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Formato de Exportación</Label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {formatOptions.map((option) => (
            <Card 
              key={option.value}
              className={`cursor-pointer transition-colors ${
                exportFormat === option.value ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setExportFormat(option.value as any)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-x-3">
                  <option.icon className="size-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Export Options */}
      <div className="space-y-4">
        <Label className="text-sm font-medium">Opciones de Contenido</Label>
        
        <div className="space-y-3">
          <div className="flex items-center gap-x-2">
            <Checkbox 
              id="includeCharts" 
              checked={includeCharts}
              onCheckedChange={(checked) => setIncludeCharts(checked === true)}
              disabled={exportFormat === 'csv'}
            />
            <Label htmlFor="includeCharts" className="text-sm">
              Incluir gráficos y visualizaciones
            </Label>
          </div>

          <div className="flex items-center gap-x-2">
            <Checkbox 
              id="includeDetails" 
              checked={includeDetails}
              onCheckedChange={(checked) => setIncludeDetails(checked === true)}
            />
            <Label htmlFor="includeDetails" className="text-sm">
              Incluir detalles y tablas completas
            </Label>
          </div>
        </div>
      </div>

      {/* Applied Filters Summary */}
      {filters && Object.keys(filters).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filtros Aplicados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {filters.dateFrom && (
              <div className="text-xs">
                <span className="font-medium">Desde:</span> {filters.dateFrom}
              </div>
            )}
            {filters.dateTo && (
              <div className="text-xs">
                <span className="font-medium">Hasta:</span> {filters.dateTo}
              </div>
            )}
            {filters.categoryId && (
              <div className="text-xs">
                <span className="font-medium">Categoría:</span> Seleccionada
              </div>
            )}
            {filters.movementType && (
              <div className="text-xs">
                <span className="font-medium">Tipo:</span> {filters.movementType}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Export Button */}
      <div className="flex justify-end gap-x-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <>
              <div className="mr-2 size-4 animate-spin rounded-full border-b-2 border-primary-foreground"></div>
              Exportando...
            </>
          ) : (
            <>
              <Download className="size-4 mr-2" />
              Exportar {exportFormat.toUpperCase()}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
