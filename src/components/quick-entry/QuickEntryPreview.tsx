import React from 'react';
import { X, Calendar, DollarSign, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { QuickEntry } from '@/hooks/useQuickEntry';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const TYPE_LABELS = {
  service: 'Servicio',
  cost: 'Costo/Gasto',
  inventory: 'Bodega',
  maintenance: 'Mantenimiento',
};

const TYPE_COLORS = {
  service: 'bg-blue-100 text-blue-800',
  cost: 'bg-red-100 text-red-800',
  inventory: 'bg-green-100 text-green-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
};

interface QuickEntryPreviewProps {
  entry: QuickEntry;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (entry: QuickEntry) => void;
  onDiscard: (entry: QuickEntry) => void;
}

export function QuickEntryPreview({ 
  entry, 
  isOpen, 
  onClose, 
  onComplete, 
  onDiscard 
}: QuickEntryPreviewProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>Vista Previa del Registro</DialogTitle>
              <Badge className={TYPE_COLORS[entry.type]}>
                {TYPE_LABELS[entry.type]}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(entry.created_at!), { 
                addSuffix: true, 
                locale: es 
              })}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Main Information */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg mb-2">{entry.description}</h3>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Fecha:</span>
                  <span className="font-medium">{new Date(entry.date).toLocaleDateString()}</span>
                </div>
                
                {entry.amount && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Monto:</span>
                    <span className="font-medium">${entry.amount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>

            {entry.notes && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Notas:</span>
                </div>
                <p className="text-sm bg-muted p-3 rounded-md">{entry.notes}</p>
              </div>
            )}
          </div>

          {/* Data Section */}
          {entry.data && Object.keys(entry.data).length > 0 && (
            <div>
              <h4 className="font-medium mb-3">Datos Adicionales</h4>
              <div className="bg-muted p-3 rounded-md">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(entry.data, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              onClick={() => onComplete(entry)}
              className="flex-1"
            >
              Convertir a {TYPE_LABELS[entry.type]}
            </Button>
            <Button
              variant="outline"
              onClick={() => onDiscard(entry)}
              className="flex-1"
            >
              Descartar
            </Button>
            <Button
              variant="ghost"
              onClick={onClose}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
