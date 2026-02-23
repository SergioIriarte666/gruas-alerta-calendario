
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
  onCreateService: (serviceData: any) => void;
  onUpdateService: (serviceData: any) => void;
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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editingService ? `Editar Servicio ${editingService.status === 'invoiced' ? '(⚠️ FACTURADO)' : ''}` : 'Nuevo Servicio'}
            </DialogTitle>
          </DialogHeader>
          <EnhancedServiceForm
            service={editingService}
            prefilledData={prefilledData}
            onSubmit={editingService ? onUpdateService : onCreateService}
            onCancel={() => onFormOpenChange(false)}
            fromCalendarEvent={fromCalendarEvent}
          />
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
