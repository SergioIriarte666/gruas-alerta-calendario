import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSupplierPayments, getStatusColor, getStatusLabel } from '@/hooks/useSupplierPayments';
import { useSuppliers } from '@/hooks/useSuppliers';
import { formatCurrency } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  getCurrentChileDate, 
  parseFromDatabase, 
  formatForInput, 
  formatForDisplay,
  getCurrentMonthRange,
  toChileTime
} from '@/utils/timezoneUtils';

export const SupplierPaymentCalendar: React.FC = () => {
  const { payments } = useSupplierPayments();
  const { suppliers } = useSuppliers();
  const [currentDate, setCurrentDate] = useState(getCurrentChileDate());

  const monthStart = startOfMonth(toChileTime(currentDate));
  const monthEnd = endOfMonth(toChileTime(currentDate));
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const paymentsInMonth = useMemo(() => {
    return payments.filter(payment => {
      const paymentDate = parseFromDatabase(payment.due_date);
      const paymentDateString = formatForInput(paymentDate);
      const monthStartString = formatForInput(monthStart);
      const monthEndString = formatForInput(monthEnd);
      
      return paymentDateString >= monthStartString && paymentDateString <= monthEndString;
    });
  }, [payments, monthStart, monthEnd]);

  const getPaymentsForDay = (date: Date) => {
    const dateString = formatForInput(date);
    return paymentsInMonth.filter(payment => {
      const paymentDate = parseFromDatabase(payment.due_date);
      const paymentDateString = formatForInput(paymentDate);
      return paymentDateString === dateString;
    });
  };

  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.name || 'Proveedor';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => 
      direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
    );
  };

  const monthStats = useMemo(() => {
    const pending = paymentsInMonth.filter(p => p.status === 'pending');
    const overdue = paymentsInMonth.filter(p => p.status === 'overdue');
    const paid = paymentsInMonth.filter(p => p.status === 'paid');

    return {
      total: paymentsInMonth.length,
      pending: pending.length,
      overdue: overdue.length,
      paid: paid.length,
      pendingAmount: pending.reduce((sum, p) => sum + p.amount, 0),
      overdueAmount: overdue.reduce((sum, p) => sum + p.amount, 0),
      paidAmount: paid.reduce((sum, p) => sum + p.amount, 0)
    };
  }, [paymentsInMonth]);

  return (
    <div className="space-y-6 suppliers-scope">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Calendario de Pagos</h2>
          <p className="text-muted-foreground">Visualiza los pagos programados por mes</p>
        </div>
      </div>

      {/* Month Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Calendar className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Pagos</p>
                <p className="text-xl font-bold text-foreground">{monthStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-6 w-6 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Pendientes</p>
                <p className="text-xl font-bold text-foreground">{monthStats.pending}</p>
                <p className="text-xs text-yellow-600">{formatCurrency(monthStats.pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Vencidos</p>
                <p className="text-xl font-bold text-foreground">{monthStats.overdue}</p>
                <p className="text-xs text-destructive">{formatCurrency(monthStats.overdueAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Pagados</p>
                <p className="text-xl font-bold text-foreground">{monthStats.paid}</p>
                <p className="text-xs text-primary">{formatCurrency(monthStats.paidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="bg-card border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(getCurrentChileDate())}
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}

            {/* Empty cells for days before month start */}
            {Array.from({ length: monthStart.getDay() }).map((_, index) => (
              <div key={`empty-${index}`} className="p-2" />
            ))}

            {/* Month Days */}
            {monthDays.map((date) => {
              const dayPayments = getPaymentsForDay(date);
              const today = getCurrentChileDate();
              const isCurrentDay = formatForInput(date) === formatForInput(today);

              return (
                <div
                  key={date.toString()}
                  className={`
                    p-2 min-h-[80px] border rounded-lg transition-colors
                    ${isCurrentDay ? 'bg-primary/10 border-primary' : 'bg-muted/50 border hover:bg-muted'}
                  `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-sm font-medium ${isCurrentDay ? 'text-primary' : 'text-foreground'}`}>
                      {format(date, 'd')}
                    </span>
                    {dayPayments.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {dayPayments.length}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-1">
                    {dayPayments.slice(0, 2).map((payment) => (
                      <div
                        key={payment.id}
                        className="text-xs p-1 rounded truncate"
                        title={`${getSupplierName(payment.supplier_id)}: ${payment.description} - ${formatCurrency(payment.amount)}`}
                      >
                        <Badge className={`${getStatusColor(payment.status)} text-xs py-0 px-1 text-black`}>
                          {getStatusLabel(payment.status)}
                        </Badge>
                        <div className="text-foreground mt-1 truncate">
                          {getSupplierName(payment.supplier_id)}
                        </div>
                        <div className="text-muted-foreground font-medium">
                          {formatCurrency(payment.amount)}
                        </div>
                      </div>
                    ))}
                    {dayPayments.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayPayments.length - 2} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Payment Details for Selected Month */}
      {paymentsInMonth.length > 0 && (
        <Card className="bg-card border">
          <CardHeader>
            <CardTitle className="text-foreground">
              Detalle de Pagos - {format(currentDate, 'MMMM yyyy', { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentsInMonth
                .sort((a, b) => parseFromDatabase(a.due_date).getTime() - parseFromDatabase(b.due_date).getTime())
                .map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(payment.status)}>
                          {getStatusLabel(payment.status)}
                        </Badge>
                        <span className="text-foreground font-medium">
                          {getSupplierName(payment.supplier_id)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {payment.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-foreground font-medium">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatForDisplay(parseFromDatabase(payment.due_date))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};