import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus, Check, ChevronsUpDown, X, RotateCcw, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { resolveLineConsumption, validateLineConsumption, type LineConsumption } from '@/utils/xml/xmlInventoryConsumption';
import { cn } from '@/lib/utils';
import { formatCurrency, computeLineTotal } from '@/utils/xml/xmlInventoryHelpers';
import type { ValidatedDocument, ValidatedInvoiceLine, InventoryCatalogItem } from '@/hooks/xml/useXmlInventoryUpload';

interface InventoryValidatedDocumentCardProps {
  validatedDoc: ValidatedDocument;
  isSelected: boolean;
  onToggleSelected: (checked: boolean) => void;
  isImporting: boolean;
  discardedLines: Set<string>;
  onDiscardLine: (key: string) => void;
  onRestoreLine: (key: string) => void;
  manualMatchedItems: Record<string, InventoryCatalogItem>;
  onSetManualMatch: (key: string, item: InventoryCatalogItem) => void;
  onRemoveManualMatch: (key: string) => void;
  catalogSearchOpen: Record<string, boolean>;
  onSetCatalogSearchOpen: (key: string, open: boolean) => void;
  inventoryCatalog: InventoryCatalogItem[];
  creatingProductKeys: Set<string>;
  editedDescription: string;
  onEditDescription: (value: string) => void;
  onUpdateLineDescription: (lineNumber: number, desc: string) => void;
  onCreateMissingProduct: (line: ValidatedInvoiceLine) => void;
  lineConsumptions: Record<string, LineConsumption>;
  onConsumptionChange: (key: string, value: LineConsumption) => void;
  cranes: { id: string; licensePlate: string }[];
  selectedLineKeys: Set<string>;
  onToggleLine: (key: string, checked: boolean) => void;
  costSubcategories: { id: string; name: string }[];
  lineCostSubcategories: Record<string, string>;
  onCostSubcategoryChange: (key: string, value: string) => void;
}

