
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ServiceClosure } from '@/types';
import { useClients } from '@/hooks/useClients';

const editClosureSchema = z.object({
  dateFrom: z.string().min(1, 'Fecha de inicio es requerida'),
  dateTo: z.string().min(1, 'Fecha de fin es requerida'),
  clientId: z.string().optional(),
  status: z.enum(['open', 'closed', 'invoiced'] as const)
});

type EditClosureFormData = z.infer<typeof editClosureSchema>;

interface EditClosureFormProps {
  closure: ServiceClosure;
  onSubmit: (data: EditClosureFormData) => void;
  onCancel: () => void;
}

export const EditClosureForm: React.FC<EditClosureFormProps> = ({
  closure,
  onSubmit,
  onCancel
}) => {
  const { clients } = useClients();
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<EditClosureFormData>({
    resolver: zodResolver(editClosureSchema),
    defaultValues: {
      dateFrom: closure.dateRange.from,
      dateTo: closure.dateRange.to,
      clientId: closure.clientId || '',
      status: closure.status
    }
  });

  const handleFormSubmit = (data: EditClosureFormData) => {
    onSubmit(data);
  };

  const activeClients = clients.filter(c => c.isActive);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-white">
          Editar Cierre {closure.folio}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateFrom" className="text-gray-300">Fecha de Inicio</Label>
              <Input
                id="dateFrom"
                type="date"
                {...register('dateFrom')}
                className="mt-1 bg-white/5 border-gray-700 text-white"
              />
              {errors.dateFrom && (
                <p className="text-sm text-red-400 mt-1">{errors.dateFrom.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="dateTo" className="text-gray-300">Fecha de Fin</Label>
              <Input
                id="dateTo"
                type="date"
                {...register('dateTo')}
                className="mt-1 bg-white/5 border-gray-700 text-white"
              />
              {errors.dateTo && (
                <p className="text-sm text-red-400 mt-1">{errors.dateTo.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="clientId" className="text-gray-300">Cliente</Label>
              <Select onValueChange={(value) => setValue('clientId', value)}>
                <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                  <SelectValue placeholder="Seleccionar cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos los clientes</SelectItem>
                  {activeClients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status" className="text-gray-300">Estado</Label>
              <Select onValueChange={(value) => setValue('status', value as any)}>
                <SelectTrigger className="bg-white/5 border-gray-700 text-white">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="closed">Cerrado</SelectItem>
                  <SelectItem value="invoiced">Facturado</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-400 mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel} className="border-gray-700 text-gray-300 hover:text-white">
              Cancelar
            </Button>
            <Button type="submit" className="bg-tms-green hover:bg-tms-green/90">
              Actualizar Cierre
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
