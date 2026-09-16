import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Commission } from '@/types/commissions';
import { formatForDisplay } from '@/utils/timezoneUtils';
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { EditPaymentDateDialog } from './EditPaymentDateDialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ServiceDetailsModal } from '@/components/services/ServiceDetailsModal';
import { useServiceDetails } from '@/hooks/useServiceDetails';
import { useNavigate } from 'react-router-dom';

export type SortField = 'status' | 'folio' | 'service_date' | 'client_name' | 'operator_name' | 'service_value' | 'amount' | 'commission_percentage' | 'created_at' | 'payment_date';
export type SortDirection = 'asc' | 'desc' | null;

const currencyFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
});

interface SortButtonProps {
  field: SortField;
  children: React.ReactNode;
  onSort: (field: SortField) => void;
  icon: React.ReactNode;
}

interface CommissionFolioProps {
  commission: Commission;
  onOpenService: (commission: Commission) => void;
}

const SortButton: React.FC<SortButtonProps> = ({ field, children, onSort, icon }) => (
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="h-auto p-0 font-medium hover:bg-transparent justify-start"
    onClick={() => onSort(field)}
  >
    <span className="mr-2">{children}</span>
    {icon}
  </Button>
);

const CommissionFolio: React.FC<CommissionFolioProps> = ({ commission, onOpenService }) => {
  const folio = commission.service_folio || commission.services?.folio || 'N/A';
  const id = commission.services?.id || commission.service_id;

  if (!id) {
    return <span>{folio}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenService(commission)}
      className="cursor-pointer text-left text-primary underline hover:text-primary/80"
    >
      {folio}
    </button>
  );
};

interface CommissionTableProps {
  commissions: Commission[];
  selectedCommissions: string[];
  onToggleCommission: (commissionId: string) => void;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onPaymentDateUpdated?: () => void;
}

