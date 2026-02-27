import { useState, useMemo } from 'react';
import { ChevronRight, Eye, Edit, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ServiceClosure } from '@/types';
import { Client } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';

interface ClosuresGroupedViewProps {
  closures: ServiceClosure[];
  clients: Client[];
  onEdit: (closure: ServiceClosure) => void;
  onDelete: (id: string, folio: string) => void;
  onClose: (id: string, folio: string) => void;
  onViewDetails: (closure: ServiceClosure) => void;
}

const ClosuresGroupedView = ({ closures, clients, onEdit, onDelete, onClose, onViewDetails }: ClosuresGroupedViewProps) => {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (key: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getClientName = (clientId?: string) => {
    if (!clientId) return 'Sin cliente asignado';
    const client = clients.find(c => c.id === clientId);
    if (!client) return 'Cliente desconocido';
    const dept = client.department;
    if (!dept || dept === 'General') return client.name;
    return `${client.name} - ${dept}`;
  };

  const getStatusBadge = (status: ServiceClosure['status']) => {
    switch (status) {
      case 'open':
        return <Badge className="status-pending">Abierto</Badge>;
      case 'closed':
        return <Badge className="status-closed">Cerrado</Badge>;
      case 'invoiced':
        return <Badge className="status-active">Facturado</Badge>;
      default:
        return <Badge className="bg-gray-500">Desconocido</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  const formatDateRange = (dateRange: { from: string; to: string }) => {
    return `${formatForDisplay(dateRange.from)} - ${formatForDisplay(dateRange.to)}`;
  };

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceClosure[]>();
    closures.forEach(c => {
      const key = c.clientId || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    // Sort groups alphabetically by client name
    return Array.from(map.entries()).sort((a, b) => {
      const nameA = getClientName(a[0] === '__none__' ? undefined : a[0]);
      const nameB = getClientName(b[0] === '__none__' ? undefined : b[0]);
      return nameA.localeCompare(nameB);
    });
  }, [closures, clients]);

  return (
    <div className="space-y-2">
      {grouped.map(([clientKey, groupClosures]) => {
        const clientName = getClientName(clientKey === '__none__' ? undefined : clientKey);
        const total = groupClosures.reduce((sum, c) => sum + c.total, 0);
        const isOpen = openGroups.has(clientKey);

        return (
          <Collapsible key={clientKey} open={isOpen} onOpenChange={() => toggleGroup(clientKey)}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3">
                  <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="font-medium text-foreground">{clientName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {groupClosures.length} {groupClosures.length === 1 ? 'cierre' : 'cierres'}
                  </Badge>
                </div>
                <span className="font-medium text-foreground text-sm">{formatCurrency(total)}</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-1 ml-4 border-l-2 border-border pl-4">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-foreground">Folio</TableHead>
                      <TableHead className="text-foreground">Período</TableHead>
                      <TableHead className="text-foreground">Servicios</TableHead>
                      <TableHead className="text-foreground">Total</TableHead>
                      <TableHead className="text-foreground">Estado</TableHead>
                      <TableHead className="text-foreground text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupClosures.map((closure) => (
                      <TableRow
                        key={closure.id}
                        className="border-border hover:bg-muted cursor-pointer"
                        onClick={() => onViewDetails(closure)}
                      >
                        <TableCell className="text-foreground font-medium">{closure.folio}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateRange(closure.dateRange)}</TableCell>
                        <TableCell className="text-muted-foreground">{closure.serviceIds.length} servicios</TableCell>
                        <TableCell className="text-foreground font-medium">{formatCurrency(closure.total)}</TableCell>
                        <TableCell>{getStatusBadge(closure.status)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" size="sm" onClick={() => onViewDetails(closure)} title="Ver detalles">
                              <Eye className="w-4 h-4" />
                            </Button>
                            {closure.status === 'open' && (
                              <Button variant="outline" size="sm" onClick={() => onClose(closure.id, closure.folio)} title="Cerrar periodo">
                                <FileText className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => onEdit(closure)} title="Editar cierre">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onDelete(closure.id, closure.folio)}
                              className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              title="Eliminar cierre"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
      {grouped.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No se encontraron cierres</p>
        </div>
      )}
    </div>
  );
};

export default ClosuresGroupedView;
