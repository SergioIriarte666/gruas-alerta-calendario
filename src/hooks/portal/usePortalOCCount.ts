import { useClientServices } from '@/hooks/portal/useClientServices';

export const usePortalOCCount = () => {
  const { data: services } = useClientServices();
  return services?.filter((service) => service.needs_purchase_order).length || 0;
};
