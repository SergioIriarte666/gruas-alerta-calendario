
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Client } from '@/types';

interface ClientFormProps {
  client?: Client;
  onSubmit: (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export const ClientForm = ({ client, onSubmit, onCancel }: ClientFormProps) => {
  const [formData, setFormData] = useState({
    name: client?.name || '',
    rut: client?.rut || '',
    phone: client?.phone || '',
    email: client?.email || '',
    address: client?.address || '',
    isActive: client?.isActive ?? true
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <DialogContent className="sm:max-w-[600px] bg-tms-dark border-gray-700">
      <DialogHeader>
        <DialogTitle className="text-white">
          {client ? 'Editar Cliente' : 'Nuevo Cliente'}
        </DialogTitle>
        <DialogDescription className="text-gray-400">
          {client ? 'Modifica los datos del cliente' : 'Ingresa los datos del nuevo cliente'}
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">Nombre/Razón Social *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="rut" className="text-gray-300">RUT *</Label>
            <Input
              id="rut"
              value={formData.rut}
              onChange={(e) => handleChange('rut', e.target.value)}
              placeholder="12.345.678-9"
              className="bg-white/5 border-gray-700 text-white"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-300">Teléfono</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+56 9 1234 5678"
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-300">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="bg-white/5 border-gray-700 text-white"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-gray-300">Dirección</Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className="bg-white/5 border-gray-700 text-white"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleChange('isActive', checked)}
          />
          <Label htmlFor="isActive" className="text-gray-300">
            Cliente Activo
          </Label>
        </div>

        <DialogFooter>
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
            className="bg-tms-green hover:bg-tms-green-dark text-white"
          >
            {client ? 'Actualizar' : 'Crear'} Cliente
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
