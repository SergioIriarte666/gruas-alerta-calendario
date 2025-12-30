import { PaymentWithDetails } from '@/types/payments';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Edit, Eye, CalendarDays, Building2 } from 'lucide-react';

interface PaymentCardProps {
  payment: PaymentWithDetails;
  onManualApplication: (payment: PaymentWithDetails) => void;
  onSelectiveApplication: (payment: PaymentWithDetails) => void;
  onViewDetail: (payment: PaymentWithDetails) => void;
  showSensitiveData?: boolean;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount);
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'applied':
      return { label: 'Aplicado', variant: 'default' as const, color: 'bg-green-500' };
    case 'partial':
      return { label: 'Parcial', variant: 'secondary' as const, color: 'bg-blue-500' };
    case 'pending':
      return { label: 'Pendiente', variant: 'outline' as const, color: 'bg-amber-500' };
    default:
      return { label: status, variant: 'outline' as const, color: 'bg-gray-500' };
  }
};

export const PaymentCard = ({
  payment,
  onManualApplication,
  onSelectiveApplication,
  onViewDetail,
  showSensitiveData = true,
}: PaymentCardProps) => {
  const statusConfig = getStatusConfig(payment.status);
  const progressPercent = payment.amount > 0 
    ? (payment.applied_amount / payment.amount) * 100 
    : 0;

  return (
    <Card className="hover:shadow-md transition-all hover:border-violet-200 group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <p className="font-semibold truncate">{payment.client?.name}</p>
            </div>
            {payment.bank_reference && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                Ref: {payment.bank_reference}
              </p>
            )}
          </div>
          <Badge variant={statusConfig.variant}>
            {statusConfig.label}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {new Date(payment.payment_date).toLocaleDateString('es-CL')}
            </div>
            <p className="text-xl font-bold text-violet-600">
              {showSensitiveData ? formatCurrency(payment.amount) : '••••••'}
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Aplicado: {showSensitiveData ? formatCurrency(payment.applied_amount) : '••••••'}</span>
              <span>Pendiente: {showSensitiveData ? formatCurrency(payment.remaining_amount) : '••••••'}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            {(payment.status === 'pending' || payment.remaining_amount > 0) && (
              <>
                <Button
                  onClick={() => onManualApplication(payment)}
                  size="sm"
                  variant="default"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <Edit className="h-3.5 w-3.5 mr-1" />
                  Aplicar
                </Button>
                <Button
                  onClick={() => onSelectiveApplication(payment)}
                  size="sm"
                  variant="outline"
                  className="text-violet-600 border-violet-300 hover:bg-violet-50"
                >
                  Selectivo
                </Button>
              </>
            )}
            {payment.applied_amount > 0 && (
              <Button
                onClick={() => onViewDetail(payment)}
                size="sm"
                variant="ghost"
                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
              >
                <Eye className="h-3.5 w-3.5 mr-1" />
                Ver Detalle
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
