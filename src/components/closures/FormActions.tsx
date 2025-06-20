
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
    <div className="flex justify-end space-x-2 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        className="border-gray-700 text-gray-300 hover:text-white"
        title="Cancelar la creación del cierre"
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        disabled={loading || !isFormValid}
        className="bg-tms-green hover:bg-tms-green/90 disabled:opacity-50"
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
