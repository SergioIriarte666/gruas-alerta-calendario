import { businessClock } from '@/utils/businessClock';
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Car, History, Trash2, Clock } from 'lucide-react';
import { usePatentLookup } from '@/hooks/usePatentLookup';
import { isVIN } from '@/utils/vehicleIdentifiers';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const PatentLookup: React.FC = () => {
  const [licensePlate, setLicensePlate] = useState('');
  const {
    data,
    loading,
    error,
    history,
    lookupPatent,
    lookupVin,
    vinData,
    vinLoading,
    loadFromHistory,
    clearHistory,
    reset,
  } = usePatentLookup();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = licensePlate.trim().replace(/[-\s]/g, '').toUpperCase();
    if (!clean) return;

    if (isVIN(clean)) {
      lookupVin(clean);
    } else {
      lookupPatent(clean);
    }
  };

  const handleReset = () => {
    setLicensePlate('');
    reset();
  };

  const isLoading = loading || vinLoading;
  const hasResult = !!(data || vinData || error);

  return (
    <div className="space-y-6">
      <Card className="resource-query-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="resource-query-icon rounded-xl p-2 shadow-sm">
              <Car className="size-5" />
            </div>
            Consulta de Patentes
          </CardTitle>
          <CardDescription>
            Verifica la información de un vehículo mediante su patente chilena o VIN
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-2 md:flex-row">
              <Input
                placeholder="Ingresa patente (ej: LGKF63) o VIN (17 caracteres)"
                value={licensePlate}
                onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
                disabled={isLoading}
                className="h-11 flex-1 rounded-xl border-border/70 bg-background/70 shadow-sm"
                maxLength={20}
              />
              <Button type="submit" disabled={isLoading || !licensePlate.trim()} className="dashboard-report-button h-11 shadow-sm">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Consultando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 size-4" />
                    Consultar
                  </>
                )}
              </Button>
              {hasResult && (
                <Button type="button" variant="outline" onClick={handleReset} className="h-11 border-border/70 bg-card/70">
                  Limpiar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Resultado de patente chilena */}
      {data && (
        <Card className="resource-query-panel">
          <CardHeader>
            <CardTitle className="text-lg">Información del Vehículo</CardTitle>
            <CardDescription>Datos obtenidos del registro chileno</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Marca</div>
                <div className="text-lg font-semibold">{data.marca}</div>
              </div>

              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Modelo</div>
                <div className="text-lg font-semibold">{data.modelo}</div>
              </div>

              {data.año && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Año</div>
                  <div className="text-lg font-semibold">{data.año}</div>
                </div>
              )}

              {data.color && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Color</div>
                  <div className="text-lg font-semibold">{data.color}</div>
                </div>
              )}

              {data.combustible && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Combustible</div>
                  <div className="font-semibold">{data.combustible}</div>
                </div>
              )}

              {data.transmision && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Transmisión</div>
                  <div className="font-semibold">{data.transmision}</div>
                </div>
              )}

              {data.motor && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Motor</div>
                  <div className="font-semibold">{data.motor} cc</div>
                </div>
              )}

              {data.mesRT && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Revisión Técnica</div>
                  <div className="font-semibold flex items-center gap-2">
                    {data.rtResultado === 'A' ? (
                      <Badge variant="outline" className="border-success/30 bg-success-soft text-xs text-success-text hover:bg-success-soft">
                        ✓ Aprobada · Vence {data.mesRT}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-danger/30 bg-danger-soft text-xs text-danger-text hover:bg-danger-soft">
                        ✗ Vencida · {data.mesRT}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <Badge variant="outline" className="border-success/30 bg-success-soft text-xs text-success-text hover:bg-success-soft">
                Pro Light · 100 consultas/día
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado de VIN decode */}
      {vinData && (
        <Card className="resource-query-panel">
          <CardHeader>
            <CardTitle className="text-lg">Información VIN</CardTitle>
            <CardDescription>
              Datos del fabricante según número de chasis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">VIN</div>
                <div className="font-mono font-semibold">{licensePlate}</div>
              </div>

              {vinData.manufacturer?.name && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Fabricante</div>
                  <div className="font-semibold">{vinData.manufacturer.name}</div>
                </div>
              )}

              {vinData.year && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Año</div>
                  <div className="font-semibold">{vinData.year}</div>
                </div>
              )}

              {vinData.manufacturer?.country && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">País de origen</div>
                  <div className="font-semibold">{vinData.manufacturer.country}</div>
                </div>
              )}

              {vinData.manufacturer?.region && (
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Región</div>
                  <div className="font-semibold">{vinData.manufacturer.region}</div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t">
              <Badge variant="outline" className="border-info/30 bg-info-soft text-xs text-info-text hover:bg-info-soft">
                Pro Light · VIN Decode
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {!data && !vinData && !error && !isLoading && (
        <Card className="resource-query-panel border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Car className="size-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Ingresa una patente chilena o VIN para consultar la información del vehículo
            </p>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="resource-query-panel">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="size-5" />
                <CardTitle className="text-lg">Historial de Búsquedas</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="h-8 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-4 mr-2" />
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
                  className="cursor-pointer border-border/70 bg-background/70 transition-colors hover:bg-accent/50"
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
                            <Clock className="size-3" />
                            {businessClock.format(item.created_at, "dd MMM yyyy, HH:mm", { locale: es })}
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
