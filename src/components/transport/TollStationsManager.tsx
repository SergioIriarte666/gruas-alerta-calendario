import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTollStations, useCreateTollStation, useUpdateTollStation, useDeleteTollStation, useTollRates, useCreateTollRate, useDeleteTollRate } from '@/hooks/transport/useTollStations';
import { TollStation, TollRate } from '@/types/transport';
import { Plus, Pencil, Trash2, Milestone, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export const TollStationsManager: React.FC = () => {
  const { data: stations = [], isLoading } = useTollStations();
  const createStation = useCreateTollStation();
  const updateStation = useUpdateTollStation();
  const deleteStation = useDeleteTollStation();
  const createRate = useCreateTollRate();
  const deleteRate = useDeleteTollRate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TollStation | null>(null);
  const [expandedStation, setExpandedStation] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', location: '', highway: '', km_marker: '', operator_company: '' });
  const [rateForm, setRateForm] = useState({ vehicle_category: '', rate_amount: '' });

  const { data: rates = [] } = useTollRates(expandedStation || undefined);

  const resetForm = () => { setForm({ name: '', location: '', highway: '', km_marker: '', operator_company: '' }); setEditing(null); };

  const openCreate = () => { resetForm(); setIsDialogOpen(true); };
  const openEdit = (s: TollStation) => {
    setEditing(s);
    setForm({ name: s.name, location: s.location, highway: s.highway || '', km_marker: s.km_marker ? String(s.km_marker) : '', operator_company: s.operator_company || '' });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.location) { toast.error('Nombre y ubicación son requeridos'); return; }
    const payload = {
      name: form.name, location: form.location, highway: form.highway || null,
      km_marker: form.km_marker ? Number(form.km_marker) : null,
      operator_company: form.operator_company || null, is_active: true, payment_methods: [],
    };
    try {
      if (editing) {
        await updateStation.mutateAsync({ id: editing.id, ...payload });
        toast.success('Peaje actualizado');
      } else {
        await createStation.mutateAsync(payload);
        toast.success('Peaje creado');
      }
      setIsDialogOpen(false); resetForm();
    } catch { toast.error('Error al guardar'); }
  };

  const handleAddRate = async () => {
    if (!expandedStation || !rateForm.vehicle_category || !rateForm.rate_amount) return;
    try {
      await createRate.mutateAsync({
        toll_station_id: expandedStation, vehicle_category: rateForm.vehicle_category,
        rate_amount: Number(rateForm.rate_amount), currency: 'CLP',
        valid_from: new Date().toISOString().split('T')[0], valid_until: null, is_active: true,
      });
      setRateForm({ vehicle_category: '', rate_amount: '' });
      toast.success('Tarifa agregada');
    } catch { toast.error('Error al agregar tarifa'); }
  };

  return (
    <Card className="mt-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Milestone className="w-5 h-5 text-violet-600" />
          Estaciones de Peaje
        </CardTitle>
        <Button onClick={openCreate} size="sm" className="bg-violet-600 hover:bg-violet-700 text-white">
          <Plus className="w-4 h-4 mr-1" /> Nuevo Peaje
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Cargando...</p> :
        stations.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No hay peajes registrados</p> : (
          <div className="space-y-2">
            {stations.map(s => (
              <div key={s.id} className="border rounded-lg">
                <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30" onClick={() => setExpandedStation(expandedStation === s.id ? null : s.id)}>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.location}</span>
                    {s.highway && <Badge variant="outline" className="text-xs">{s.highway}</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(s); }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteStation.mutateAsync(s.id).then(() => toast.success('Eliminado')); }} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    {expandedStation === s.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
                {expandedStation === s.id && (
                  <div className="border-t p-3 bg-muted/10">
                    <p className="text-xs font-semibold mb-2">Tarifas por categoría</p>
                    {rates.filter(r => r.toll_station_id === s.id).map(r => (
                      <div key={r.id} className="flex justify-between items-center text-sm py-1">
                        <span>{r.vehicle_category}</span>
                        <div className="flex items-center gap-2">
                          <span>${Number(r.rate_amount).toLocaleString('es-CL')}</span>
                          <Button variant="ghost" size="sm" onClick={() => deleteRate.mutateAsync(r.id)} className="text-destructive h-6 w-6 p-0"><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <Input placeholder="Categoría (ej: grua_pesada)" value={rateForm.vehicle_category} onChange={e => setRateForm(f => ({ ...f, vehicle_category: e.target.value }))} className="text-xs" />
                      <Input placeholder="Monto" type="number" value={rateForm.rate_amount} onChange={e => setRateForm(f => ({ ...f, rate_amount: e.target.value }))} className="text-xs w-28" />
                      <Button size="sm" onClick={handleAddRate} className="bg-violet-600 text-white text-xs"><Plus className="w-3 h-3" /></Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Editar Peaje' : 'Nuevo Peaje'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nombre *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Peaje Angostura" /></div>
            <div><Label>Ubicación *</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Carretera</Label><Input value={form.highway} onChange={e => setForm(f => ({ ...f, highway: e.target.value }))} placeholder="Ruta 5" /></div>
              <div><Label>Km marcador</Label><Input type="number" value={form.km_marker} onChange={e => setForm(f => ({ ...f, km_marker: e.target.value }))} /></div>
            </div>
            <div><Label>Empresa operadora</Label><Input value={form.operator_company} onChange={e => setForm(f => ({ ...f, operator_company: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-violet-600 hover:bg-violet-700 text-white">{editing ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
