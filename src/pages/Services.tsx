
import React from 'react';
import { useServicesPage } from '@/hooks/services/useServicesPage';
import { ServicesHeader } from '@/components/services/ServicesHeader';
import { ServiceFilters } from '@/components/services/ServiceFilters';
import { ServicesTable } from '@/components/services/ServicesTable';
import { ServicesMobileView } from '@/components/services/ServicesMobileView';
import { ServicesDialogs } from '@/components/services/ServicesDialogs';
import { AppPagination } from '@/components/shared/AppPagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';

const Services = () => {
  const {
    // State
    services,
    loading,
    selectedService,
    isFormOpen,
    isDetailsOpen,
    isCSVUploadOpen,
    editingService,
    searchTerm,
    statusFilter,
    currentPage,
    refreshing,
    hasAdvancedFilters,
    isAdmin,
    filteredServices,
    totalPages,
    paginatedServices,
    ITEMS_PER_PAGE,
    
    // Setters
    setIsCSVUploadOpen,
    setIsFormOpen,
    setIsDetailsOpen,
    setSearchTerm,
    setStatusFilter,
    setCurrentPage,
    
    // Handlers
    handleAdvancedFiltersChange,
    handleRefresh,
    handleCreateService,
    handleUpdateService,
    handleFormOpenChange,
    handleCloseService,
    handleViewDetails,
    handleEdit,
    handleDelete,
    handleCSVSuccess,
  } = useServicesPage();

  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <ServicesHeader 
        isAdmin={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onCSVUpload={() => setIsCSVUploadOpen(true)}
        onNewService={() => setIsFormOpen(true)}
      />

      <ServiceFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onAdvancedFiltersChange={handleAdvancedFiltersChange}
      />

      {isMobile ? (
        <ServicesMobileView
          services={paginatedServices}
          hasInitialServices={services.length > 0}
          onViewDetails={handleViewDetails}
          onEdit={isAdmin ? handleEdit : undefined}
          onDelete={isAdmin ? handleDelete : undefined}
          onCloseService={handleCloseService}
          onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
        />
      ) : (
        <ServicesTable
          services={paginatedServices}
          hasInitialServices={services.length > 0}
          onViewDetails={handleViewDetails}
          onEdit={isAdmin ? handleEdit : undefined}
          onDelete={isAdmin ? handleDelete : undefined}
          onCloseService={handleCloseService}
          onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
        />
      )}

      {totalPages > 1 && (
        <AppPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      <ServicesDialogs
        isCSVUploadOpen={isCSVUploadOpen}
        onCSVUploadClose={() => setIsCSVUploadOpen(false)}
        onCSVSuccess={handleCSVSuccess}
        isFormOpen={isFormOpen}
        onFormOpenChange={handleFormOpenChange}
        editingService={editingService}
        onCreateService={handleCreateService}
        onUpdateService={handleUpdateService}
        selectedService={selectedService}
        isDetailsOpen={isDetailsOpen}
        onDetailsClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
};

export default Services;
