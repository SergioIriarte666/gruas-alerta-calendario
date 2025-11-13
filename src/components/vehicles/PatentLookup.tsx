import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Car } from 'lucide-react';
import { usePatentLookup } from '@/hooks/usePatentLookup';

export const PatentLookup: React.FC = () => {
  const [licensePlate, setLicensePlate] = useState('');
  const { data, loading, error, lookupPatent, reset } = usePatentLookup();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (licensePlate.trim()) {
      lookupPatent(licensePlate);
    }
  };

  const handleReset = () => {
    setLicensePlate('');
    reset();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5" />
            Consulta de Patentes
          </CardTitle>
          <CardDescription>
            Verifica la información de marca y modelo de un vehículo mediante su patente chilena
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ingresa patente (ej: LGKF-63 o LGKF63)"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                disabled={loading}
                className="flex-1"
                maxLength={8}
              />
              <Button type="submit" disabled={loading || !licensePlate.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Consultar
                  </>
                )}
              </Button>
              {(data || error) && (
                <Button type="button" variant="outline" onClick={handleReset}>
                  Limpiar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {data && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Información del Vehículo</CardTitle>
            <CardDescription>Datos obtenidos del registro chileno</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Marca</div>
                <div className="text-lg font-semibold">{data.marca}</div>
              </div>
              
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Modelo</div>
                <div className="text-lg font-semibold">{data.modelo}</div>
              </div>
              
              {data.año && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Año</div>
                  <div className="text-lg font-semibold">{data.año}</div>
                </div>
              )}
              
              {data.color && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Color</div>
                  <div className="text-lg font-semibold">{data.color}</div>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Badge variant="secondary" className="text-xs">
                Plan gratuito: 5 consultas/día
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {!data && !error && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Car className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Ingresa una patente chilena para consultar la información del vehículo
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
