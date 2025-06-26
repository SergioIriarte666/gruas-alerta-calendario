
import { useRef } from 'react';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperatorsData } from '@/hooks/operators/useOperatorsData';
import { useServiceTypes } from '@/hooks/useServiceTypes';
import { useUser } from '@/contexts/UserContext';
import { useToast } from '@/components/ui/custom-toast';
import { Service } from '@/types';
import { useServiceFormData } from './useServiceFormData';
import { useServiceFormEffects } from './useServiceFormEffects';
import { useServiceFormSubmission } from './useServiceFormSubmission';

interface UseServiceFormContainerProps {
  service?: Service | null;
  onSubmit: (serviceData: Omit<Service, 'id' | 'folio' | 'createdAt' | 'updatedAt'> & { folio: string }) => void;
}

export const useServiceFormContainer = ({ service, onSubmit }: UseServiceFormContainerProps) => {
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { data: operators = [] } = useOperatorsData();
  const { serviceTypes, loading: serviceTypesLoading } = useServiceTypes();
  const { user } = useUser();
  const { toast } = useToast();
  const markAsSubmittedRef = useRef<(() => void) | null>(null);

  const {
    isManualFolio,
    setIsManualFolio,
    folio,
    setFolio,
    formData,
    setFormData,
    requestDate,
    setRequestDate,
    serviceDate,
    setServiceDate
  } = useServiceFormData(service);

  const { handleGenerateNewFolio, folioLoading, markAsClearing } = useServiceFormEffects(
    isManualFolio,
    service,
    setFolio
  );

  const { handleSubmit } = useServiceFormSubmission({
    service,
    onSubmit,
    clients,
    cranes,
    operators,
    serviceTypes
  });

  const compatibleServiceTypes = serviceTypes.map(st => ({
    ...st,
    description: st.description || '',
  }));

  const selectedServiceType = serviceTypes.find(st => st.id === formData.serviceTypeId);
  
  const isInvoiced = service?.status === 'invoiced';
  const isAdmin = user?.role === 'admin';
  const canEdit = !isInvoiced || isAdmin;

  return {
    // Data
    clients,
    cranes,
    operators,
    serviceTypes: compatibleServiceTypes,
    serviceTypesLoading,
    selectedServiceType,
    
    // Form state
    isManualFolio,
    setIsManualFolio,
    folio,
    setFolio,
    formData,
    setFormData,
    requestDate,
    setRequestDate,
    serviceDate,
    setServiceDate,
    
    // Actions
    handleGenerateNewFolio,
    folioLoading,
    markAsClearing,
    handleSubmit,
    
    // Permissions
    canEdit,
    
    // Refs
    markAsSubmittedRef,
    
    // Toast
    toast
  };
};
