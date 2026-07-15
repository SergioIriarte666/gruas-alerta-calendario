import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  Calendar,
  Eye,
  Phone,
  Mail
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface SupplierPayment {
  id: string;
  supplier_id: string;
  amount: number;
  due_date: string;
  paid_date?: string;
  description: string;
  category: string;
  reference_number?: string;
  notes?: string;
  status: string;
  suppliers?: {
    id: string;
    name: string;
    rut?: string;
    email?: string;
    phone?: string;
    contact_name?: string;
  };
}

interface SupplierPaymentsData {
  overdue: SupplierPayment[];
  dueToday: SupplierPayment[];
  dueThisWeek: SupplierPayment[];
  totalOverdue: number;
  totalDueToday: number;
  totalDueWeek: number;
}

interface SuppliersSectionProps {
  data?: SupplierPaymentsData;
  onViewPayment?: (payment: SupplierPayment) => void;
}

const PaymentCard: React.FC<{
  payment: SupplierPayment;
  priority: 'high' | 'medium' | 'low';
  onView?: (payment: SupplierPayment) => void;
}> = ({ payment, priority, onView }) => {
  const priorityConfig = {
    high: { 
      borderColor: 'border-red-200', 
      bgColor: 'bg-red-50', 
      textColor: 'text-red-600',
      badgeVariant: 'destructive' as const
    },
    medium: { 
      borderColor: 'border-orange-200', 
      bgColor: 'bg-orange-50', 
      textColor: 'text-orange-600',
      badgeVariant: 'secondary' as const
    },
    low: { 
      borderColor: 'border-blue-200', 
      bgColor: 'bg-blue-50', 
      textColor: 'text-blue-600',
      badgeVariant: 'outline' as const
    }
  };

  const config = priorityConfig[priority];
  const supplier = payment.suppliers;

  return (
    <Card className={`${config.borderColor} ${config.bgColor}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h4 className="font-semibold text-foreground">
              {supplier?.name || 'Proveedor sin nombre'}
            </h4>
            {supplier?.rut && (
              <p className="text-sm text-muted-foreground">RUT: {supplier.rut}</p>
            )}
          </div>
          <Badge variant={config.badgeVariant}>
            {formatCurrency(payment.amount)}
          </Badge>
        </div>

        <div className="space-y-2 mb-3">
          <p className="text-sm">
            <strong>Descripción:</strong> {payment.description}
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="size-4" />
              Vence: {new Date(payment.due_date).toLocaleDateString()}
            </div>
            <div className="flex items-center gap-1">
              <DollarSign className="size-4" />
              {payment.category && payment.category.length < 50 && !payment.category.includes('-') ? payment.category : 'Sin categoría'}
            </div>
          </div>
        </div>

        {supplier && (
          <div className="flex flex-wrap gap-2 mb-3 text-xs text-muted-foreground">
            {supplier.contact_name && (
              <span>Contacto: {supplier.contact_name}</span>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-1">
                <Phone className="size-3" />
                {supplier.phone}
              </div>
            )}
            {supplier.email && (
              <div className="flex items-center gap-1">
                <Mail className="size-3" />
                {supplier.email}
              </div>
            )}
          </div>
        )}

        {payment.reference_number && (
          <p className="text-xs text-muted-foreground mb-3">
            Ref: {payment.reference_number}
          </p>
        )}

        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onView?.(payment)}
            className="text-xs"
          >
            <Eye className="size-3 mr-1" />
            Ver Detalles
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const SuppliersSection: React.FC<SuppliersSectionProps> = ({ data, onViewPayment }) => {
  if (!data) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <DollarSign className="size-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">No hay datos de proveedores</h3>
          <p className="text-muted-foreground">
            No se encontraron pagos a proveedores para esta fecha.
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalPayments = (data.overdue?.length || 0) + (data.dueToday?.length || 0) + (data.dueThisWeek?.length || 0);
  const _totalAmount = (data.totalOverdue || 0) + (data.totalDueToday || 0) + (data.totalDueWeek || 0);

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pagos Vencidos</p>
                <p className="text-2xl font-bold text-red-600">
                  {data.overdue?.length || 0}
                </p>
                <p className="text-sm text-red-600">
                  {formatCurrency(data.totalOverdue || 0)}
                </p>
              </div>
              <AlertTriangle className="size-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vencen Hoy</p>
                <p className="text-2xl font-bold text-orange-600">
                  {data.dueToday?.length || 0}
                </p>
                <p className="text-sm text-orange-600">
                  {formatCurrency(data.totalDueToday || 0)}
                </p>
              </div>
              <Clock className="size-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Esta Semana</p>
                <p className="text-2xl font-bold text-blue-600">
                  {data.dueThisWeek?.length || 0}
                </p>
                <p className="text-sm text-blue-600">
                  {formatCurrency(data.totalDueWeek || 0)}
                </p>
              </div>
              <Calendar className="size-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {totalPayments === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <DollarSign className="size-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold text-lg mb-2">No hay pagos pendientes</h3>
            <p className="text-muted-foreground">
              No se encontraron pagos a proveedores pendientes para esta fecha.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Pagos Vencidos */}
          {data.overdue && data.overdue.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
                <AlertTriangle className="size-5" />
                Pagos Vencidos ({data.overdue.length})
                <Badge variant="destructive" className="ml-2">
                  CRÍTICO
                </Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.overdue.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    priority="high"
                    onView={onViewPayment}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pagos que Vencen Hoy */}
          {data.dueToday && data.dueToday.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-orange-600 mb-4 flex items-center gap-2">
                <Clock className="size-5" />
                Vencen Hoy ({data.dueToday.length})
                <Badge variant="secondary" className="ml-2">
                  URGENTE
                </Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.dueToday.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    priority="medium"
                    onView={onViewPayment}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Pagos que Vencen Esta Semana */}
          {data.dueThisWeek && data.dueThisWeek.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-blue-600 mb-4 flex items-center gap-2">
                <Calendar className="size-5" />
                Vencen Esta Semana ({data.dueThisWeek.length})
                <Badge variant="outline" className="ml-2">
                  PRÓXIMO
                </Badge>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.dueThisWeek.map((payment) => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    priority="low"
                    onView={onViewPayment}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export { SuppliersSection };