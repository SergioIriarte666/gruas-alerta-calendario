
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save } from 'lucide-react';
import { formatRut } from '@/utils/rutFormatter';
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
    operatorType: (operator?.operatorType || 'crane_operator') as 'crane_operator' | 'administrative',
    department: operator?.department || '',
    position: operator?.position || '',
    licenseNumber: operator?.licenseNumber || '',
    examExpiry: operator?.examExpiry || '',
    commissionExempt: operator?.commissionExempt ?? false,
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
          <Save className="size-4 text-blue-400" />
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
          {/* Tipo de Personal */}
          <div className="space-y-2 col-span-2">
            <Label htmlFor="operatorType">Tipo de Personal</Label>
            <Select
              value={formData.operatorType}
              onValueChange={(value) => handleChange('operatorType', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccione tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crane_operator">🏗️ Operador de Grúa</SelectItem>
                <SelectItem value="administrative">📋 Personal Administrativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre Completo</Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Ingrese nombre completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rut">RUT</Label>
            <Input
              id="rut"
              type="text"
              value={formData.rut}
              onChange={(e) => handleChange('rut', formatRut(e.target.value))}
              placeholder="12.345.678-9"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+56 9 1234 5678"
              required
            />
          </div>

          {/* Campos específicos de Personal Administrativo */}
          {formData.operatorType === 'administrative' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="department">Departamento</Label>
                <Input
                  id="department"
                  type="text"
                  value={formData.department}
                  onChange={(e) => handleChange('department', e.target.value)}
                  placeholder="Ej: Contabilidad, RRHH"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="position">Cargo</Label>
                <Input
                  id="position"
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  placeholder="Ej: Contador, Gerente"
                />
              </div>
            </>
          )}

          {/* Campos específicos de Operador de Grúa */}
          {formData.operatorType === 'crane_operator' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="licenseNumber">Número de Licencia</Label>
                <Input
                  id="licenseNumber"
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => handleChange('licenseNumber', e.target.value)}
                  placeholder="A-123456"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="examExpiry">Vencimiento Examen</Label>
                <DatePickerInput
                  id="examExpiry"
                  value={formData.examExpiry}
                  onChange={(value) => handleChange('examExpiry', value)}
                  placeholder="Seleccionar fecha"
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="isActive">Estado</Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleChange('isActive', checked)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.isActive ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="commissionExempt">Comisiones</Label>
            <div className="flex items-center space-x-2">
              <Switch
                id="commissionExempt"
                checked={formData.commissionExempt}
                onCheckedChange={(checked) => handleChange('commissionExempt', checked)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.commissionExempt ? 'Exento de comisiones' : 'Recibe comisiones'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            {operator ? 'Actualizar' : 'Crear'} {formData.operatorType === 'administrative' ? 'Personal' : 'Operador'}
          </Button>
        </div>
      </form>
    </div>
  );
};
