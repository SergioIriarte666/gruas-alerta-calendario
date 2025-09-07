import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Commission } from '@/types/commissions';
import { formatForDisplay, parseFromDatabase } from '@/utils/timezoneUtils';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { EditPaymentDateDialog } from './EditPaymentDateDialog';

export type SortField = 'status' | 'folio' | 'service_date' | 'client_name' | 'operator_name' | 'service_value' | 'amount' | 'commission_percentage' | 'created_at' | 'payment_date';
export type SortDirection = 'asc' | 'desc' | null;

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
  commissions,
  selectedCommissions,
  onToggleCommission,
  sortField,
  sortDirection,
  onSort,
  onPaymentDateUpdated
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = parseFromDatabase(dateString);
    return formatForDisplay(date);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-4 h-4" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="w-4 h-4" />;
    }
    return <ArrowUpDown className="w-4 h-4" />;
  };

  const SortButton: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium hover:bg-transparent justify-start"
      onClick={() => onSort(field)}
    >
      <span className="mr-2">{children}</span>
      {getSortIcon(field)}
    </Button>
  );

  const getStatusBadge = (status: 'pending' | 'paid') => {
    if (status === 'paid') {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Pagada</Badge>;
    }
    return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
  };

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <span className="sr-only">Seleccionar</span>
            </TableHead>
            <TableHead>
              <SortButton field="status">Estado</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="folio">Folio</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="service_date">Fecha Servicio</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="client_name">Cliente</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="operator_name">Operador</SortButton>
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="service_value">Valor Servicio</SortButton>
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="amount">Comisión</SortButton>
            </TableHead>
            <TableHead className="text-right">
              <SortButton field="commission_percentage">%</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="created_at">Fecha Creación</SortButton>
            </TableHead>
            <TableHead>
              <SortButton field="payment_date">Fecha Pago</SortButton>
            </TableHead>
            <TableHead className="w-32">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {commissions.map((commission) => (
            <TableRow key={commission.id}>
              <TableCell>
                <Checkbox
                  checked={selectedCommissions.includes(commission.id)}
                  onCheckedChange={() => onToggleCommission(commission.id)}
                  disabled={commission.status === 'paid'}
                />
              </TableCell>
              <TableCell>
                {getStatusBadge(commission.status)}
              </TableCell>
              <TableCell className="font-medium">
                {commission.service_folio || 'N/A'}
              </TableCell>
              <TableCell>
                {commission.services?.service_date 
                  ? formatDate(commission.services.service_date)
                  : formatDate(commission.date)
                }
              </TableCell>
              <TableCell>
                {commission.client_name}
              </TableCell>
              <TableCell>
                {commission.operators?.name || 'N/A'}
              </TableCell>
              <TableCell className="text-right">
                {commission.service_value ? formatCurrency(commission.service_value) : 'N/A'}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatCurrency(commission.amount)}
              </TableCell>
              <TableCell className="text-right">
                {commission.commission_percentage ? `${commission.commission_percentage}%` : 'N/A'}
              </TableCell>
              <TableCell>
                {formatDate(commission.created_at)}
              </TableCell>
              <TableCell>
                {commission.payment_date ? (
                  <span className="text-green-700 font-medium">
                    {formatDate(commission.payment_date)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                {commission.status === 'paid' && (
                  <EditPaymentDateDialog
                    commissions={[commission]}
                    onSuccess={onPaymentDateUpdated}
                  />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};