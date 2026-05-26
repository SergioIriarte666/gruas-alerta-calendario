
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, User, Mail, UserCog, Building, HardHat } from 'lucide-react';
import { toast } from 'sonner';
import { toTitleCase } from '@/lib/utils';

interface Client {
  id: string;
  name: string;
  rut: string;
  isActive?: boolean;
}

interface Operator {
  id: string;
  name: string;
  rut: string;
}

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  operators?: Operator[];
  onUserCreated: () => void;
  creating: boolean;
  createUser: (userData: any) => Promise<{ success: boolean; error?: string }>;
}

type AppRole = 'admin' | 'operator' | 'viewer' | 'client';

export const CreateUserDialog = ({ 
  open, 
  onOpenChange, 
  clients, 
  operators = [],
  onUserCreated, 
  creating, 
  createUser 
}: CreateUserDialogProps) => {
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: '' as AppRole | '',
    client_id: '',
    operator_id: ''
  });

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

    // Validar que si el rol es operador, se haya seleccionado un operador
    if (formData.role === 'operator' && !formData.operator_id) {
      toast.error('Para usuarios tipo operador, debes seleccionar un operador asociado');
      return;
    }

    const result = await createUser({
      email: formData.email,
      full_name: formData.full_name,
      role: formData.role,
      client_id: formData.role === 'client' ? formData.client_id : null,
      operator_id: formData.role === 'operator' ? formData.operator_id : null
    });

    if (result.success) {
      toast.success('Usuario creado exitosamente', {
        description: `Se ha creado el usuario ${formData.full_name} con el email ${formData.email}`
      });

      // Limpiar formulario
      setFormData({
        email: '',
        full_name: '',
        role: '',
        client_id: '',
        operator_id: ''
      });

      // Cerrar dialog y refrescar lista
      onOpenChange(false);
      onUserCreated();
    } else {
      toast.error(result.error || 'Error al crear el usuario');
    }
  };

  const handleCancel = () => {
    setFormData({
      email: '',
      full_name: '',
      role: '',
      client_id: '',
      operator_id: ''
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-border/70 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <User className="size-5 text-primary" />
            Crear Nuevo Usuario
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="size-4" />
              Email *
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="usuario@ejemplo.com"
              className="border-border/70 bg-background/60"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name" className="flex items-center gap-2">
              <User className="size-4" />
              Nombre Completo *
            </Label>
            <Input
              id="full_name"
              type="text"
              value={formData.full_name}
              onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
              placeholder="Juan Pérez"
              className="border-border/70 bg-background/60"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <UserCog className="size-4" />
              Rol *
            </Label>
            <Select 
              value={formData.role} 
              onValueChange={(value: AppRole) => setFormData(prev => ({ 
                ...prev, 
                role: value,
                client_id: value !== 'client' ? '' : prev.client_id,
                operator_id: value !== 'operator' ? '' : prev.operator_id
              }))}
            >
              <SelectTrigger className="border-border/70 bg-background/60">
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
              <Label htmlFor="client_id" className="flex items-center gap-2">
                <Building className="size-4" />
                Cliente Asociado *
              </Label>
              <Select 
                value={formData.client_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
              >
                <SelectTrigger className="border-border/70 bg-background/60">
                  <SelectValue placeholder="Seleccionar cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.filter(c => c.isActive !== false).map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {toTitleCase(client.name)} - {client.rut}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formData.role === 'operator' && (
            <div className="space-y-2">
              <Label htmlFor="operator_id" className="flex items-center gap-2">
                <HardHat className="size-4" />
                Operador Asociado *
              </Label>
              <Select 
                value={formData.operator_id} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, operator_id: value }))}
              >
                <SelectTrigger className="border-border/70 bg-background/60">
                  <SelectValue placeholder="Seleccionar operador" />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>
                      {operator.name} ({operator.rut})
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
              disabled={creating}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={creating}
              className="flex-1"
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Usuario'
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4 rounded-xl border border-info/20 bg-info/10 p-3">
          <p className="text-sm text-foreground">
            <strong>Nota:</strong> El usuario deberá registrarse normalmente en la aplicación usando el email especificado. 
            Una vez registrado, ya tendrá asignado el rol seleccionado.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
