
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EnhancedServiceForm } from './EnhancedServiceForm';
import { ServiceDetailsModal } from './ServiceDetailsModal';
import { EnhancedCSVUploadServices } from './EnhancedCSVUploadServices';
import { Service } from '@/types';

interface ServicesDialogsProps {
  isCSVUploadOpen: boolean;
  onCSVUploadClose: () => void;
  onCSVSuccess: (count: number) => void;
  isFormOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  editingService: Service | null;
  prefilledData?: any;
  onCreateService: (serviceData: Service) => void;
  onUpdateService: (serviceData: Service) => void;
  selectedService: Service | null;
  isDetailsOpen: boolean;
  onDetailsClose: () => void;
  fromCalendarEvent?: boolean;
  onDuplicate?: (service: Service) => void;
}

export const ServicesDialogs = ({
  isCSVUploadOpen,
  onCSVUploadClose,
  onCSVSuccess,
  isFormOpen,
  onFormOpenChange,
  editingService,
  prefilledData,
  onCreateService,
  onUpdateService,
  selectedService,
  isDetailsOpen,
  onDetailsClose,
  fromCalendarEvent = false,
  onDuplicate
}: ServicesDialogsProps) => {
  return (
    <>
      <Dialog open={isCSVUploadOpen} onOpenChange={onCSVUploadClose}>
        <DialogContent className="max-h-[90vh] max-w-6xl w-[95vw] overflow-clip border-border/70 bg-card">
          <DialogHeader>
            <DialogTitle>Carga Masiva de Servicios</DialogTitle>
          </DialogHeader>
          <EnhancedCSVUploadServices
            onClose={onCSVUploadClose}
            onSuccess={onCSVSuccess}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={onFormOpenChange}>
        <DialogContent className="flex h-[95dvh] w-[95vw] flex-col overflow-hidden border-border/70 bg-card p-3 sm:p-6 lg:max-w-[90vw] lg:p-8 xl:max-w-[87.5rem]">
          <DialogHeader className="sr-only">
            <DialogTitle>
              {editingService ? `Editar Servicio` : 'Nuevo Servicio'}
            </DialogTitle>
          </DialogHeader>
          {/* Renderizado condicional para forzar desmontaje completo al cerrar.
              Radix Dialog no desmonta por defecto, lo que dejaba isSubmitting=true
              entre aperturas. Con esto React destruye y recrea el form en cada apertura. */}
          {isFormOpen && (
            <EnhancedServiceForm
              key={editingService?.id ?? 'new'}
              service={editingService}
              prefilledData={prefilledData}
              onSubmit={editingService ? onUpdateService : onCreateService}
              onCancel={() => onFormOpenChange(false)}
              fromCalendarEvent={fromCalendarEvent}
            />
          )}
        </DialogContent>
      </Dialog>

      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          isOpen={isDetailsOpen}
          onClose={onDetailsClose}
          onDuplicate={onDuplicate}
        />
      )}
    </>
  );
};
