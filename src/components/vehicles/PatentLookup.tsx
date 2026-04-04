import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Car, History, Trash2, Clock } from 'lucide-react';
import { usePatentLookup } from '@/hooks/usePatentLookup';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const PatentLookup: React.FC = () => {
  const [licensePlate, setLicensePlate] = useState('');
  const { data, loading, error, history, lookupPatent, loadFromHistory, clearHistory, reset } = usePatentLookup();

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
      <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/80 via-background to-cyan-50/70 shadow-sm dark:border-emerald-900/30 dark:from-emerald-950/15 dark:via-background dark:to-cyan-950/15">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 p-2 text-white shadow-sm">
              <Car className="h-5 w-5" />
            </div>
            Consulta de Patentes
          </CardTitle>
          <CardDescription>
            Verifica la información de marca y modelo de un vehículo mediante su patente chilena
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                placeholder="Ingresa patente (ej: LGKF-63 o LGKF63)"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                disabled={loading}
                className="h-11 flex-1 rounded-xl border-border/70 bg-background/90 shadow-sm"
                maxLength={20}
              />
              <Button type="submit" disabled={loading || !licensePlate.trim()} className="h-11 bg-emerald-600 shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
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
                <Button type="button" variant="outline" onClick={handleReset} className="h-11">
                  Limpiar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {data && (
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50/70 shadow-sm dark:border-emerald-900/30 dark:from-emerald-950/15 dark:to-cyan-950/10">
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
              <Badge className="border-0 bg-emerald-100 text-xs text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-200">
                Plan gratuito: 5 consultas/día
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {!data && !error && !loading && (
        <Card className="border-dashed border-emerald-200 bg-gradient-to-br from-emerald-50/40 to-cyan-50/30 shadow-sm dark:border-emerald-900/30 dark:from-emerald-950/10 dark:to-cyan-950/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Car className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Ingresa una patente chilena para consultar la información del vehículo
            </p>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="border-cyan-100 bg-gradient-to-br from-cyan-50/50 to-background shadow-sm dark:border-cyan-900/30 dark:from-cyan-950/10 dark:to-background">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <CardTitle className="text-lg">Historial de Búsquedas</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="h-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpiar
              </Button>
            </div>
            <CardDescription>
              Últimas {history.length} consultas realizadas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => loadFromHistory(item)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="font-mono">
                            {item.patente}
                          </Badge>
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(item.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Marca: </span>
                            <span className="font-medium">{item.marca}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Modelo: </span>
                            <span className="font-medium">{item.modelo}</span>
                          </div>
                          {item.año && (
                            <div>
                              <span className="text-muted-foreground">Año: </span>
                              <span className="font-medium">{item.año}</span>
                            </div>
                          )}
                          {item.color && (
                            <div>
                              <span className="text-muted-foreground">Color: </span>
                              <span className="font-medium">{item.color}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
