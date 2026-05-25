import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, FileText, Table, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { InventoryMovement } from '@/hooks/useInventory';
import { exportInventoryMovementReport } from '@/utils/reports/inventoryMovementExporter';
import { useSettings } from '@/hooks/useSettings';

interface MovementExportOptionsProps {
  movements: InventoryMovement[];
  appliedFilters: {
    searchTerm: string;
    typeFilter: string;
    locationFilter: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
  onClose: () => void;
}

export const MovementExportOptions: React.FC<MovementExportOptionsProps> = ({
  movements,
  appliedFilters,
  onClose
}) => {
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const { settings } = useSettings();

  const handleExport = async () => {
    if (!settings) {
      toast.error('Error', {
        description: 'No se pudieron cargar las configuraciones de la empresa.'
      });
      return;
    }

    setIsExporting(true);
    
    try {
      console.log('Starting export with format:', exportFormat);
      console.log('Number of movements:', movements.length);
      
      const filterLabels: string[][] = [];
      
      if (appliedFilters.searchTerm) {
        filterLabels.push(['Búsqueda', appliedFilters.searchTerm]);
      }
      
      if (appliedFilters.typeFilter !== 'all') {
        const typeLabels = {
          entry: 'Entradas',
          exit: 'Salidas', 
          transfer: 'Transferencias',
          adjustment: 'Ajustes'
        };
        filterLabels.push(['Tipo', typeLabels[appliedFilters.typeFilter as keyof typeof typeLabels] || appliedFilters.typeFilter]);
      }
      
      if (appliedFilters.locationFilter !== 'all') {
        filterLabels.push(['Ubicación', 'Ubicación específica']);
      }
      
      const dateFrom = appliedFilters.dateFrom ? format(appliedFilters.dateFrom, 'dd/MM/yyyy') : '';
      const dateTo = appliedFilters.dateTo ? format(appliedFilters.dateTo, 'dd/MM/yyyy') : '';
      
      if (dateFrom || dateTo) {
        filterLabels.push(['Rango de fechas', `${dateFrom || 'Sin límite'} - ${dateTo || 'Sin límite'}`]);
      }

      console.log('Filter labels:', filterLabels);
      console.log('Settings:', settings);

      await exportInventoryMovementReport({
        format: exportFormat,
        movements: movements,
        settings: settings,
        appliedFilters: {
          dateRange: {
            from: dateFrom,
            to: dateTo
          },
          movementType: appliedFilters.typeFilter,
          location: appliedFilters.locationFilter,
          searchTerm: appliedFilters.searchTerm
        },
        filterLabels
      });
      
      console.log('Export completed successfully');
      
      toast.success('Reporte exportado', {
        description: `El reporte ha sido descargado en formato ${exportFormat.toUpperCase()}`
      });
      
      onClose();
    } catch (error) {
      console.error('Error exporting movement report:', error);
      toast.error('Error al exportar', {
        description: error instanceof Error ? error.message : 'No se pudo generar el reporte. Inténtalo nuevamente.'
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
          <h3 className="text-lg font-semibold">Exportar Movimientos</h3>
          <p className="text-sm text-muted-foreground">
            {movements.length} movimientos seleccionados
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
                <div className="flex items-center space-x-3">
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
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="includeDetails" 
              checked={includeDetails}
              onCheckedChange={(checked) => setIncludeDetails(checked === true)}
            />
            <Label htmlFor="includeDetails" className="text-sm">
              Incluir detalles completos y resumen estadístico
            </Label>
          </div>
        </div>
      </div>

      {/* Applied Filters Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros Aplicados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {appliedFilters.searchTerm && (
            <div className="text-xs">
              <span className="font-medium">Búsqueda:</span> {appliedFilters.searchTerm}
            </div>
          )}
          {appliedFilters.typeFilter !== 'all' && (
            <div className="text-xs">
              <span className="font-medium">Tipo:</span> {
                appliedFilters.typeFilter === 'entry' ? 'Entradas' :
                appliedFilters.typeFilter === 'exit' ? 'Salidas' :
                appliedFilters.typeFilter === 'transfer' ? 'Transferencias' : 'Ajustes'
              }
            </div>
          )}
          {appliedFilters.locationFilter !== 'all' && (
            <div className="text-xs">
              <span className="font-medium">Ubicación:</span> Ubicación específica
            </div>
          )}
          {(appliedFilters.dateFrom || appliedFilters.dateTo) && (
            <div className="text-xs">
              <span className="font-medium">Fechas:</span> {
                appliedFilters.dateFrom ? format(appliedFilters.dateFrom, 'dd/MM/yyyy') : 'Sin límite'
              } - {
                appliedFilters.dateTo ? format(appliedFilters.dateTo, 'dd/MM/yyyy') : 'Sin límite'
              }
            </div>
          )}
          {!appliedFilters.searchTerm && appliedFilters.typeFilter === 'all' && 
           appliedFilters.locationFilter === 'all' && !appliedFilters.dateFrom && !appliedFilters.dateTo && (
            <div className="text-xs text-muted-foreground">
              Sin filtros aplicados - se exportarán todos los movimientos
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Button */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleExport} disabled={isExporting}>
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full size-4 border-b-2 border-white mr-2"></div>
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