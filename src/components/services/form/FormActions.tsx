
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
        className="border-gray-400/50 bg-gray-400/10 text-gray-300 hover:bg-gray-400/20 hover:border-gray-400"
        style={{
          borderColor: 'rgba(156, 163, 175, 0.5)',
          backgroundColor: 'rgba(156, 163, 175, 0.1)',
          color: '#d1d5db'
        }}
      >
        Cancelar
      </Button>
      <Button 
        type="submit" 
        variant="tms"
        title={isEditing ? 'Actualizar los datos del servicio' : 'Crear el nuevo servicio'}
        disabled={disabled}
        className="bg-tms-green hover:bg-tms-green/80 text-black font-medium"
        style={{
          backgroundColor: '#9cfa24',
          color: '#000000'
        }}
      >
        {isEditing ? 'Actualizar Servicio' : 'Crear Servicio'}
      </Button>
    </div>
  );
};
