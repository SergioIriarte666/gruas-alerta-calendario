import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ServiceStatus } from '@/types';
import { FileText, Download } from 'lucide-react';

interface PipelineExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'pdf' | 'excel', options: { includeStatuses?: ServiceStatus[]; includeAllStatuses?: boolean }) => void;
  availableStatuses: Array<{
    status: ServiceStatus;
    title: string;
    count: number;
    totalValue: number;
  }>;
  totalServices: number;
}

const STATUS_LABELS: Record<ServiceStatus, string> = {
  'quoted': 'Cotizados',
  'purchase_order_pending': 'Esperando O.C.',
  'with_purchase_order': 'Con Orden de Compra',
  'pending': 'Programados',
  'in_progress': 'En Progreso',
  'completed': 'Completados',
  'failed': 'Fallidos',
  'invoiced': 'Facturados',
  'cancelled': 'Cancelados',
  'inspection_completed': 'Inspección Completada'
};

export const PipelineExportModal: React.FC<PipelineExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  availableStatuses,
  totalServices
}) => {
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ServiceStatus>>(new Set());
  const [exportAllStatuses, setExportAllStatuses] = useState(true);

  const handleStatusToggle = (status: ServiceStatus, checked: boolean) => {
    const newSelected = new Set(selectedStatuses);
    if (checked) {
      newSelected.add(status);
    } else {
      newSelected.delete(status);
    }
    setSelectedStatuses(newSelected);
    
    // Si no hay ningún estado seleccionado, cambiar a "exportar todo"
    if (newSelected.size === 0) {
      setExportAllStatuses(true);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStatuses(new Set(availableStatuses.map(s => s.status)));
      setExportAllStatuses(false);
    } else {
      setSelectedStatuses(new Set());
      setExportAllStatuses(true);
    }
  };

  const handleExportAllToggle = (checked: boolean) => {
    setExportAllStatuses(checked);
    if (checked) {
      setSelectedStatuses(new Set());
    }
  };

  const handleExport = (format: 'pdf' | 'excel') => {
    const options = {
      includeAllStatuses: exportAllStatuses,
      includeStatuses: exportAllStatuses ? undefined : Array.from(selectedStatuses),
    };
    
    onExport(format, options);
    onClose();
  };

  const selectedCount = exportAllStatuses 
    ? totalServices 
    : availableStatuses
        .filter(s => selectedStatuses.has(s.status))
        .reduce((sum, s) => sum + s.count, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] overflow-clip">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5" />
            Exportar Servicios del Pipeline
          </DialogTitle>
          <DialogDescription>
            Selecciona los estados que deseas incluir en la exportación
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Opción para exportar todo */}
          <div className="flex items-center gap-x-2 p-3 border rounded-lg bg-muted/50">
            <Checkbox
              id="export-all"
              checked={exportAllStatuses}
              onCheckedChange={handleExportAllToggle}
            />
            <label
              htmlFor="export-all"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Exportar todos los estados ({totalServices} servicios)
            </label>
            <Badge variant="secondary">{totalServices}</Badge>
          </div>

          {/* Opción para seleccionar todo */}
          {!exportAllStatuses && (
            <div className="flex items-center gap-x-2">
              <Checkbox
                id="select-all"
                checked={selectedStatuses.size === availableStatuses.length}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all" className="text-sm font-medium">
                Seleccionar todos los estados visibles
              </label>
            </div>
          )}

          {/* Lista de estados disponibles */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {availableStatuses.map(({ status, count, totalValue }) => (
              <div
                key={status}
                className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                  exportAllStatuses ? 'opacity-50' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-x-2">
                  <Checkbox
                    id={status}
                    checked={exportAllStatuses || selectedStatuses.has(status)}
                    disabled={exportAllStatuses}
                    onCheckedChange={(checked) => handleStatusToggle(status, checked as boolean)}
                  />
                  <label
                    htmlFor={status}
                    className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {STATUS_LABELS[status]}
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{count}</Badge>
                  <span className="text-xs text-muted-foreground">
                    ${totalValue.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen de selección */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm font-medium">
              Servicios a exportar: {selectedCount}
            </div>
            <div className="text-xs text-muted-foreground">
              {exportAllStatuses 
                ? 'Todos los estados incluidos'
                : selectedStatuses.size === 0
                  ? 'Selecciona al menos un estado'
                  : `Estados seleccionados: ${Array.from(selectedStatuses).map(s => STATUS_LABELS[s]).join(', ')}`
              }
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('pdf')}
            disabled={!exportAllStatuses && selectedStatuses.size === 0}
            className="flex items-center gap-2"
          >
            <FileText className="size-4" />
            Exportar PDF
          </Button>
          <Button
            onClick={() => handleExport('excel')}
            disabled={!exportAllStatuses && selectedStatuses.size === 0}
            className="flex items-center gap-2"
          >
            <FileText className="size-4" />
            Exportar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};