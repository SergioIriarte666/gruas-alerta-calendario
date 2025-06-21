
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ServiceForm } from './ServiceForm';
import { ServiceDetailsModal } from './ServiceDetailsModal';
import { CSVUploadServices } from './CSVUploadServices';
import { Service } from '@/types';

interface ServicesDialogsProps {
  isCSVUploadOpen: boolean;
  onCSVUploadClose: () => void;
  onCSVSuccess: (count: number) => void;
  isFormOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  editingService: Service | null;
  onCreateService: (serviceData: any) => void;
  onUpdateService: (serviceData: any) => void;
  selectedService: Service | null;
  isDetailsOpen: boolean;
  onDetailsClose: () => void;
}

export const ServicesDialogs = ({
  isCSVUploadOpen,
  onCSVUploadClose,
  onCSVSuccess,
  isFormOpen,
  onFormOpenChange,
  editingService,
  onCreateService,
  onUpdateService,
  selectedService,
  isDetailsOpen,
  onDetailsClose
}: ServicesDialogsProps) => {
  return (
    <>
      <Dialog open={isCSVUploadOpen} onOpenChange={onCSVUploadClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Carga Masiva de Servicios</DialogTitle>
          </DialogHeader>
          <CSVUploadServices
            onClose={onCSVUploadClose}
            onSuccess={onCSVSuccess}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isFormOpen} onOpenChange={onFormOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingService ? `Editar Servicio ${editingService.status === 'invoiced' ? '(⚠️ FACTURADO)' : ''}` : 'Nuevo Servicio'}
            </DialogTitle>
          </DialogHeader>
          <ServiceForm
            service={editingService}
            onSubmit={editingService ? onUpdateService : onCreateService}
            onCancel={() => onFormOpenChange(false)}
          />
        </DialogContent>
      </Dialog>

      {selectedService && (
        <ServiceDetailsModal
          service={selectedService}
          isOpen={isDetailsOpen}
          onClose={onDetailsClose}
        />
      )}
    </>
  );
};
