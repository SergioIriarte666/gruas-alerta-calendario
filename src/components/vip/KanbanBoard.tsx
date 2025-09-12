import React, { useMemo } from 'react';
import { Service, ServiceStatus } from '@/types';
import { KanbanColumn } from './KanbanColumn';
import { Loader2 } from 'lucide-react';

interface KanbanBoardProps {
  services: Service[];
  loading: boolean;
  clientId: string;
  onServiceUpdate: () => void;
}

// Definir las columnas del pipeline VIP
const PIPELINE_COLUMNS = [
  {
    id: 'quoted' as ServiceStatus,
    title: 'Cotizados',
    description: 'Servicios con cotización enviada',
    color: 'bg-muted/40 border-border',
    textColor: 'text-foreground'
  },
  {
    id: 'purchase_order_pending' as ServiceStatus,
    title: 'Esperando O.C.',
    description: 'Aguardando orden de compra del cliente',
    color: 'bg-muted/40 border-border',
    textColor: 'text-foreground'
  },
  {
    id: 'with_purchase_order' as ServiceStatus,
    title: 'Con Orden de Compra',
    description: 'Servicios con orden de compra recibida',
    color: 'bg-muted/40 border-border',
    textColor: 'text-foreground'
  },
  {
    id: 'pending' as ServiceStatus,
    title: 'Programados',
    description: 'Servicios confirmados y programados',
    color: 'bg-muted/40 border-border',
    textColor: 'text-foreground'
  },
  {
    id: 'in_progress' as ServiceStatus,
    title: 'En Progreso',
    description: 'Servicios ejecutándose actualmente',
    color: 'bg-muted/40 border-border',
    textColor: 'text-foreground'
  },
  {
    id: 'completed' as ServiceStatus,
    title: 'Completados',
    description: 'Servicios finalizados exitosamente',
    color: 'bg-muted/40 border-border',
    textColor: 'text-foreground'
  },
  {
    id: 'invoiced' as ServiceStatus,
    title: 'Facturados',
    description: 'Servicios facturados y cerrados',
    color: 'bg-muted/40 border-border',
    textColor: 'text-foreground'
  }
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  services,
  loading,
  clientId,
  onServiceUpdate
}) => {
  // Agrupar servicios por estado
  const servicesByStatus = useMemo(() => {
    const grouped = services.reduce((acc, service) => {
      const status = service.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(service);
      return acc;
    }, {} as Record<ServiceStatus, Service[]>);

    return grouped;
  }, [services]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p>Cargando pipeline del cliente...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 vip-pipeline-scope">
      {/* Board Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Pipeline de Servicios</h2>
        <div className="text-sm text-muted-foreground">
          Total: {services.length} servicios
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-6 gap-4 min-h-[500px]">
        {PIPELINE_COLUMNS.map(column => (
          <KanbanColumn
            key={column.id}
            column={column}
            services={servicesByStatus[column.id] || []}
            clientId={clientId}
            onServiceUpdate={onServiceUpdate}
          />
        ))}
      </div>

      {/* Board Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 text-xs">
        {PIPELINE_COLUMNS.map(column => {
          const count = servicesByStatus[column.id]?.length || 0;
          return (
            <div 
              key={`stat-${column.id}`}
              className={`p-2 rounded border ${column.color} text-center`}
            >
              <div className={`font-medium ${column.textColor}`}>{count}</div>
              <div className="text-muted-foreground truncate">{column.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};