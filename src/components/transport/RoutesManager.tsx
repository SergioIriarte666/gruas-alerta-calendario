import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRoutes, useCreateRoute, useUpdateRoute, useDeleteRoute } from '@/hooks/transport/useRoutes';
import { Route } from '@/types/transport';
import { Plus, Pencil, Trash2, Route as RouteIcon } from 'lucide-react';
import { toast } from 'sonner';

export const RoutesManager: React.FC = () => {
  const { data: routes = [], isLoading } = useRoutes();
  const createRoute = useCreateRoute();
  const updateRoute = useUpdateRoute();
  const deleteRoute = useDeleteRoute();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [form, setForm] = useState({
    name: '', origin: '', destination: '', distance_km: '',
    estimated_time_hours: '', consumption_factor: '1.0',
    route_type: 'highway', difficulty_level: 'normal', notes: '',
  });

  const resetForm = () => {
    setForm({ name: '', origin: '', destination: '', distance_km: '', estimated_time_hours: '', consumption_factor: '1.0', route_type: 'highway', difficulty_level: 'normal', notes: '' });
    setEditingRoute(null);
  };

  const openCreate = () => { resetForm(); setIsDialogOpen(true); };
  const openEdit = (r: Route) => {
    setEditingRoute(r);
    setForm({
      name: r.name, origin: r.origin, destination: r.destination,
      distance_km: String(r.distance_km), estimated_time_hours: String(r.estimated_time_hours),
      consumption_factor: String(r.consumption_factor), route_type: r.route_type,
      difficulty_level: r.difficulty_level, notes: r.notes || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.origin || !form.destination || !form.distance_km) {
      toast.error('Completa los campos obligatorios');
      return;
    }
    const payload = {
      name: form.name, origin: form.origin, destination: form.destination,
      distance_km: Number(form.distance_km), estimated_time_hours: Number(form.estimated_time_hours) || 0,
      consumption_factor: Number(form.consumption_factor), route_type: form.route_type,
      difficulty_level: form.difficulty_level, notes: form.notes || null,
      is_active: true,
    };
    try {
      if (editingRoute) {
        await updateRoute.mutateAsync({ id: editingRoute.id, ...payload });
        toast.success('Ruta actualizada');
      } else {
        await createRoute.mutateAsync(payload);
        toast.success('Ruta creada');
      }
      setIsDialogOpen(false);
      resetForm();
    } catch { toast.error('Error al guardar la ruta'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRoute.mutateAsync(id);
      toast.success('Ruta eliminada');
    } catch { toast.error('Error al eliminar'); }
  };

  const handleToggleActive = async (r: Route) => {
    await updateRoute.mutateAsync({ id: r.id, is_active: !r.is_active });
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <RouteIcon className="w-5 h-5 text-violet-600" />
          Rutas
        </CardTitle>
        <Button onClick={openCreate} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nueva Ruta
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : routes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay rutas registradas</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 px-3">Nombre</th>
                  <th className="py-2 px-3">Origen</th>
                  <th className="py-2 px-3">Destino</th>
                  <th className="py-2 px-3">Distancia</th>
                  <th className="py-2 px-3">Tiempo Est.</th>
                  <th className="py-2 px-3">Factor</th>
                  <th className="py-2 px-3">Estado</th>
                  <th className="py-2 px-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {routes.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{r.name}</td>
                    <td className="py-2 px-3">{r.origin}</td>
                    <td className="py-2 px-3">{r.destination}</td>
                    <td className="py-2 px-3">{r.distance_km} km</td>
                    <td className="py-2 px-3">{r.estimated_time_hours} hrs</td>
                    <td className="py-2 px-3">×{r.consumption_factor}</td>
                    <td className="py-2 px-3">
                      <Badge variant={r.is_active ? 'default' : 'secondary'} className={r.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : ''}>
                        {r.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleActive(r)}>
                          <Switch checked={r.is_active} className="scale-75" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRoute ? 'Editar Ruta' : 'Nueva Ruta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Copiapó - Santiago" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Origen *</Label><Input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))} /></div>
              <div><Label>Destino *</Label><Input value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Distancia (km) *</Label><Input type="number" value={form.distance_km} onChange={e => setForm(f => ({ ...f, distance_km: e.target.value }))} /></div>
              <div><Label>Tiempo estimado (hrs)</Label><Input type="number" value={form.estimated_time_hours} onChange={e => setForm(f => ({ ...f, estimated_time_hours: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Factor consumo</Label><Input type="number" step="0.1" value={form.consumption_factor} onChange={e => setForm(f => ({ ...f, consumption_factor: e.target.value }))} /></div>
              <div>
                <Label>Tipo ruta</Label>
                <Select value={form.route_type} onValueChange={v => setForm(f => ({ ...f, route_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="highway">Carretera</SelectItem>
                    <SelectItem value="urban">Urbana</SelectItem>
                    <SelectItem value="mixed">Mixta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dificultad</Label>
                <Select value={form.difficulty_level} onValueChange={v => setForm(f => ({ ...f, difficulty_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Fácil</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="difficult">Difícil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Notas</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700 text-white" disabled={createRoute.isPending || updateRoute.isPending}>
              {editingRoute ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
