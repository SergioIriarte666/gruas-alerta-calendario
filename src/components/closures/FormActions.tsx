
import { Button } from '@/components/ui/button';

interface FormActionsProps {
  loading: boolean;
  isFormValid: boolean;
  onCancel: () => void;
}

const FormActions = ({ loading, isFormValid, onCancel }: FormActionsProps) => {
  return (
    <div className="flex justify-end space-x-2 pt-4">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        className="border-gray-700 text-gray-300 hover:text-white"
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        disabled={loading || !isFormValid}
        className="bg-tms-green hover:bg-tms-green/90"
      >
        {loading ? 'Creando...' : 'Crear Cierre'}
      </Button>
    </div>
  );
};

export default FormActions;
