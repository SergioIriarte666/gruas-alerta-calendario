
import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2 } from 'lucide-react';

interface FormActionsProps {
  onCancel: () => void;
  isEditing: boolean;
  disabled: boolean;
  loading?: boolean;
}

export const FormActions: React.FC<FormActionsProps> = ({
  onCancel,
  isEditing,
  disabled,
  loading = false
}) => {
  return (
    <div className="flex justify-end space-x-4 pt-6 border-t">
      <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
        Cancelar
      </Button>
      <Button 
        type="submit" 
        disabled={disabled || loading}
        className="min-w-[120px]"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : disabled ? (
          <AlertCircle className="h-4 w-4 mr-2 text-yellow-500" />
        ) : null}
        {loading ? 'Procesando...' : `${isEditing ? 'Actualizar' : 'Crear'} Servicio`}
      </Button>
      {disabled && !loading && (
        <p className="text-sm text-yellow-600 mt-2">
          Completa todos los campos requeridos y asegúrate de que el folio sea único
        </p>
      )}
    </div>
  );
};
