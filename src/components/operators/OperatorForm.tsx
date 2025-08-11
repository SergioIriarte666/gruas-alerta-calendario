
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save } from 'lucide-react';
import { useGenericFormPersistence } from '@/hooks/useGenericFormPersistence';
import { useToast } from '@/components/ui/custom-toast';
import { Operator } from '@/types';

interface OperatorFormProps {
  operator?: Operator;
  onSubmit: (data: Omit<Operator, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export const OperatorForm = ({ operator, onSubmit, onCancel }: OperatorFormProps) => {
  const { toast } = useToast();
  const [showPersistedDataAlert, setShowPersistedDataAlert] = React.useState(false);
  
  const [formData, setFormData] = React.useState({
    name: operator?.name || '',
    rut: operator?.rut || '',
    phone: operator?.phone || '',
    licenseNumber: operator?.licenseNumber || '',
    examExpiry: operator?.examExpiry || '',
    isActive: operator?.isActive ?? true
  });

  // Form persistence
  const persistenceKey = operator ? `edit-operator-${operator.id}` : 'new-operator';
  const { clearFormData, hasPersistedData } = useGenericFormPersistence(
    formData,
    setFormData,
    { 
      key: persistenceKey,
      debounceMs: 2000
    }
  );

  // Check for persisted data on mount
  React.useEffect(() => {
    if (!operator && hasPersistedData()) {
      setShowPersistedDataAlert(true);
    }
  }, [operator, hasPersistedData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      onSubmit(formData);
      clearFormData();
      toast({
        type: 'success',
        title: 'Operador guardado',
        description: 'El operador se ha guardado correctamente'
      });
    } catch (error) {
      console.error('Error submitting operator form:', error);
      toast({
        type: 'error',
        title: 'Error al guardar',
        description: 'No se pudo guardar el operador. Los datos se mantienen guardados localmente.'
      });
    }
  };

  const handleChange = (field: keyof typeof formData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDiscardPersistedData = () => {
    clearFormData();
    setShowPersistedDataAlert(false);
    toast({
      type: 'info',
      title: 'Datos descartados',
      description: 'Se han eliminado los datos guardados anteriormente'
    });
  };

  return (
    <div className="space-y-6">
      {/* Persisted data alert */}
      {showPersistedDataAlert && (
        <Alert className="border-blue-500/50 bg-blue-500/10">
          <Save className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200 flex items-center justify-between">
            <span>Se encontraron datos guardados anteriormente. ¿Deseas continuar desde donde lo dejaste?</span>
            <div className="ml-4 space-x-2">
              <button 
                onClick={() => setShowPersistedDataAlert(false)}
                className="text-blue-300 hover:text-blue-100 underline text-sm"
              >
                Continuar
              </button>
              <button 
                onClick={handleDiscardPersistedData}
                className="text-blue-300 hover:text-blue-100 underline text-sm"
              >
                Descartar
              </button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white">Nombre Completo</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
              placeholder="Ingrese nombre completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rut" className="text-white">RUT</Label>
            <Input
              id="rut"
              type="text"
              value={formData.rut}
              onChange={(e) => handleChange('rut', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
              placeholder="12.345.678-9"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-white">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
              placeholder="+56 9 1234 5678"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="licenseNumber" className="text-white">Número de Licencia</Label>
            <Input
              id="licenseNumber"
              type="text"
              value={formData.licenseNumber}
              onChange={(e) => handleChange('licenseNumber', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
              placeholder="A-123456"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="examExpiry" className="text-white">Vencimiento Examen</Label>
            <Input
              id="examExpiry"
              type="date"
              value={formData.examExpiry}
              onChange={(e) => handleChange('examExpiry', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="isActive" className="text-white">Estado</Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange('isActive', checked)}
              />
              <span className="text-sm text-gray-300">
                {formData.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-gray-600 text-gray-300 hover:bg-white/5"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-tms-green hover:bg-tms-green/90 text-white"
          >
            {operator ? 'Actualizar' : 'Crear'} Operador
          </Button>
        </div>
      </form>

      {/* Auto-save indicator */}
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-gray-800/90 text-white text-xs px-3 py-1 rounded-full flex items-center space-x-2">
          <Save className="w-3 h-3" />
          <span>Guardado automático activo</span>
        </div>
      </div>
    </div>
  );
};
