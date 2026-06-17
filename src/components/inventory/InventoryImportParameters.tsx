import React from 'react';
import { Package, Receipt, Link2, ChevronDown, ChevronUp, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn, toTitleCase } from '@/lib/utils';
import type { ServiceSearchResult } from '@/hooks/xml/useXmlInventoryUpload';

interface CostSubcategory { id: string; name: string }
interface CostCenter { id: string; code: string; name: string; is_active: boolean }
interface Location { id: string; name: string; code: string }
interface CostCategory { id: string; name: string; default_cost_center_id?: string | null }
interface Crane { id: string; licensePlate: string }
interface Operator { id: string; name: string }
interface ServiceRef { id: string; folio: string; client: { name: string } }

interface InventoryImportParametersProps {
  locations: Location[];
  costCategories: CostCategory[];
  costSubcategories: CostSubcategory[];
  costCenters: CostCenter[];
  cranes: Crane[];
  operators: Operator[];
  serviceSearchResults: ServiceSearchResult[];
  selectedLocationId: string; onLocationChange: (id: string) => void;
  selectedCostCategoryId: string; onCostCategoryChange: (id: string) => void;
  selectedCostSubcategory: string; onCostSubcategoryChange: (val: string) => void;
  selectedCostCenterId: string; onCostCenterChange: (id: string) => void;
  selectedCraneId: string; onCraneChange: (id: string) => void;
  selectedOperatorId: string; onOperatorChange: (id: string) => void;
  selectedServiceId: string; onServiceChange: (id: string) => void;
  selectedServiceFolio: string; onServiceFolioChange: (folio: string) => void;
  serviceSearchOpen: boolean; onServiceSearchOpenChange: (open: boolean) => void;
  serviceSearchQuery: string; onServiceSearchQueryChange: (query: string) => void;
  isPaid: boolean; onIsPaidChange: (checked: boolean) => void;
  showAdvancedAssociations: boolean; onShowAdvancedAssociationsChange: (open: boolean) => void;
  selectedValidatedDocumentsCount: number;
  selectedLocation: Location | null;
  selectedCostCategory: CostCategory | null;
  selectedCostSubcategory: string;
  selectedCostCenter: CostCenter | null;
  selectedCrane: Crane | null;
  selectedOperator: Operator | null;
  selectedService: ServiceRef | null;
  isAnalyzing: boolean; isImporting: boolean; progress: number;
  onImport: () => void; onClose: () => void;
}

