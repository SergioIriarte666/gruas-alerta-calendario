import React from 'react';
import { useServiceChangeHistory, groupChangesByDateAndUser } from '@/hooks/useServiceChangeHistory';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Plus, Pencil, Trash2, User, Camera } from 'lucide-react';

interface ServiceChangeHistoryProps {
  serviceId: string;
}

const FIELD_LABELS: Record<string, string> = {
  value: 'Valor del Servicio',
  purchase_order: 'Orden de Compra',
  quote_number: 'Número de Cotización',
  status: 'Estado',
  operator_commission: 'Comisión Operador',
  client_covered_amount: 'Monto Cubierto Cliente',
  excess_amount: 'Excedente',
  insured_name: 'Nombre Asegurado',
  origin: 'Origen',
  destination: 'Destino',
  observations: 'Observaciones',
  vehicle_brand: 'Marca Vehículo',
  vehicle_model: 'Modelo Vehículo',
  license_plate: 'Patente',
  servicio: 'Servicio',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Completado',
  cancelled: 'Cancelado',
  invoiced: 'Facturado',
  in_progress: 'En Progreso',
};

const formatValue = (fieldName: string, value: string | null): string => {
  if (value === null || value === '') return '(vacío)';

  // Formatear valores monetarios
  if (['value', 'operator_commission', 'client_covered_amount', 'excess_amount'].includes(fieldName)) {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      return `$${numValue.toLocaleString('es-CL')}`;
    }
  }

  // Formatear estados
  if (fieldName === 'status') {
    return STATUS_LABELS[value] || value;
  }

  return value;
};

const getChangeTypeConfig = (changeType: 'CREATE' | 'UPDATE' | 'DELETE' | 'SNAPSHOT') => {
  switch (changeType) {
    case 'CREATE':
      return {
        icon: Plus,
        label: 'Creación',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        borderColor: 'border-green-300',
      };
    case 'UPDATE':
      return {
        icon: Pencil,
        label: 'Modificación',
        bgColor: 'bg-amber-100',
        textColor: 'text-amber-800',
        borderColor: 'border-amber-300',
      };
    case 'DELETE':
      return {
        icon: Trash2,
        label: 'Eliminación',
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-300',
      };
    case 'SNAPSHOT':
      return {
        icon: Camera,
        label: 'Estado Inicial',
        bgColor: 'bg-blue-100',
        textColor: 'text-blue-800',
        borderColor: 'border-blue-300',
      };
  }
};

export const ServiceChangeHistory: React.FC<ServiceChangeHistoryProps> = ({ serviceId }) => {
  const { data: changes, isLoading, error } = useServiceChangeHistory(serviceId);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-destructive">
        Error al cargar el historial de cambios
      </div>
    );
  }

  if (!changes || changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <History className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">No hay cambios registrados para este servicio</p>
      </div>
    );
  }

  const groupedChanges = groupChangesByDateAndUser(changes);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium text-sm">Historial de Cambios</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {changes.length} {changes.length === 1 ? 'cambio' : 'cambios'}
        </Badge>
      </div>

      <ScrollArea className="h-[400px] px-4">
        <div className="space-y-4 pb-4">
          {groupedChanges.map((group, groupIndex) => {
            const primaryChangeType = group.changes[0]?.changeType || 'UPDATE';
            const config = getChangeTypeConfig(primaryChangeType);
            const IconComponent = config.icon;

            return (
              <div
                key={groupIndex}
                className={`rounded-lg border ${config.borderColor} ${config.bgColor} p-3`}
              >
                {/* Header del grupo */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <IconComponent className={`h-4 w-4 ${config.textColor}`} />
                    <span className={`text-xs font-medium ${config.textColor}`}>
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {format(new Date(group.date), "dd MMM yyyy, HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>

                {/* Usuario */}
                <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
                  <User className="h-3 w-3" />
                  <span>{group.changerName}</span>
                  {group.changerEmail && (
                    <span className="text-muted-foreground/70">({group.changerEmail})</span>
                  )}
                </div>

                {/* Lista de cambios */}
                <div className="space-y-1.5">
                  {group.changes.map((change) => {
                    // Renderizado especial para SNAPSHOT
                    if (change.changeType === 'SNAPSHOT') {
                      try {
                        const snapshotData = JSON.parse(change.newValue || '{}');
                        const snapshotFields = Object.entries(snapshotData).filter(
                          ([_, value]) => value !== null && value !== ''
                        );
                        
                        return (
                          <div key={change.id} className="space-y-1">
                            <p className="text-xs text-muted-foreground italic mb-2">
                              {change.changeSummary}
                            </p>
                            {snapshotFields.map(([fieldName, value]) => (
                              <div
                                key={fieldName}
                                className="flex items-start gap-2 text-xs bg-white/50 rounded px-2 py-1"
                              >
                                <span className="font-medium text-foreground min-w-[140px]">
                                  {FIELD_LABELS[fieldName] || fieldName}:
                                </span>
                                <span className="text-foreground">
                                  {formatValue(fieldName, String(value))}
                                </span>
                              </div>
                            ))}
                          </div>
                        );
                      } catch {
                        return (
                          <div key={change.id} className="text-xs text-muted-foreground italic">
                            {change.changeSummary || 'Estado inicial registrado'}
                          </div>
                        );
                      }
                    }

                    return (
                      <div
                        key={change.id}
                        className="flex items-start gap-2 text-xs bg-white/50 rounded px-2 py-1.5"
                      >
                        <span className="font-medium text-foreground min-w-[140px]">
                          {FIELD_LABELS[change.fieldName] || change.fieldName}:
                        </span>
                        {change.changeType === 'CREATE' ? (
                          <span className="text-muted-foreground italic">
                            {change.changeSummary || 'Servicio creado'}
                          </span>
                        ) : change.changeType === 'DELETE' ? (
                          <span className="text-muted-foreground italic">
                            {change.changeSummary || 'Servicio eliminado'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            <span className="line-through opacity-60">
                              {formatValue(change.fieldName, change.oldValue)}
                            </span>
                            <span className="mx-1.5">→</span>
                            <span className="font-medium text-foreground">
                              {formatValue(change.fieldName, change.newValue)}
                            </span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
