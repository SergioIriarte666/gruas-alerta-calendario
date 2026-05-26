
import React, { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { 
  ReportColumnsConfig, 
  ColumnKey, 
  defaultReportColumnConfig, 
  columnOrder 
} from '@/types/reportColumnConfig';

interface ReportColumnsSettingsProps {
  config: ReportColumnsConfig;
  onChange: (config: ReportColumnsConfig) => void;
}

export const ReportColumnsSettings: React.FC<ReportColumnsSettingsProps> = ({
  config,
  onChange
}) => {
  // Merge user config with defaults to ensure all columns exist
  const safeConfig: ReportColumnsConfig = useMemo(() => ({
    columns: {
      ...defaultReportColumnConfig.columns,
      ...config.columns
    }
  }), [config]);

  const { visibleColumns, totalWidth, isValid } = useMemo(() => {
    const visible = columnOrder.filter(key => safeConfig.columns[key]?.visible ?? false);
    const total = visible.reduce((sum, key) => sum + (safeConfig.columns[key]?.width ?? 5), 0);
    return {
      visibleColumns: visible,
      totalWidth: total,
      isValid: Math.abs(total - 100) < 1
    };
  }, [safeConfig]);

  const handleVisibilityChange = (key: ColumnKey, checked: boolean) => {
    const newConfig = {
      ...safeConfig,
      columns: {
        ...safeConfig.columns,
        [key]: { ...safeConfig.columns[key], visible: checked }
      }
    };
    onChange(newConfig);
  };

  const handleWidthChange = (key: ColumnKey, width: number) => {
    const newConfig = {
      ...safeConfig,
      columns: {
        ...safeConfig.columns,
        [key]: { ...safeConfig.columns[key], width }
      }
    };
    onChange(newConfig);
  };

  const handleAutoBalance = () => {
    const visible = columnOrder.filter(key => safeConfig.columns[key]?.visible ?? false);
    if (visible.length === 0) return;

    const baseWidth = Math.floor(100 / visible.length);
    const remainder = 100 - (baseWidth * visible.length);

    const newColumns = { ...safeConfig.columns };
    visible.forEach((key, index) => {
      newColumns[key] = {
        ...newColumns[key],
        width: baseWidth + (index < remainder ? 1 : 0)
      };
    });

    onChange({ ...safeConfig, columns: newColumns });
  };

  const handleResetDefaults = () => {
    onChange(defaultReportColumnConfig);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header con indicador de total */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <span className="text-xs sm:text-sm text-muted-foreground">
          Visibles: <span className="font-medium text-foreground">{visibleColumns.length}/{columnOrder.length}</span>
        </span>
        <Separator orientation="vertical" className="h-4 hidden sm:block" />
        <div className="flex items-center gap-1">
          <span className="text-xs sm:text-sm text-muted-foreground">
            Total: 
            <span className={`font-medium ml-1 ${isValid ? 'text-tms-green' : 'text-amber-600'}`}>
              {totalWidth}%
            </span>
          </span>
          {isValid ? (
            <CheckCircle2 className="size-4 text-tms-green" />
          ) : (
            <AlertTriangle className="size-4 text-amber-600" />
          )}
        </div>
      </div>

      {!isValid && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle className="size-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm text-amber-800">
            El total de anchos debe sumar 100%. Actual: {totalWidth}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAutoBalance}
            className="ml-auto text-xs"
          >
            <RefreshCw className="size-3 mr-1" />
            Auto-balancear
          </Button>
        </div>
      )}

      {/* Lista de columnas */}
      <div className="space-y-3">
        {columnOrder.map((key) => {
          const column = safeConfig.columns[key];
          if (!column) return null;
          return (
            <div 
              key={key} 
              className={`flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 rounded-lg border transition-colors ${
                column.visible 
                  ? 'bg-card border-border' 
                  : 'bg-muted/50 border-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                {/* Checkbox */}
                <Checkbox
                  id={`col-${key}`}
                  checked={column.visible}
                  onCheckedChange={(checked) => 
                    handleVisibilityChange(key, checked === true)
                  }
                />
                {/* Label */}
                <Label 
                  htmlFor={`col-${key}`}
                  className={`w-24 sm:w-28 font-medium text-sm ${
                    column.visible ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {column.label}
                </Label>
                {!column.visible && (
                  <Badge variant="secondary" className="text-xs sm:hidden">Oculta</Badge>
                )}
              </div>

              {column.visible && (
                <div className="flex items-center gap-2 flex-1 pl-6 sm:pl-0">
                  {/* Slider */}
                  <div className="flex-1">
                    <Slider
                      value={[column.width]}
                      onValueChange={([value]) => handleWidthChange(key, value)}
                      min={3}
                      max={25}
                      step={1}
                    />
                  </div>
                  {/* Input numérico */}
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={3}
                      max={25}
                      value={column.width}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val) && val >= 3 && val <= 25) {
                          handleWidthChange(key, val);
                        }
                      }}
                      className="w-14 text-center h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              )}

              {/* Badge de estado - desktop only */}
              {!column.visible && (
                <Badge variant="secondary" className="text-xs hidden sm:inline-flex">
                  Oculta
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      {/* Vista previa visual */}
      <div className="space-y-2">
        <Label className="text-sm">Vista previa de columnas</Label>
        <div className="flex h-8 overflow-hidden rounded-lg border border-border/70 bg-background/40">
          {visibleColumns.map((key, index) => {
            const column = safeConfig.columns[key];
            if (!column) return null;
            const colors = [
              'bg-primary/80', 'bg-info/80', 'bg-success/80', 'bg-warning/80',
              'bg-primary/65', 'bg-info/65', 'bg-success/65', 'bg-warning/65',
              'bg-primary/50', 'bg-info/50', 'bg-success/50', 'bg-warning/50', 'bg-primary/35'
            ];
            return (
              <div
                key={key}
                className={`${colors[index % colors.length]} flex items-center justify-center overflow-hidden text-xs font-medium text-primary-foreground`}
                style={{ width: `${column.width}%` }}
                title={`${column.label}: ${column.width}%`}
              >
                {column.width >= 5 ? column.label.substring(0, 3) : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <Button
          variant="outline"
          onClick={handleAutoBalance}
          className="flex-1"
          size="sm"
        >
          <RefreshCw className="size-4 mr-2" />
          Auto-balancear
        </Button>
        <Button
          variant="outline"
          onClick={handleResetDefaults}
          className="flex-1"
          size="sm"
        >
          Restaurar valores
        </Button>
      </div>
    </div>
  );
};