export const CommissionTable: React.FC<CommissionTableProps> = ({
  commissions, selectedCommissions, onToggleCommission,
  sortField, sortDirection, onSort, onPaymentDateUpdated
}) => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const { data: serviceDetails } = useServiceDetails(selectedServiceId);

  const handleServiceClick = (commission: Commission) => {
    const id = commission.services?.id || commission.service_id;
    if (id) setSelectedServiceId(id);
  };

  const formatCurrency = (amount: number) => {
    return currencyFormatter.format(amount);
  };

  const formatDate = (dateString: string) => {
    return formatForDisplay(dateString);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="size-4" />;
    if (sortDirection === 'asc') return <ArrowUp className="size-4" />;
    if (sortDirection === 'desc') return <ArrowDown className="size-4" />;
    return <ArrowUpDown className="size-4" />;
  };

  const getStatusBadge = (status: 'pending' | 'paid') => {
    if (status === 'paid') return <Badge variant="success">Pagada</Badge>;
    return <Badge variant="warning">Pendiente</Badge>;
  };

  if (isMobile) {
    return (
      <div className="space-y-3">
        {commissions.map((commission) => (
          <Card key={commission.id} className="bg-card border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <Checkbox
                    checked={selectedCommissions.includes(commission.id)}
                    onCheckedChange={() => onToggleCommission(commission.id)}
                    disabled={commission.status === 'paid'}
                    className="mt-1"
                  />
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm">
                      <CommissionFolio commission={commission} onOpenService={handleServiceClick} />
                    </p>
                    <p className="text-xs text-muted-foreground">{commission.client_name}</p>
                    <p className="text-xs text-muted-foreground">{commission.operators?.name || 'N/A'}</p>
                  </div>
                </div>
                {getStatusBadge(commission.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Servicio: </span>
                  <span className="font-medium text-foreground">
                    {commission.service_value ? formatCurrency(commission.service_value) : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Comisión: </span>
                  <span className="font-bold text-foreground">{formatCurrency(commission.amount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">%: </span>
                  <span className="text-foreground">{commission.commission_percentage ? `${commission.commission_percentage}%` : 'N/A'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha: </span>
                  <span className="text-foreground">
                    {commission.services?.service_date ? formatDate(commission.services.service_date) : formatDate(commission.date)}
                  </span>
                </div>
              </div>

              {commission.payment_date && (
                <div className="flex items-center justify-between pt-1 border-t text-xs">
                  <span className="font-medium text-success-text">Pagado: {formatDate(commission.payment_date)}</span>
                  <div className="flex items-center gap-1">
                    {commission.status === 'paid' && (
                      <EditPaymentDateDialog commissions={[commission]} onSuccess={onPaymentDateUpdated} />
                    )}
                    {commission.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver en módulo de Costos"
                        onClick={() => navigate(`/costs?costId=${commission.id}`)}
                      >
                        <ExternalLink className="size-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {selectedServiceId && serviceDetails && (
          <ServiceDetailsModal
            service={serviceDetails}
            isOpen={!!selectedServiceId}
            onClose={() => setSelectedServiceId(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"><span className="sr-only">Seleccionar</span></TableHead>
            <TableHead><SortButton field="status" onSort={onSort} icon={getSortIcon('status')}>Estado</SortButton></TableHead>
            <TableHead><SortButton field="folio" onSort={onSort} icon={getSortIcon('folio')}>Folio</SortButton></TableHead>
            <TableHead><SortButton field="service_date" onSort={onSort} icon={getSortIcon('service_date')}>Fecha Servicio</SortButton></TableHead>
            <TableHead><SortButton field="client_name" onSort={onSort} icon={getSortIcon('client_name')}>Cliente</SortButton></TableHead>
            <TableHead><SortButton field="operator_name" onSort={onSort} icon={getSortIcon('operator_name')}>Operador</SortButton></TableHead>
            <TableHead className="text-right"><SortButton field="service_value" onSort={onSort} icon={getSortIcon('service_value')}>Valor Servicio</SortButton></TableHead>
            <TableHead className="text-right"><SortButton field="amount" onSort={onSort} icon={getSortIcon('amount')}>Comisión</SortButton></TableHead>
            <TableHead className="text-right"><SortButton field="commission_percentage" onSort={onSort} icon={getSortIcon('commission_percentage')}>%</SortButton></TableHead>
            <TableHead><SortButton field="created_at" onSort={onSort} icon={getSortIcon('created_at')}>Fecha Creación</SortButton></TableHead>
            <TableHead><SortButton field="payment_date" onSort={onSort} icon={getSortIcon('payment_date')}>Fecha Pago</SortButton></TableHead>
            <TableHead className="w-32">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {commissions.map((commission) => (
            <TableRow key={commission.id}>
              <TableCell>
                <Checkbox checked={selectedCommissions.includes(commission.id)} onCheckedChange={() => onToggleCommission(commission.id)} disabled={commission.status === 'paid'} />
              </TableCell>
              <TableCell>{getStatusBadge(commission.status)}</TableCell>
              <TableCell className="font-medium">
                <CommissionFolio commission={commission} onOpenService={handleServiceClick} />
              </TableCell>
              <TableCell>{commission.services?.service_date ? formatDate(commission.services.service_date) : formatDate(commission.date)}</TableCell>
              <TableCell>{commission.client_name}</TableCell>
              <TableCell>{commission.operators?.name || 'N/A'}</TableCell>
              <TableCell className="text-right">{commission.service_value ? formatCurrency(commission.service_value) : 'N/A'}</TableCell>
              <TableCell className="text-right font-medium">{formatCurrency(commission.amount)}</TableCell>
              <TableCell className="text-right">{commission.commission_percentage ? `${commission.commission_percentage}%` : 'N/A'}</TableCell>
              <TableCell>{formatDate(commission.created_at)}</TableCell>
              <TableCell>
                {commission.payment_date ? (
                  <span className="font-medium text-success-text">{formatDate(commission.payment_date)}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {commission.status === 'paid' && (
                    <EditPaymentDateDialog commissions={[commission]} onSuccess={onPaymentDateUpdated} />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Ver en módulo de Costos"
                    onClick={() => navigate(`/costs?costId=${commission.id}`)}
                  >
                    <ExternalLink className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedServiceId && serviceDetails && (
        <ServiceDetailsModal
          service={serviceDetails}
          isOpen={!!selectedServiceId}
          onClose={() => setSelectedServiceId(null)}
        />
      )}
    </div>
  );
};
