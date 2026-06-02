import { type ClientService } from '@/hooks/portal/useClientServices';
import {
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
} from 'date-fns';
import { safeParseDateOnly } from '@/utils/timezoneUtils';

export const getPurchaseOrderPendingServices = (services: ClientService[] = []) => {
  return services.filter((service) => service.status === 'quoted');
};

export const getServicesForMonth = (
  services: ClientService[] = [],
  currentMonth: Date,
  statusFilter: string = 'all'
) => {
  return services.filter((service) => {
    const serviceDate = safeParseDateOnly(service.service_date);
    const matchesMonth = isSameMonth(serviceDate, currentMonth);
    const matchesStatus = statusFilter === 'all' || service.status === statusFilter;
    return matchesMonth && matchesStatus;
  });
};

export const getMonthStatusCounts = (services: ClientService[] = [], currentMonth: Date) => {
  const monthServices = getServicesForMonth(services, currentMonth, 'all');
  return monthServices.reduce<Record<string, number>>((accumulator, service) => {
    accumulator[service.status] = (accumulator[service.status] || 0) + 1;
    return accumulator;
  }, {});
};

export const getMonthBounds = (currentMonth: Date) => {
  return {
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  };
};

export const getServiceDateKey = (serviceDate: string) => {
  return format(safeParseDateOnly(serviceDate), 'yyyy-MM-dd');
};
