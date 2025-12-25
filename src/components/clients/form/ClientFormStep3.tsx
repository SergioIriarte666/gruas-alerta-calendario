import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { FolderTree, Plus, X, Power } from 'lucide-react';

interface ClientFormStep3Props {
  department: string;
  departments: string[];
  isActive: boolean;
  isEditing: boolean;
  isAddingDepartment: boolean;
  newDepartmentName: string;
  onDepartmentChange: (value: string) => void;
  onDepartmentsChange: (departments: string[]) => void;
  onIsActiveChange: (value: boolean) => void;
  onIsAddingDepartmentChange: (value: boolean) => void;
  onNewDepartmentNameChange: (value: string) => void;
}

export const ClientFormStep3 = ({
  department,
  departments,
  isActive,
  isEditing,
  isAddingDepartment,
  newDepartmentName,
  onDepartmentChange,
  onDepartmentsChange,
  onIsActiveChange,
  onIsAddingDepartmentChange,
  onNewDepartmentNameChange,
}: ClientFormStep3Props) => {
  const addDepartment = () => {
    if (departments.length < 5) {
      onDepartmentsChange([...departments, '']);
    }
  };

  const removeDepartment = (index: number) => {
    if (departments.length > 1) {
      onDepartmentsChange(departments.filter((_, i) => i !== index));
    }
  };

  const updateDepartment = (index: number, value: string) => {
    const newDepartments = [...departments];
    newDepartments[index] = value;
    onDepartmentsChange(newDepartments);
  };

  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Departamentos"
        icon={<FolderTree className="h-5 w-5" />}
        color="orange"
        required
      >
        {isEditing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">Departamento Actual</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onIsAddingDepartmentChange(!isAddingDepartment)}
                className="border-violet-500/50 text-violet-600 hover:bg-violet-500/10"
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar Departamento
              </Button>
            </div>
            
            <Input
              value={department}
              disabled
              className="bg-muted"
            />
            
            {isAddingDepartment && (
              <div className="p-4 border border-violet-500/30 rounded-lg bg-violet-500/5">
                <Label className="text-foreground mb-2 block">Nuevo Departamento *</Label>
                <Input
                  value={newDepartmentName}
                  onChange={(e) => onNewDepartmentNameChange(e.target.value)}
                  placeholder="Ej: Operaciones, Marketing"
                  className="bg-background"
                  required={isAddingDepartment}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Se creará un nuevo registro con el mismo RUT y datos del cliente
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-foreground">
                Departamentos ({departments.length}/5)
              </Label>
              {departments.length < 5 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDepartment}
                  className="border-violet-500/50 text-violet-600 hover:bg-violet-500/10"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              )}
            </div>
            
            <div className="space-y-3">
              {departments.map((dept, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={dept}
                    onChange={(e) => updateDepartment(index, e.target.value)}
                    placeholder={`Departamento ${index + 1} (Ej: Ventas, Administración)`}
                    className="bg-background"
                    required
                  />
                  {departments.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeDepartment(index)}
                      className="border-destructive/50 text-destructive hover:bg-destructive/10 px-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            
            <p className="text-xs text-muted-foreground">
              Puedes agregar hasta 5 departamentos. Cada departamento creará un registro separado con el mismo RUT.
            </p>
          </div>
        )}
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Estado del Cliente"
        icon={<Power className="h-5 w-5" />}
        color="green"
      >
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="isActive" className="text-foreground font-medium">
              Cliente Activo
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Los clientes inactivos no aparecerán en las listas de selección
            </p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={onIsActiveChange}
          />
        </div>
      </ColoredSectionCard>
    </div>
  );
};
