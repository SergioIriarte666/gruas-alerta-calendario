import React, { useState, useEffect } from 'react';
import { CostCentersHeader } from './CostCentersHeader';
import { CostCentersTable } from './CostCentersTable';
import { CostCenterForm } from './CostCenterForm';
import { CostCenterStats } from './CostCenterStats';
import { useCostCentersWithStats } from '@/hooks/useCostCenters';
import { CostCenter } from '@/types/costCenters';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from "@/lib/logger";


const logger = createLogger("CostCentersPage");
export const CostCentersPage = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const queryClient = useQueryClient();
  const { data: costCenters = [], isLoading, refetch } = useCostCentersWithStats();

  // Set up realtime updates for costs to refresh cost centers stats
  useEffect(() => {
    const channel = supabase.channel('cost-center-updates');

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'costs'
        },
        () => {
          logger.debug('Cost updated, refreshing cost centers stats');
          queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cost_centers'
        },
        () => {
          logger.debug('Cost center updated, refreshing data');
          queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
          queryClient.invalidateQueries({ queryKey: ['cost-centers-stats'] });
        }
      );

    channel.subscribe();

    return () => {
      void channel.unsubscribe();
    };
  }, [queryClient]);

  const handleOpenForm = (costCenter: CostCenter | null = null) => {
    setSelectedCostCenter(costCenter);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedCostCenter(null);
  };

  const handleRefresh = async () => {
    logger.debug('Manual refresh triggered for cost centers');
    try {
      // Force refetch with fresh data
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['cost-centers-stats'] }),
        queryClient.refetchQueries({ queryKey: ['cost-centers'] }),
        queryClient.refetchQueries({ queryKey: ['costs'] }),
      ]);
      logger.debug('All queries refetched successfully');
    } catch (error) {
      logger.error('Error refreshing cost centers:', error);
    }
  };

  const filteredCostCenters = costCenters.filter(center => 
    center.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    center.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (center.description && center.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <CostCentersHeader 
        onAddCostCenter={() => handleOpenForm(null)}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        totalCostCenters={costCenters.length}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />
      
      <CostCenterStats costCenters={costCenters} />
      
      <CostCentersTable
        costCenters={filteredCostCenters}
        onEdit={handleOpenForm}
        loading={isLoading}
      />
      
      <CostCenterForm
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        costCenter={selectedCostCenter}
      />
    </div>
  );
};
