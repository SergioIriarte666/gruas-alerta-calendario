
import { Button } from '@/components/ui/button';

interface FormActionsProps {
  onCancel: () => void;
  isEditing: boolean;
  disabled?: boolean;
}

export const FormActions = ({ onCancel, isEditing, disabled = false }: FormActionsProps) => {
  return (
    <div className="flex justify-end space-x-4">
      <Button 
        type="button" 
        variant="outline" 
        onClick={onCancel}
        title="Cancelar la creación o edición del servicio"
      >
        Cancelar
      </Button>
      <Button 
        type="submit" 
        className="bg-tms-green hover:bg-tms-green-dark text-white"
        title={isEditing ? 'Actualizar los datos del servicio' : 'Crear el nuevo servicio'}
        disabled={disabled}
      >
        {isEditing ? 'Actualizar Servicio' : 'Crear Servicio'}
      </Button>
    </div>
  );
};
