import React from 'react';
import { useServicesPage } from '@/hooks/services/useServicesPage';
import { useServicesPendingExport } from '@/hooks/services/useServicesPendingExport';
import { ServicesHeader } from '@/components/services/ServicesHeader';
import { ServiceFilters } from '@/components/services/ServiceFilters';
import { ServicesTable } from '@/components/services/ServicesTable';
import { ServicesMobileView } from '@/components/services/ServicesMobileView';
import { ServicesPipelineView } from '@/components/services/ServicesPipelineView';
import { ServicesDialogs } from '@/components/services/ServicesDialogs';
import { AppPagination } from '@/components/shared/AppPagination';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

type ViewMode = 'table' | 'pipeline';

const Services = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
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
    prefilledData,
    fromCalendarEvent,
    sortField,
    sortDirection,
    
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
    handleSort,
  } = useServicesPage();

  const { 
    handleExportPendingServices, 
    isExporting: isExportingPending, 
    pendingServicesCount 
  } = useServicesPendingExport(services);

  const isMobile = useIsMobile();

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6 bg-white">
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
    <div className="container mx-auto py-6 space-y-6 bg-white min-h-screen">
      <ServicesHeader 
        isAdmin={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onCSVUpload={() => setIsCSVUploadOpen(true)}
        onNewService={() => setIsFormOpen(true)}
        onExportPending={handleExportPendingServices}
        isExportingPending={isExportingPending}
        pendingServicesCount={pendingServicesCount}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {viewMode === 'table' && (
        <>
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
              onDelete={isAdmin ? (service) => handleDelete(service) : undefined}
              onCloseService={handleCloseService}
              onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          ) : (
            <ServicesTable
              services={paginatedServices}
              hasInitialServices={services.length > 0}
              onViewDetails={handleViewDetails}
              onEdit={isAdmin ? handleEdit : undefined}
              onDelete={isAdmin ? (service) => handleDelete(service) : undefined}
              onCloseService={handleCloseService}
              onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />
          )}

          {totalPages > 1 && (
            <AppPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      {viewMode === 'pipeline' && (
        <ServicesPipelineView
          services={filteredServices}
          hasInitialServices={services.length > 0}
          onViewDetails={handleViewDetails}
          onEdit={isAdmin ? handleEdit : undefined}
          onDelete={isAdmin ? (id: string) => {
            const service = services.find(s => s.id === id);
            if (service) handleDelete(service);
          } : undefined}
          onCloseService={handleCloseService}
          onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
        />
      )}

      <ServicesDialogs
        isCSVUploadOpen={isCSVUploadOpen}
        onCSVUploadClose={() => setIsCSVUploadOpen(false)}
        onCSVSuccess={handleCSVSuccess}
        isFormOpen={isFormOpen}
        onFormOpenChange={handleFormOpenChange}
        editingService={editingService}
        prefilledData={prefilledData}
        onCreateService={handleCreateService}
        onUpdateService={handleUpdateService}
        selectedService={selectedService}
        isDetailsOpen={isDetailsOpen}
        onDetailsClose={() => setIsDetailsOpen(false)}
        fromCalendarEvent={fromCalendarEvent}
      />
    </div>
  );
};

export default Services;