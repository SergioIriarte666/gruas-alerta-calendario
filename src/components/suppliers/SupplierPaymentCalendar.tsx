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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Calendario de Pagos</h2>
          <p className="text-gray-400">Visualiza los pagos programados por mes</p>
        </div>
      </div>

      {/* Month Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Calendar className="h-6 w-6 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Total Pagos</p>
                <p className="text-xl font-bold text-white">{monthStats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-6 w-6 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">Pendientes</p>
                <p className="text-xl font-bold text-white">{monthStats.pending}</p>
                <p className="text-xs text-yellow-400">{formatCurrency(monthStats.pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="h-6 w-6 text-red-400" />
              <div>
                <p className="text-sm text-gray-400">Vencidos</p>
                <p className="text-xl font-bold text-white">{monthStats.overdue}</p>
                <p className="text-xs text-red-400">{formatCurrency(monthStats.overdueAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Pagados</p>
                <p className="text-xl font-bold text-white">{monthStats.paid}</p>
                <p className="text-xs text-green-400">{formatCurrency(monthStats.paidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white">
              {format(currentDate, 'MMMM yyyy', { locale: es })}
            </CardTitle>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="border-gray-600 text-gray-300 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(getCurrentChileDate())}
                className="border-gray-600 text-gray-300 hover:text-white"
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="border-gray-600 text-gray-300 hover:text-white"
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
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-400">
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
                    p-2 min-h-[80px] border border-gray-700 rounded-lg
                    ${isCurrentDay ? 'bg-blue-600/20 border-blue-500' : 'bg-gray-900'}
                    hover:bg-gray-700 transition-colors
                  `}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-sm font-medium ${isCurrentDay ? 'text-blue-300' : 'text-white'}`}>
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
                        <Badge className={`${getStatusColor(payment.status)} text-xs py-0 px-1`}>
                          {getStatusLabel(payment.status)}
                        </Badge>
                        <div className="text-gray-300 mt-1 truncate">
                          {getSupplierName(payment.supplier_id)}
                        </div>
                        <div className="text-gray-400 font-medium">
                          {formatCurrency(payment.amount)}
                        </div>
                      </div>
                    ))}
                    {dayPayments.length > 2 && (
                      <div className="text-xs text-gray-400 text-center">
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
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">
              Detalle de Pagos - {format(currentDate, 'MMMM yyyy', { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentsInMonth
                .sort((a, b) => parseFromDatabase(a.due_date).getTime() - parseFromDatabase(b.due_date).getTime())
                .map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <Badge className={getStatusColor(payment.status)}>
                          {getStatusLabel(payment.status)}
                        </Badge>
                        <span className="text-white font-medium">
                          {getSupplierName(payment.supplier_id)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        {payment.description}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">
                        {formatCurrency(payment.amount)}
                      </div>
                      <div className="text-sm text-gray-400">
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