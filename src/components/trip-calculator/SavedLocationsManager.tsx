import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Plus, Trash2, Star } from 'lucide-react';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { toast } from 'sonner';

export const SavedLocationsManager = () => {
  const { locations, addLocation, deleteLocation } = useSavedLocations();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const handleAdd = async () => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!name.trim()) {
      toast.error('Ingrese un nombre para la ubicación');
      return;
    }
    if (isNaN(lat) || isNaN(lng)) {
      toast.error('Coordenadas inválidas');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Coordenadas fuera de rango');
      return;
    }
    try {
      await addLocation.mutateAsync({ name: name.trim(), latitude: lat, longitude: lng });
      toast.success('Ubicación guardada');
      setName('');
      setLatitude('');
      setLongitude('');
    } catch {
      toast.error('Error al guardar la ubicación');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLocation.mutateAsync(id);
      toast.success('Ubicación eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Star className="size-4" />
          <span className="hidden md:inline">Ubicaciones Guardadas</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-violet-600" />
            Ubicaciones Guardadas
          </DialogTitle>
        </DialogHeader>

        {/* Add new */}
        <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
          <p className="text-sm font-medium">Agregar nueva ubicación</p>
          <p className="text-xs text-muted-foreground">
            Busca el lugar en Google Maps, haz clic derecho y copia las coordenadas (latitud, longitud).
          </p>
          <div>
            <Label className="text-xs mb-1 block">Nombre</Label>
            <Input
              placeholder="Ej: Mina La Coipa - Mantos de Oro"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1 block">Latitud</Label>
              <Input
                type="number"
                step="any"
                placeholder="-26.81029"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Longitud</Label>
              <Input
                type="number"
                step="any"
                placeholder="-69.26946"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>
          <Button
            onClick={handleAdd}
            disabled={addLocation.isPending}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
            size="sm"
          >
            <Plus className="size-4" />
            Guardar Ubicación
          </Button>
        </div>

        {/* List */}
        <div className="space-y-2 mt-2">
          <p className="text-sm font-medium">
            Ubicaciones ({locations.length})
          </p>
          {locations.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay ubicaciones guardadas aún.
            </p>
          )}
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between p-3 rounded-md border bg-background"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{loc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {loc.latitude}, {loc.longitude}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => handleDelete(loc.id)}
                disabled={deleteLocation.isPending}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
