
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, X } from 'lucide-react';
import { Client } from '@/types';

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> & { departments?: string[] }) => void;
  onCancel: () => void;
}

export const ClientForm = ({ client, onSubmit, onCancel }: ClientFormProps) => {
  const [formData, setFormData] = React.useState({
    name: client?.name || '',
    rut: client?.rut || '',
    phone: client?.phone || '',
    email: client?.email || '',
    address: client?.address || '',
    department: client?.department || '',
    contactName: client?.contactName || '',
    isActive: client?.isActive ?? true
  });

  // Solo para creación de nuevos clientes, no para edición
  const [departments, setDepartments] = React.useState<string[]>(
    client ? [] : ['']
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (client) {
      // Modo edición: enviar datos normales
      onSubmit(formData);
    } else {
      // Modo creación: enviar con múltiples departamentos
      const validDepartments = departments.filter(dep => dep.trim() !== '');
      if (validDepartments.length === 0) {
        alert('Debe ingresar al menos un departamento');
        return;
      }
      
      onSubmit({
        ...formData,
        departments: validDepartments
      });
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addDepartment = () => {
    if (departments.length < 5) {
      setDepartments([...departments, '']);
    }
  };

  const removeDepartment = (index: number) => {
    if (departments.length > 1) {
      setDepartments(departments.filter((_, i) => i !== index));
    }
  };

  const updateDepartment = (index: number, value: string) => {
    const newDepartments = [...departments];
    newDepartments[index] = value;
    setDepartments(newDepartments);
  };

  return (
    <div className="bg-white p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {client ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h2>
        <p className="text-gray-600 mt-1">
          {client ? 'Modifica los datos del cliente' : 'Ingresa los datos del nuevo cliente'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-700">Nombre/Razón Social *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="bg-white border-gray-300 text-gray-900 focus:border-tms-green focus:ring-tms-green placeholder:text-gray-400"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="rut" className="text-gray-700">RUT *</Label>
            <Input
              id="rut"
              value={formData.rut}
              onChange={(e) => handleChange('rut', e.target.value)}
              placeholder="12.345.678-9"
              className="bg-white border-gray-300 text-gray-900 focus:border-tms-green focus:ring-tms-green placeholder:text-gray-400"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-700">Teléfono</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+56 9 1234 5678"
              className="bg-white border-gray-300 text-gray-900 focus:border-tms-green focus:ring-tms-green placeholder:text-gray-400"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-700">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="bg-white border-gray-300 text-gray-900 focus:border-tms-green focus:ring-tms-green placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="address" className="text-gray-700">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              className="bg-white border-gray-300 text-gray-900 focus:border-tms-green focus:ring-tms-green placeholder:text-gray-400"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contactName" className="text-gray-700">Nombre del Contacto</Label>
            <Input
              id="contactName"
              value={formData.contactName}
              onChange={(e) => handleChange('contactName', e.target.value)}
              placeholder="Nombre de la persona de contacto"
              className="bg-white border-gray-300 text-gray-900 focus:border-tms-green focus:ring-tms-green placeholder:text-gray-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          
          {client ? (
            // Modo edición: un solo departamento
            <div className="space-y-2">
              <Label htmlFor="department" className="text-gray-700">Departamento *</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => handleChange('department', e.target.value)}
                placeholder="Ej: Ventas, Administración, Operaciones"
                className="bg-white border-gray-300 text-gray-900 focus:border-tms-green focus:ring-tms-green placeholder:text-gray-400"
                required
              />
            </div>
          ) : (
            // Modo creación: múltiples departamentos
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-gray-700">Departamentos * ({departments.length}/5)</Label>
                {departments.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addDepartment}
                    className="border-tms-green text-tms-green hover:bg-tms-green hover:text-black"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Agregar
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {departments.map((department, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Input
                      value={department}
                      onChange={(e) => updateDepartment(index, e.target.value)}
                      placeholder={`Departamento ${index + 1} (Ej: Ventas, Administración)`}
                      className="bg-white border-gray-300 text-gray-900 focus:border-tms-green focus:ring-tms-green placeholder:text-gray-400"
                      required
                    />
                    {departments.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeDepartment(index)}
                        className="border-red-300 text-red-600 hover:bg-red-500 hover:text-white px-2"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600">
                Puedes agregar hasta 5 departamentos. Cada departamento creará un registro separado con el mismo RUT.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleChange('isActive', checked)}
          />
          <Label htmlFor="isActive" className="text-gray-700">
            Cliente Activo
          </Label>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-gray-300 text-gray-700 hover:bg-gray-100"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-tms-green hover:bg-tms-green/80 text-black font-medium"
          >
            {client ? 'Actualizar' : 'Crear'} Cliente
          </Button>
        </div>
      </form>
    </div>
  );
};
