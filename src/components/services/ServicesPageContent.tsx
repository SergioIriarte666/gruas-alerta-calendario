
import React from 'react';
import { ServiceFilters } from '@/components/services/ServiceFilters';
import { ServicesTable } from '@/components/services/ServicesTable';
import { ServicesHeader } from '@/components/services/ServicesHeader';
import { ServicesDialogs } from '@/components/services/ServicesDialogs';
import { AppPagination } from '@/components/shared/AppPagination';
import { useServicesPage } from '@/hooks/services/useServicesPage';

export const ServicesPageContent: React.FC = () => {
  const {
    // State
    selectedService,
    isFormOpen,
    isDetailsOpen,
    isCSVUploadOpen,
    editingService,
    searchTerm,
    statusFilter,
    currentPage,
    refreshing,
    isAdmin,
    totalPages,
    paginatedServices,
    
    // Setters
    setIsFormOpen,
    setIsDetailsOpen,
    setIsCSVUploadOpen,
    setEditingService,
    setSearchTerm,
    setStatusFilter,
    setCurrentPage,
    setSelectedService,
    
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

  return (
    <div className="space-y-6 animate-fade-in">
      <ServicesHeader
        isAdmin={isAdmin}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onCSVUpload={() => setIsCSVUploadOpen(true)}
        onNewService={() => {
          setEditingService(null);
          setIsFormOpen(true);
        }}
      />

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
        onDetailsClose={() => {
          setIsDetailsOpen(false);
          setSelectedService(null);
        }}
      />
      
      <ServiceFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        onAdvancedFiltersChange={handleAdvancedFiltersChange}
      />

      <ServicesTable
        services={paginatedServices}
        hasInitialServices={true}
        onViewDetails={handleViewDetails}
        onEdit={isAdmin ? handleEdit : undefined}
        onDelete={isAdmin ? handleDelete : undefined}
        onCloseService={isAdmin ? handleCloseService : undefined}
        onAddNewService={isAdmin ? () => setIsFormOpen(true) : undefined}
      />

      <AppPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />
    </div>
  );
};