export const InventoryValidatedDocumentCard: React.FC<InventoryValidatedDocumentCardProps> = ({
  validatedDoc, isSelected, onToggleSelected, isImporting, discardedLines, onDiscardLine, onRestoreLine,
  manualMatchedItems, onSetManualMatch, onRemoveManualMatch, catalogSearchOpen, onSetCatalogSearchOpen,
  inventoryCatalog, creatingProductKeys, editedDescription, onEditDescription, onUpdateLineDescription, onCreateMissingProduct,
  lineConsumptions, onConsumptionChange, cranes, selectedLineKeys, onToggleLine,
  costSubcategories, lineCostSubcategories, onCostSubcategoryChange,
}) => (
  <Card className={cn('overflow-hidden border-border/70 shadow-sm transition-opacity', !isSelected && 'opacity-60')}>
    <CardHeader className="pb-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Checkbox aria-label={`Seleccionar factura ${validatedDoc.doc.folio}`} checked={isSelected} onCheckedChange={checked => onToggleSelected(checked === true)} disabled={!validatedDoc.isValid || isImporting} />
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><FileText className="size-4" />{validatedDoc.doc.folio}</CardTitle>
            <Textarea rows={2} className="mt-1 resize-y text-sm" value={editedDescription} onChange={e => onEditDescription(e.target.value)} disabled={isImporting} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={validatedDoc.isValid ? 'default' : 'destructive'}>{validatedDoc.isValid ? 'Lista para importar' : 'Con errores'}</Badge>
          <Badge variant="outline">{validatedDoc.lines.filter(l => !discardedLines.has(l.key)).length} línea(s)</Badge>
          <Badge variant="secondary">{formatCurrency(validatedDoc.doc.total_amount)}</Badge>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      {validatedDoc.errors.length > 0 && <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{validatedDoc.errors.join(' ')}</AlertDescription></Alert>}
      {validatedDoc.warnings.length > 0 && <Alert><AlertCircle className="size-4" /><AlertDescription>{validatedDoc.warnings.join(' ')}</AlertDescription></Alert>}

      <div className="space-y-3">
        {validatedDoc.lines.map(line => {
          const isDiscarded = discardedLines.has(line.key);
          const consumption = resolveLineConsumption(Number(line.item.quantity), lineConsumptions[line.key]);
          const consumptionError = validateLineConsumption(Number(line.item.quantity), consumption);
          return (
            <div key={line.key} className={cn('space-y-3 rounded-xl border border-border/70 bg-background p-4', isDiscarded && 'opacity-50')}>
              <div className="flex items-start gap-3">
                <Checkbox aria-label={`Seleccionar producto ${line.lineNumber} de factura ${validatedDoc.doc.folio}`} className="mt-1"
                  checked={selectedLineKeys.has(line.key)} disabled={isImporting || isDiscarded || !isSelected}
                  onCheckedChange={checked => onToggleLine(line.key, checked === true)} />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">{line.item.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{line.item.product_code || 'Sin código XML'} · {line.item.quantity} un. × {formatCurrency(line.item.unit_price)}</p>
                </div>
                <div className="text-right"><p className="whitespace-nowrap text-sm font-semibold tabular-nums">{formatCurrency(computeLineTotal(line.item))}</p><p className="text-xs text-muted-foreground">Total de línea</p></div>
                <Button type="button" size="sm" variant="ghost" className="size-7 shrink-0 p-0" disabled={isImporting}
                  onClick={() => isDiscarded ? onRestoreLine(line.key) : onDiscardLine(line.key)}
                  aria-label={`${isDiscarded ? 'Restaurar' : 'Descartar'} línea ${line.lineNumber}`}>
                  {isDiscarded ? <RotateCcw className="size-3.5" /> : <X className="size-3.5" />}
                </Button>
              </div>
              {isDiscarded ? <Badge variant="outline">Línea descartada</Badge> : <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr_120px]">
                  <div className="space-y-2">
                    <Label htmlFor={`subcategory-${line.key}`}>Subcategoría del producto</Label>
                    <Select value={lineCostSubcategories[line.key] || 'none'} disabled={isImporting}
                      onValueChange={value => onCostSubcategoryChange(line.key, value)}>
                      <SelectTrigger id={`subcategory-${line.key}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Sin subcategoría</SelectItem>{costSubcategories.map(subcategory => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`destination-${line.key}`}>Destino del producto</Label>
                    <Select value={consumption.immediate ? 'consume' : 'store'} disabled={isImporting}
                      onValueChange={value => onConsumptionChange(line.key, { ...consumption, immediate: value === 'consume' })}>
                      <SelectTrigger id={`destination-${line.key}`}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="store">Mantener en bodega</SelectItem><SelectItem value="consume">Consumo inmediato</SelectItem></SelectContent>
                    </Select>
                  </div>
                  {consumption.immediate ? <>
                    <div className="space-y-2"><Label htmlFor={`crane-${line.key}`}>Grúa de destino</Label>
                      <Select value={consumption.craneId || 'none'} disabled={isImporting} onValueChange={value => onConsumptionChange(line.key, { ...consumption, craneId: value === 'none' ? '' : value })}>
                        <SelectTrigger id={`crane-${line.key}`}><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="none">Selecciona una grúa</SelectItem>{cranes.map(crane => <SelectItem key={crane.id} value={crane.id}>{crane.licensePlate}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label htmlFor={`consume-${line.key}`}>Cantidad a consumir</Label>
                      <Input id={`consume-${line.key}`} type="number" min={1} max={Number(line.item.quantity)} step={1} value={Number.isNaN(consumption.quantity) ? '' : consumption.quantity} disabled={isImporting}
                        onChange={event => onConsumptionChange(line.key, { ...consumption, quantity: event.target.value === '' ? NaN : Number(event.target.value) })} />
                    </div>
                  </> : <p className="self-end rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground sm:col-span-2">{line.item.quantity} unidad(es) permanece(n) en bodega</p>}
                </div>
                {consumption.immediate && (consumptionError ? <p role="alert" className="text-xs text-destructive">{consumptionError}</p>
                  : <p className="text-xs text-muted-foreground">{consumption.quantity} a consumo · {Number(line.item.quantity) - consumption.quantity} permanece(n) en bodega</p>)}
              </>}
              {line.error ? <p className="text-xs text-destructive">{line.error}</p> : line.warning ? <p className="text-xs text-muted-foreground">{line.warning}</p> : <Badge variant="outline" className="gap-1"><CheckCircle2 className="size-3" />Producto validado</Badge>}
              <details open={!line.matchedItem} className="rounded-lg border border-border/60 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium">Producto en catálogo{line.matchedItem ? `: ${line.matchedItem.name}` : ': vincular o crear'}</summary>
                <div className="mt-2">
                                      {line.matchedItem ? (
                      <div>
                        <div className="font-medium">{line.matchedItem.name}</div>
                        <div className="text-xs text-muted-foreground">{line.matchedItem.sku || line.matchedItem.barcode || 'Sin SKU'}</div>
                        {manualMatchedItems[line.key] && (
                          <Button type="button" size="sm" variant="ghost" className="mt-1 h-5 px-1 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => onRemoveManualMatch(line.key)} disabled={isImporting}>
                            <X className="mr-0.5 size-3" />Quitar selección
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {line.candidates.length > 0 && (
                          <div className="space-y-1">
                            <span className="block text-xs font-medium text-muted-foreground">{line.candidates.length} sugerencia(s):</span>
                            <div className="max-h-[7.5rem] space-y-1 overflow-y-auto">
                              {line.candidates.slice(0, 5).map(candidate => (
                                <div key={candidate.id} className="flex items-center justify-between gap-1 rounded border bg-muted/50 p-1.5 text-xs">
                                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{candidate.name}</div><div className="text-muted-foreground">{candidate.sku || 'Sin SKU'}</div></div>
                                  <Button type="button" size="sm" variant="ghost" className="h-6 shrink-0 px-2 text-xs" disabled={isImporting} onClick={() => onSetManualMatch(line.key, candidate)}>
                                    <Check className="mr-0.5 size-3" />Usar
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {line.candidates.length === 0 && <span className="block text-xs text-muted-foreground">Sin coincidencia</span>}
                        <Popover open={catalogSearchOpen[line.key] || false} onOpenChange={open => onSetCatalogSearchOpen(line.key, open)}>
                          <PopoverTrigger asChild>
                            <Button type="button" size="sm" variant="outline" className="h-7 w-full justify-between text-xs" disabled={isImporting}>
                              <span>Buscar en catálogo...</span><ChevronsUpDown className="size-3 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[17.5rem] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar por nombre o SKU..." />
                              <CommandList>
                                <CommandEmpty>No se encontró producto.</CommandEmpty>
                                <CommandGroup>
                                  {inventoryCatalog.map(catalogItem => (
                                    <CommandItem key={catalogItem.id} value={`${catalogItem.name} ${catalogItem.sku || ''}`}
                                      onSelect={() => { onSetManualMatch(line.key, catalogItem); onSetCatalogSearchOpen(line.key, false); }}>
                                      <div className="flex flex-col"><span className="text-sm">{catalogItem.name}</span><span className="text-xs text-muted-foreground">{catalogItem.sku || 'Sin SKU'}</span></div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button type="button" size="sm" variant="outline" className="h-7 w-full text-xs"
                          disabled={isImporting || creatingProductKeys.has(line.key)} onClick={() => void onCreateMissingProduct(line)}>
                          {creatingProductKeys.has(line.key) ? <><Loader2 className="size-3 animate-spin" />Creando...</> : <><Plus className="size-3" />Crear producto</>}
                        </Button>
                      </div>
                    )}
                </div>
              </details>
              <details className="rounded-lg border border-border/60 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium">Editar glosa del producto</summary>
                <Label htmlFor={`description-${line.key}`} className="sr-only">Glosa del producto {line.lineNumber}</Label>
                <Textarea id={`description-${line.key}`} className="mt-2" value={line.item.description} disabled={isImporting} rows={2} onChange={event => onUpdateLineDescription(line.lineNumber, event.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground">La coincidencia con el catálogo se recalcula al editar.</p>
              </details>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
);
