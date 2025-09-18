import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const quickClientSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  rut: z.string().min(1, 'El RUT es requerido'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
});

type QuickClientFormData = z.infer<typeof quickClientSchema>;

interface QuickClientCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: (client: { id: string; name: string; rut: string }) => void;
}

export function QuickClientCreateModal({ 
  open, 
  onOpenChange, 
  onClientCreated 
}: QuickClientCreateModalProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<QuickClientFormData>({
    resolver: zodResolver(quickClientSchema),
    defaultValues: {
      name: '',
      rut: '',
      contact_name: '',
      phone: '',
      email: '',
    },
  });

  const onSubmit = async (data: QuickClientFormData) => {
    setLoading(true);
    try {
      const { data: newClient, error } = await supabase
        .from('clients')
        .insert({
          name: data.name,
          rut: data.rut,
          contact_name: data.contact_name || null,
          phone: data.phone || null,
          email: data.email || null,
          department: 'General', // Default department
        })
        .select('id, name, rut')
        .single();

      if (error) throw error;

      toast.success('Cliente creado exitosamente');
      onClientCreated(newClient);
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast.error('Error al crear cliente: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Cliente</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre de la Empresa *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ingrese el nombre de la empresa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="rut"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>RUT *</FormLabel>
                  <FormControl>
                    <Input placeholder="12.345.678-9" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Persona de Contacto</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del contacto" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="+56 9 8765 4321" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="contacto@empresa.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Cliente
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}