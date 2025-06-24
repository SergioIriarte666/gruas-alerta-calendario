
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Mail, UserCog, Building } from 'lucide-react';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  rut: string;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onUserCreated: () => void;
}

export const CreateUserDialog = ({ open, onOpenChange, clients, onUserCreated }: CreateUserDialogProps) => {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: '',
    client_id: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.full_name || !formData.role) {
      toast.error('Por favor, completa todos los campos requeridos');
      return;
    }

    // Validar email
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Por favor, ingresa un email válido');
      return;
    }

    // Validar que si el rol es cliente, se haya seleccionado un cliente
    if (formData.role === 'client' && !formData.client_id) {
      toast.error('Para usuarios tipo cliente, debes seleccionar un cliente asociado');
      return;
    }

    setIsLoading(true);

    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data, error } = await supabase.rpc('admin_create_user', {
        p_email: formData.email,
        p_full_name: formData.full_name,
        p_role: formData.role,
        p_client_id: formData.role === 'client' ? formData.client_id : null
      });

      if (error) {
        console.error('Error creating user:', error);
        toast.error(error.message || 'Error al crear el usuario');
        return;
      }

      toast.success('Usuario creado exitosamente', {
        description: `Se ha creado el usuario ${formData.full_name} con el email ${formData.email}`
      });

      // Limpiar formulario
      setFormData({
        email: '',
        full_name: '',
        role: '',
        client_id: ''
      });

      // Cerrar dialog y refrescar lista
      onOpenChange(false);
      onUserCreated();

    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast.error('Error inesperado al crear el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      email: '',
      full_name: '',
      role: '',
      client_id: ''
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-black flex items-center gap-2">
            <User className="w-5 h-5" />
            Crear Nuevo Usuario
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-black flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="usuario@ejemplo.com"
              className="border-gray-300"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name" className="text-black flex items-center gap-2">
              <User className="w-4 h-4" />
              Nombre Completo *
            </Label>
            <Input
              id="full_name"
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Juan Pérez"
              className="border-gray-300"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="text-black flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Rol *
            </Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData(prev => ({ 
                ...prev, 
                role: value,
                client_id: value !== 'client' ? '' : prev.client_id
              }))}
              required
            >
              <SelectTrigger className="border-gray-300">
                <SelectValue placeholder="Seleccionar rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="operator">Operador</SelectItem>
                <SelectItem value="viewer">Visualizador</SelectItem>
                <SelectItem value="client">Cliente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.role === 'client' && (
            <div className="space-y-2">
              <Label htmlFor="client_id" className="text-black flex items-center gap-2">
                <Building className="w-4 h-4" />
                Cliente Asociado *
              </Label>
              <Select 
                value={formData.client_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
                required
              >
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} ({client.rut})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-tms-green hover:bg-tms-green/90 text-black"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Usuario'
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-blue-800 text-sm">
            <strong>Nota:</strong> El usuario deberá registrarse normalmente en la aplicación usando el email especificado. 
            Una vez registrado, ya tendrá asignado el rol seleccionado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
