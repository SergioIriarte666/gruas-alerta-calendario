
import { Button } from '@/components/ui/button';

interface FormActionsProps {
  loading: boolean;
  isFormValid: boolean;
  hasSelectedServices: boolean;
  selectedServicesCount: number;
  onCancel: () => void;
}

const FormActions = ({ loading, isFormValid, hasSelectedServices, selectedServicesCount, onCancel }: FormActionsProps) => {
  return (
    <div className="flex justify-end gap-x-2 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        title="Cancelar la creación del cierre"
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        disabled={loading || !isFormValid}
        className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        title={!hasSelectedServices 
          ? "Selecciona al menos un servicio para crear el cierre" 
          : `Crear cierre con ${selectedServicesCount} servicio${selectedServicesCount !== 1 ? 's' : ''}`
        }
      >
        {loading ? 'Creando...' : 
         hasSelectedServices 
           ? `Crear Cierre (${selectedServicesCount} servicio${selectedServicesCount !== 1 ? 's' : ''})` 
           : 'Crear Cierre'
        }
      </Button>
    </div>
  );
};

export default FormActions;
