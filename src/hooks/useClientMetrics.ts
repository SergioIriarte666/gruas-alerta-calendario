import { useMemo } from 'react';
import { useClientServices } from './useClientServices';
import { useClientInvoices } from './useClientInvoices';
import { useClientClosures } from './useClientClosures';
import { useClientRequests } from './useClientRequests';
import { getDisplayServiceValue } from '@/utils/serviceValueCalculations';
import { businessClock } from '@/utils/businessClock';

export const useClientMetrics = (clientId: string | null) => {
  const { services, loading: servicesLoading, metrics: serviceMetrics } = useClientServices(clientId);
  const { invoices, loading: invoicesLoading, metrics: invoiceMetrics } = useClientInvoices(clientId);
  const { closures, loading: closuresLoading, metrics: closureMetrics } = useClientClosures(clientId);
  const { requests, loading: requestsLoading, metrics: requestMetrics } = useClientRequests(clientId);

  const loading = servicesLoading || invoicesLoading || closuresLoading || requestsLoading;

  const consolidatedMetrics = useMemo(() => {
    if (!clientId || loading) return null;

    // Calcular métricas de rendimiento del cliente
    const completedServices = services.filter(s => s.status === 'completed');
    const avgServiceValue = completedServices.length > 0 
      ? completedServices.reduce((sum, s) => sum + getDisplayServiceValue(s), 0) / completedServices.length 
      : 0;

    // Calcular tendencias mensuales (últimos 6 meses)
    const sixMonthsAgo = businessClock.todayDate();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const recentServices = services.filter(s => 
      new Date(s.serviceDate) >= sixMonthsAgo && s.status === 'completed'
    );
    
    const monthlyTrend = recentServices.reduce((acc: Record<string, number>, service) => {
      const month = new Date(service.serviceDate).toISOString().slice(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + getDisplayServiceValue(service);
      return acc;
    }, {});

    // Métricas de pago
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    const avgPaymentTime = paidInvoices.length > 0
      ? paidInvoices.reduce((sum, invoice) => {
          if (invoice.paymentDate) {
            const daysToPayment = Math.ceil(
              (new Date(invoice.paymentDate).getTime() - new Date(invoice.issueDate).getTime()) 
              / (1000 * 60 * 60 * 24)
            );
            return sum + daysToPayment;
          }
          return sum;
        }, 0) / paidInvoices.length
      : 0;

    return {
      // Métricas generales
      totalLifetimeValue: serviceMetrics.totalBilled,
      avgServiceValue,
      totalServices: serviceMetrics.totalServices,
      completedServicesCount: completedServices.length,
      
      // Métricas de facturación
      totalInvoiced: invoiceMetrics.totalInvoiced,
      totalPaid: invoiceMetrics.totalPaid,
      pendingAmount: invoiceMetrics.pendingAmount,
      avgPaymentTime: Math.round(avgPaymentTime),
      
      // Estado actual
      activeRequests: requestMetrics.pendingRequests,
      overdueInvoices: invoiceMetrics.overdueInvoices,
      openClosures: closureMetrics.openClosures,
      
      // Tendencias
      monthlyTrend: Object.entries(monthlyTrend).map(([month, value]) => ({
        month,
        value
      })).sort((a, b) => a.month.localeCompare(b.month)),
      
      // Métricas de rendimiento
      serviceSuccessRate: services.length > 0 
        ? (completedServices.length / services.length) * 100 
        : 0,
      
      // Últimas actividades
      lastServiceDate: services.length > 0 
        ? Math.max(...services.map(s => new Date(s.serviceDate).getTime()))
        : null,
      lastInvoiceDate: invoices.length > 0
        ? Math.max(...invoices.map(i => new Date(i.issueDate).getTime()))
        : null,
    };
  }, [services, invoices, closures, requests, clientId, loading, serviceMetrics, invoiceMetrics, closureMetrics, requestMetrics]);

  return {
    metrics: consolidatedMetrics,
    loading,
    rawData: {
      services,
      invoices,
      closures,
      requests,
    },
    individualMetrics: {
      serviceMetrics,
      invoiceMetrics,
      closureMetrics,
      requestMetrics,
    }
  };
};