export const InventoryImportParameters: React.FC<InventoryImportParametersProps> = ({
  locations, costCategories, costSubcategories, costCenters, cranes, operators, serviceSearchResults,
  selectedLocationId, onLocationChange, selectedCostCategoryId, onCostCategoryChange,
  selectedCostSubcategory, onCostSubcategoryChange, selectedCostCenterId, onCostCenterChange,
  selectedCraneId, onCraneChange, selectedOperatorId, onOperatorChange,
  selectedServiceId, onServiceChange, selectedServiceFolio, onServiceFolioChange,
  serviceSearchOpen, onServiceSearchOpenChange, serviceSearchQuery, onServiceSearchQueryChange,
  isPaid, onIsPaidChange, showAdvancedAssociations, onShowAdvancedAssociationsChange,
  selectedValidatedDocumentsCount, selectedLocation, selectedCostCategory, selectedCostCenter,
  selectedCrane, selectedOperator, selectedService,
  isAnalyzing, isImporting, progress, onImport, onClose,
}) => (
  <Card className="min-h-0 overflow-hidden border-border/70 bg-background/95 shadow-sm lg:flex lg:h-full lg:flex-col">
    <CardHeader className="border-b border-border/70 bg-muted/20 pb-4">
      <div className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="rounded-lg bg-primary/10 p-2 text-primary"><Package className="size-4" /></span>
          Parametros de Ingreso
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant={selectedLocationId ? 'default' : 'outline'} className="px-2.5 py-1">{selectedLocationId ? 'Bodega configurada' : 'Falta bodega'}</Badge>
          <Badge variant={selectedCostCategoryId ? 'secondary' : 'outline'} className="px-2.5 py-1">{selectedCostCategoryId ? 'Costo configurado' : 'Falta categoría'}</Badge>
          <Badge variant={selectedCraneId ? 'secondary' : 'outline'} className="px-2.5 py-1">{selectedCraneId ? 'Consumo inmediato' : 'Solo ingreso a bodega'}</Badge>
        </div>
      </div>
    </CardHeader>

    <CardContent className="min-h-0 gap-y-4 pt-4 lg:flex-1 lg:overflow-hidden">
      <ScrollArea className="h-full pr-3">
        <div className="space-y-4 pb-4">
          <div className="space-y-2">
            <Label>Ubicación de Bodega</Label>
            <Select value={selectedLocationId} onValueChange={onLocationChange}>
              <SelectTrigger><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger>
              <SelectContent>{locations.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.code})</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Categoría de Costo</Label>
            <Select value={selectedCostCategoryId} onValueChange={onCostCategoryChange}>
              <SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
              <SelectContent>{costCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subcategoría</Label>
            <Select value={selectedCostSubcategory || 'none'} onValueChange={val => onCostSubcategoryChange(val === 'none' ? '' : val)} disabled={!selectedCostCategoryId}>
              <SelectTrigger><SelectValue placeholder="Sin subcategoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin subcategoría</SelectItem>
                {costSubcategories.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Collapsible open={showAdvancedAssociations} onOpenChange={onShowAdvancedAssociationsChange}>
            <div className="rounded-lg border border-border/60 bg-muted/20">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="flex h-auto w-full items-center justify-between px-3 py-2 hover:bg-transparent">
                  <span className="flex items-center gap-2 text-sm font-medium"><Link2 className="size-4 text-muted-foreground" />Asociaciones avanzadas</span>
                  {showAdvancedAssociations ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 border-t px-3 py-3">
                <div className="space-y-2">
                  <Label>Centro de Costo</Label>
                  <Select value={selectedCostCenterId || 'none'} onValueChange={val => onCostCenterChange(val === 'none' ? '' : val)}>
                    <SelectTrigger><SelectValue placeholder="Sin centro de costo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin centro de costo</SelectItem>
                      {costCenters.filter(c => c.is_active).map(c => <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Servicio</Label>
                  <Popover open={serviceSearchOpen} onOpenChange={open => { onServiceSearchOpenChange(open); if (!open) onServiceSearchQueryChange(''); }}>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" role="combobox" aria-expanded={serviceSearchOpen}
                        className={cn('w-full justify-between', !selectedServiceId ? 'text-muted-foreground' : '')}>
                        <span className="truncate">{selectedService ? `${selectedService.folio} - ${toTitleCase(selectedService.client.name)}` : 'Sin asociar'}</span>
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[420px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Buscar por folio, cliente, patente, grua, operador o fecha..." value={serviceSearchQuery} onValueChange={onServiceSearchQueryChange} />
                        <CommandList>
                          <CommandEmpty><div className="p-3 text-sm text-muted-foreground">{serviceSearchQuery.trim() ? 'No se encontraron servicios.' : 'Escribe para buscar servicios.'}</div></CommandEmpty>
                          <CommandGroup>
                            <CommandItem value="none" onSelect={() => { onServiceChange(''); onServiceFolioChange(''); onServiceSearchOpenChange(false); }}>
                              <Check className={cn('mr-2 size-4', !selectedServiceId ? 'opacity-100' : 'opacity-0')} />Sin asociar
                            </CommandItem>
                            {serviceSearchResults.map(service => (
                              <CommandItem key={service.id} value={service.searchValue} onSelect={() => { onServiceChange(service.id); onServiceSearchOpenChange(false); }} className="items-start">
                                <Check className={cn('mr-2 mt-0.5 size-4 shrink-0', selectedServiceId === service.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex min-w-0 flex-col">
                                  <span className="font-medium">{service.folio} - {service.clientName}</span>
                                  <span className="text-xs text-muted-foreground">{service.serviceDateLabel} · Patente {service.licensePlate || 'N/A'}</span>
                                  <span className="text-xs text-muted-foreground">Grúa {service.craneLabel} · Operador {service.operatorLabel}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Busca por folio, cliente, patente, grúa, operador o fecha.</p>
                </div>

                <div className="space-y-2">
                  <Label>Grúa</Label>
                  <Select value={selectedCraneId || 'none'} onValueChange={val => onCraneChange(val === 'none' ? '' : val)}>
                    <SelectTrigger><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Sin asociar</SelectItem>{cranes.map(c => <SelectItem key={c.id} value={c.id}>{c.licensePlate}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Operador</Label>
                  <Select value={selectedOperatorId || 'none'} onValueChange={val => onOperatorChange(val === 'none' ? '' : val)}>
                    <SelectTrigger><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Sin asociar</SelectItem>{operators.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Folio de Servicio</Label>
                  <Textarea value={selectedServiceFolio} onChange={e => onServiceFolioChange(e.target.value)} rows={2} className="min-h-[56px] resize-none" placeholder="Ej: F-1234" disabled={isImporting} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          <div className="flex items-center gap-3 rounded-xl border border-success/20 bg-success/10 p-3">
            <Checkbox id="inventory-xml-is-paid" checked={isPaid} onCheckedChange={checked => onIsPaidChange(Boolean(checked))} disabled={isImporting} />
            <div className="space-y-0.5">
              <label htmlFor="inventory-xml-is-paid" className="cursor-pointer text-sm font-medium text-foreground">Marcar compra como pagada</label>
              <p className="text-xs text-muted-foreground">Al importar, se registrará la fecha del costo como fecha de pago y la factura quedará pagada.</p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 bg-gradient-to-br from-muted/30 to-background p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Resumen del flujo</p>
            <p>- Factura de proveedor</p>
            <p>- Costo consolidado en el módulo de Costos</p>
            <p>- Líneas con vínculo a producto y movimiento</p>
            <p>- Entradas de inventario una por cada línea válida</p>
            {selectedCraneId && <p>- Salida inmediata a grúa y registro en piezas/consumos</p>}
          </div>

          <Collapsible>
            <div className="rounded-xl border border-border/60 bg-background/95 shadow-sm">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="flex h-auto w-full items-center justify-between px-3 py-3 hover:bg-muted/30">
                  <div className="flex items-center gap-2 text-left">
                    <span className="rounded-md bg-primary/10 p-1.5 text-primary"><Receipt className="size-4" /></span>
                    <div><p className="text-sm font-semibold text-foreground">Resumen activo</p><p className="text-xs text-muted-foreground">Ver configuración aplicada a {selectedValidatedDocumentsCount} documento(s)</p></div>
                  </div>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t px-3 py-3">
                <div className="grid grid-cols-1 gap-2 text-xs">
                  {([
                    ['Bodega', selectedLocation ? `${selectedLocation.name} (${selectedLocation.code})` : 'Sin seleccionar'],
                    ['Costo', `${selectedCostCategory?.name || 'Sin categoría'}${selectedCostSubcategory ? ` · ${selectedCostSubcategory}` : ''}`],
                    ['Centro de costo', selectedCostCenter ? `${selectedCostCenter.code} - ${selectedCostCenter.name}` : 'Sin asignar'],
                    ['Destino', selectedCrane ? `Grúa ${selectedCrane.licensePlate}${selectedOperator ? ` · ${selectedOperator.name}` : ''}` : 'Solo ingreso a bodega'],
                    ['Servicio', selectedService ? `${selectedService.folio} - ${toTitleCase(selectedService.client.name)}` : 'Sin asociar'],
                    ['Pago', isPaid ? 'Compra marcada como pagada' : 'Compra pendiente de pago'],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-muted/40 px-3 py-2">
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {(isAnalyzing || isImporting) && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground">{isAnalyzing ? 'Analizando XML...' : 'Importando transacciones...'}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </CardContent>

    <div className="space-y-2 border-t bg-muted/20 p-4">
      <Button className="h-11 w-full text-sm font-semibold shadow-sm" onClick={onImport}
        disabled={isAnalyzing || isImporting || selectedValidatedDocumentsCount === 0 || !selectedLocationId}>
        {isImporting ? <><Loader2 className="mr-2 size-4 animate-spin" />Importando...</> : 'Importar a Bodega'}
      </Button>
      <Button variant="outline" className="h-11 w-full" onClick={onClose} disabled={isAnalyzing || isImporting}>Cerrar</Button>
    </div>
  </Card>
);
