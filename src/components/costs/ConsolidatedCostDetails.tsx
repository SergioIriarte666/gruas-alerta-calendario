import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Cost } from '@/types/costs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Calendar,
  DollarSign,
  FileText,
  Tag,
  Truck,
  User,
  Wrench,
  Building,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Clock,
  Copy,
  Edit,
  MapPin,
  Car,
  StickyNote,
} from 'lucide-react';
import { parseFromDatabase, formatForDisplayWithTime } from '@/utils/timezoneUtils';
import { getCreatorDisplayName } from '@/types/common';
import { cn } from '@/lib/utils';

interface ConsolidatedCostDetailsProps {
  cost: Cost;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (cost: Cost) => void;
  onDuplicate?: (cost: Cost) => void;
}

export const ConsolidatedCostDetails = ({
  cost,
  isOpen,
  onClose,
  onEdit,
  onDuplicate,
}: ConsolidatedCostDetailsProps) => {
  const [showAssociations, setShowAssociations] = useState(true);
  const [showNotes, setShowNotes] = useState(true);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const hasAssociations = cost.cranes || cost.operators || cost.services;
  const hasNotes = cost.notes && cost.notes.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold text-foreground">
                {cost.description}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  {cost.cost_categories?.name || 'Sin categoría'}
                </Badge>
                {cost.subcategory && (
                  <Badge variant="outline">
                    {cost.subcategory}
                  </Badge>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-violet-600">
                {formatCurrency(Number(cost.amount))}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Información principal */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-violet-100 dark:bg-violet-900/30 p-2 rounded-lg">
                  <Calendar className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p className="font-medium text-foreground">
                    {format(parseFromDatabase(cost.date), "dd 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg">
                  <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monto</p>
                  <p className="font-medium text-foreground">
                    {formatCurrency(Number(cost.amount))}
                  </p>
                </div>
              </div>

              {cost.service_folio && (
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Folio Servicio</p>
                    <p className="font-medium text-foreground font-mono">{cost.service_folio}</p>
                  </div>
                </div>
              )}

              {cost.cost_center_id && (
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                    <Building className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Centro de Costo</p>
                    <p className="font-medium text-foreground">
                      {cost.cost_centers?.name || cost.cost_center_id}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Asociaciones colapsables */}
          {hasAssociations && (
            <Collapsible open={showAssociations} onOpenChange={setShowAssociations}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Wrench className="w-4 h-4 text-violet-600" />
                    Asociaciones
                  </span>
                  {showAssociations ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="bg-muted/30 rounded-lg p-4 space-y-4">
                  {cost.cranes && (
                    <div className="flex items-start gap-3">
                      <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Grúa</p>
                        <p className="font-medium text-foreground">
                          {cost.cranes.brand} {cost.cranes.model}
                        </p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {cost.cranes.license_plate}
                        </p>
                      </div>
                    </div>
                  )}

                  {cost.operators && (
                    <div className="flex items-start gap-3">
                      <User className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Operador</p>
                        <p className="font-medium text-foreground">{cost.operators.name}</p>
                        <p className="text-sm text-muted-foreground">{cost.operators.rut}</p>
                      </div>
                    </div>
                  )}

                  {cost.services && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Wrench className="w-5 h-5 text-purple-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">Servicio</p>
                          <p className="font-medium text-foreground">
                            Folio: {cost.services.folio}
                          </p>
                          {cost.services.clients && (
                            <p className="text-sm text-muted-foreground">
                              Cliente: {cost.services.clients.name}
                            </p>
                          )}
                        </div>
                      </div>

                      {(cost.services.origin || cost.services.destination) && (
                        <div className="ml-8 space-y-1">
                          {cost.services.origin && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Origen:</span>
                              <span className="text-foreground">{cost.services.origin}</span>
                            </div>
                          )}
                          {cost.services.destination && (
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <span className="text-muted-foreground">Destino:</span>
                              <span className="text-foreground">{cost.services.destination}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {cost.services.license_plate && (
                        <div className="ml-8 flex items-center gap-2 text-sm">
                          <Car className="w-3 h-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Patente:</span>
                          <span className="text-foreground font-mono">{cost.services.license_plate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Notas colapsables */}
          {hasNotes && (
            <Collapsible open={showNotes} onOpenChange={setShowNotes}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <StickyNote className="w-4 h-4 text-amber-600" />
                    Notas
                  </span>
                  {showNotes ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
                  <p className="text-foreground whitespace-pre-wrap">{cost.notes}</p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            {onEdit && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onEdit(cost);
                  onClose();
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
            {onDuplicate && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onDuplicate(cost);
                  onClose();
                }}
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicar
              </Button>
            )}
          </div>

          {/* Footer con auditoría */}
          <Separator />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Creado: {formatForDisplayWithTime(cost.created_at)}
              {cost.creator && ` por ${getCreatorDisplayName(cost.creator)}`}
            </span>
            <span>Actualizado: {formatForDisplayWithTime(cost.updated_at)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
