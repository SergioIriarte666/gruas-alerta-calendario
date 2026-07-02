import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit, Trash2, FileText, ArrowUpDown, ArrowUp, ArrowDown, Eye, Users, List, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceClosure } from '@/types';
import { Client } from '@/types';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { useDeviceType } from '@/hooks/useDeviceType';
import { ClosuresMobileView } from './ClosuresMobileView';
import ClosuresGroupedView from './ClosuresGroupedView';
import { ClosureStatusBadge } from './ClosureStatusBadge';
import { toTitleCase } from '@/lib/utils';

export type ClosureSortField = 'folio' | 'dateFrom' | 'clientId' | 'serviceCount' | 'total' | 'status';
export type SortDirection = 'asc' | 'desc';

interface ClosuresTableProps {
  closures: ServiceClosure[];
  clients: Client[];
  onEdit: (closure: ServiceClosure) => void;
  onDelete: (id: string, folio: string) => void;
  onClose: (id: string, folio: string) => void;
  onViewDetails: (closure: ServiceClosure) => void;
  sortField?: ClosureSortField;
  sortDirection?: SortDirection;
  onSort?: (field: ClosureSortField) => void;
}

const SortIcon = ({ field, currentSortField, sortDirection }: { 
  field: ClosureSortField; 
  currentSortField?: ClosureSortField; 
  sortDirection?: SortDirection 
}) => {
  if (currentSortField !== field) {
    return <ArrowUpDown className="ml-2 size-4 text-muted-foreground" />;
  }
  return sortDirection === 'asc' ? 
    <ArrowUp className="ml-2 size-4 text-primary" /> : 
    <ArrowDown className="ml-2 size-4 text-primary" />;
};

const ITEMS_PER_PAGE = 50;

const ClosuresTable = ({ closures, clients, onEdit, onDelete, onClose, onViewDetails, sortField, sortDirection, onSort }: ClosuresTableProps) => {
  const { isMobile } = useDeviceType();
  const [groupByClient, setGroupByClient] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const clientMap = useMemo(() => {
    return clients.reduce((acc, client) => {
      acc[client.id] = client;
      return acc;
    }, {} as Record<string, Client>);
  }, [clients]);

  const getClientName = useCallback((clientId?: string) => {
    if (!clientId) return 'Todos los clientes';
    const client = clientMap[clientId];
    if (!client) return 'Cliente desconocido';
    const dept = client.department;
    if (!dept || dept === 'General') return toTitleCase(client.name);
    return `${toTitleCase(client.name)} - ${dept}`;
  }, [clientMap]);

  const groupedClosures = useMemo(() => {
    if (!groupByClient) return [];
    
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
  }, [closures, getClientName, groupByClient]);

  // Reset page when grouping changes or closures change
  useEffect(() => {
    setCurrentPage(1);
  }, [groupByClient, closures.length]);

  const paginatedClosures = useMemo(() => {
    if (groupByClient) return [];
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return closures.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [closures, currentPage, groupByClient]);

  const paginatedGroups = useMemo(() => {
    if (!groupByClient) return [];
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return groupedClosures.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [groupedClosures, currentPage, groupByClient]);

  const totalPages = Math.ceil((groupByClient ? groupedClosures.length : closures.length) / ITEMS_PER_PAGE);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const tableElement = document.getElementById('closures-table-top');
    if (tableElement) {
      tableElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (isMobile) {
    return (
      <ClosuresMobileView
        closures={closures}
        clients={clients}
        onEdit={onEdit}
        onDelete={onDelete}
        onClose={onClose}
        onViewDetails={onViewDetails}
      />
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(Math.round(amount));
  };

  const formatDateRange = (dateRange: { from: string; to: string }) => {
    const fromDate = formatForDisplay(dateRange.from);
    const toDate = formatForDisplay(dateRange.to);
    return `${fromDate} - ${toDate}`;
  };

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm" id="closures-table-top">
      <CardHeader className="flex flex-row items-center justify-between gap-y-0 border-b border-border/60 pb-4">
        <CardTitle className="text-foreground">
          Lista de Cierres ({closures.length})
        </CardTitle>
        <div className="flex items-center gap-4">
          {!groupByClient && totalPages > 1 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Página {currentPage} de {totalPages}</span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupByClient(!groupByClient)}
            className="gap-2"
            title={groupByClient ? 'Vista plana' : 'Agrupar por cliente'}
          >
            {groupByClient ? <List className="size-4" /> : <Users className="size-4" />}
            {groupByClient ? 'Vista plana' : 'Por cliente'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {groupByClient ? (
          <ClosuresGroupedView
            groups={paginatedGroups}
            clientMap={clientMap}
            onEdit={onEdit}
            onDelete={onDelete}
            onClose={onClose}
            onViewDetails={onViewDetails}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30">
                  <TableHead 
                    className="text-foreground cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => onSort?.('folio')}
                  >
                    <div className="flex items-center">
                      Folio
                      <SortIcon field="folio" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-foreground cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => onSort?.('dateFrom')}
                  >
                    <div className="flex items-center">
                      Período
                      <SortIcon field="dateFrom" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-foreground cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => onSort?.('clientId')}
                  >
                    <div className="flex items-center">
                      Cliente
                      <SortIcon field="clientId" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-foreground cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => onSort?.('serviceCount')}
                  >
                    <div className="flex items-center">
                      Servicios
                      <SortIcon field="serviceCount" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-foreground cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => onSort?.('total')}
                  >
                    <div className="flex items-center">
                      Total
                      <SortIcon field="total" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead 
                    className="text-foreground cursor-pointer hover:text-primary transition-colors" 
                    onClick={() => onSort?.('status')}
                  >
                    <div className="flex items-center">
                      Estado
                      <SortIcon field="status" currentSortField={sortField} sortDirection={sortDirection} />
                    </div>
                  </TableHead>
                  <TableHead className="text-foreground text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClosures.map((closure) => (
                  <TableRow 
                    key={closure.id} 
                    className="cursor-pointer border-border/60 hover:bg-accent/20"
                    onClick={() => onViewDetails(closure)}
                  >
                    <TableCell className="text-foreground font-medium">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {closure.folio}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateRange(closure.dateRange)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getClientName(closure.clientId)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {closure.serviceCount ?? closure.serviceIds.length} servicios
                    </TableCell>
                    <TableCell className="text-foreground font-medium">
                      {formatCurrency(closure.total)}
                    </TableCell>
                    <TableCell>
                      <ClosureStatusBadge status={closure.status} />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onViewDetails(closure)}
                          title="Ver detalles"
                        >
                          <Eye className="size-4" />
                        </Button>
                        {closure.status === 'open' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onClose(closure.id, closure.folio)}
                          className="border-warning/20 bg-warning/10 text-warning hover:bg-warning/15"
                            title="Cerrar periodo"
                          >
                            <FileText className="size-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(closure)}
                          className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                          title="Editar cierre"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(closure.id, closure.folio)}
                          className="text-destructive border-destructive/40 hover:bg-destructive/10"
                          title="Eliminar cierre"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {paginatedClosures.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <FolderOpen className="size-10 text-muted-foreground/60" />
                <p className="font-medium text-foreground">No se encontraron cierres</p>
                <p className="text-sm text-muted-foreground">Ajusta los filtros o crea un nuevo cierre.</p>
              </div>
            )}

            {/* Bottom Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="size-4 mr-2" />
                  Anterior
                </Button>
                <div className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                  <ChevronRight className="size-4 ml-2" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default ClosuresTable;
