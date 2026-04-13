import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Building2, Search, Loader2, CheckCircle2, X } from 'lucide-react';
import { toTitleCase } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SreResult {
  razon_social: string;
  rut: string;
  dte_email: string;
  fecha_resolucion: string;
  numero_resolucion: number | null;
  actecos: string[];
  glosa_giro: string;
  es_mipyme: boolean | null;
  url: string;
  actualizado: string;
  direccion: string;
  comuna: string;
  ciudad: string;
  region: string;
  telefono: string;
  email: string;
  actividades_economicas: { codigo?: string; descripcion?: string; activity_code?: string; activity_description?: string }[];
}

interface ClientFormStep1Props {
  name: string;
  rut: string;
  onChange: (field: string, value: string) => void;
  onSreData?: (data: { name: string; address: string; phone: string; email: string }) => void;
}

export const ClientFormStep1 = ({ name, rut, onChange, onSreData }: ClientFormStep1Props) => {
  const [isSearching, setIsSearching] = useState(false);
  const [sreResult, setSreResult] = useState<SreResult | null>(null);

  const handleSearch = async () => {
    if (!rut.trim()) {
      toast.error('Ingrese un RUT para buscar');
      return;
    }

    setIsSearching(true);
    setSreResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('sre-lookup', {
        body: { rut: rut.trim() },
      });

      if (error) {
        toast.error('Error al consultar SRE: ' + error.message);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const result = data as SreResult;
      setSreResult(result);

      // Auto-apply data to form
      if (result.razon_social) {
        onChange('name', toTitleCase(result.razon_social));
      }

      const address = [result.direccion, result.comuna, result.ciudad, result.region].filter(Boolean).join(', ');

      onSreData?.({
        name: result.razon_social ? toTitleCase(result.razon_social) : name,
        address,
        phone: result.telefono,
        email: result.email || result.dte_email,
      });

      toast.success('Datos encontrados y aplicados al formulario');
    } catch (err) {
      toast.error('Error de conexión con el servicio SRE');
    } finally {
      setIsSearching(false);
    }
  };

  const dismissResult = () => setSreResult(null);

  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Datos Básicos"
        icon={<Building2 className="h-5 w-5" />}
        color="purple"
        required
      >
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rut" className="text-foreground">RUT *</Label>
            <div className="flex gap-2">
              <Input
                id="rut"
                value={rut}
                onChange={(e) => onChange('rut', e.target.value)}
                placeholder="12.345.678-9"
                className="bg-background"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSearch}
                disabled={isSearching || !rut.trim()}
                className="shrink-0 border-violet-300 hover:bg-violet-50 hover:border-violet-400 dark:hover:bg-violet-950"
                title="Buscar en SRE"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                ) : (
                  <Search className="h-4 w-4 text-violet-600" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Formato: XX.XXX.XXX-X — Presiona buscar para auto-completar datos desde SRE
            </p>
          </div>

          {sreResult && (
            <div className="rounded-lg border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-500/5 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Datos encontrados en SRE
                  </span>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={dismissResult}>
                  <X className="h-3 w-3" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                {sreResult.razon_social && (
                  <div>
                    <span className="text-muted-foreground">Razón Social:</span>
                    <p className="font-medium">{sreResult.razon_social}</p>
                  </div>
                )}
                {sreResult.glosa_giro && (
                  <div>
                    <span className="text-muted-foreground">Giro:</span>
                    <p className="font-medium">{sreResult.glosa_giro}</p>
                  </div>
                )}
                {sreResult.direccion && (
                  <div>
                    <span className="text-muted-foreground">Dirección:</span>
                    <p className="font-medium">{sreResult.direccion}{sreResult.comuna ? `, ${sreResult.comuna}` : ''}</p>
                  </div>
                )}
                {sreResult.telefono && (
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>
                    <p className="font-medium">{sreResult.telefono}</p>
                  </div>
                )}
                {sreResult.email && (
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <p className="font-medium">{sreResult.email}</p>
                  </div>
                )}
                {sreResult.dte_email && (
                  <div>
                    <span className="text-muted-foreground">Email DTE:</span>
                    <p className="font-medium">{sreResult.dte_email}</p>
                  </div>
                )}
                {sreResult.fecha_resolucion && (
                  <div>
                    <span className="text-muted-foreground">Fecha Resolución:</span>
                    <p className="font-medium">{sreResult.fecha_resolucion}</p>
                  </div>
                )}
                {sreResult.actecos?.length > 0 && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Actividades Económicas (códigos):</span>
                    <p className="font-medium text-xs mt-0.5">{sreResult.actecos.join(', ')}</p>
                  </div>
                )}
                {sreResult.actividades_economicas?.length > 0 && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Actividades Económicas:</span>
                    <ul className="mt-1 space-y-0.5">
                      {sreResult.actividades_economicas.map((act, i) => (
                        <li key={i} className="font-medium text-xs">
                          • {act.activity_description || act.descripcion || act.codigo || (typeof act === 'string' ? act : JSON.stringify(act))}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {sreResult.es_mipyme !== null && (
                  <div>
                    <span className="text-muted-foreground">MiPyme:</span>
                    <p className="font-medium">{sreResult.es_mipyme ? 'Sí' : 'No'}</p>
                  </div>
                )}
                {sreResult.url && (
                  <div>
                    <span className="text-muted-foreground">Sitio Web:</span>
                    <p className="font-medium">{sreResult.url}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Datos aplicados automáticamente al formulario
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Nombre/Razón Social *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => onChange('name', e.target.value)}
              onBlur={() => onChange('name', toTitleCase(name))}
              placeholder="Ingrese el nombre o razón social"
              className="bg-background"
              required
            />
          </div>
        </div>
      </ColoredSectionCard>
    </div>
  );
};
