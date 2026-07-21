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
}

export const InventoryValidatedDocumentCard: React.FC<InventoryValidatedDocumentCardProps> = ({
  validatedDoc, isSelected, onToggleSelected, isImporting, discardedLines, onDiscardLine, onRestoreLine,
  manualMatchedItems, onSetManualMatch, onRemoveManualMatch, catalogSearchOpen, onSetCatalogSearchOpen,
  inventoryCatalog, creatingProductKeys, editedDescription, onEditDescription, onUpdateLineDescription, onCreateMissingProduct,
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-3">#</th><th className="pb-2 pr-3">Codigo XML</th><th className="pb-2 pr-3">Descripcion</th>
              <th className="pb-2 pr-3">Cantidad</th><th className="pb-2 pr-3">Unitario</th><th className="pb-2 pr-3">Total</th>
              <th className="pb-2 pr-3">Producto</th><th className="pb-2 pr-3">Estado</th><th className="pb-2 text-center">Acción</th>
            </tr>
          </thead>
          <tbody>
            {validatedDoc.lines.map(line => {
              const isDiscarded = discardedLines.has(line.key);
              return (
                <tr key={line.key} className={cn('border-b last:border-0 align-top transition-opacity', isDiscarded && 'opacity-40')}>
                  <td className="py-2 pr-3">{line.lineNumber}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{line.item.product_code || '-'}</td>
                  <td className="min-w-[20rem] py-2 pr-3">
                    <div className="space-y-1">
                      <Textarea value={line.item.description} onChange={e => onUpdateLineDescription(line.lineNumber, e.target.value)}
                        disabled={isImporting} rows={2} className="min-h-[4.5rem] resize-y"
                        placeholder="Edita la glosa para mejorar la coincidencia con el catálogo" />
                      <p className="text-xs text-muted-foreground">La validación y la coincidencia se recalculan al editar la glosa.</p>
                    </div>
                  </td>
                  <td className="py-2 pr-3">{line.item.quantity}</td>
                  <td className="py-2 pr-3">{formatCurrency(line.item.unit_price)}</td>
                  <td className="py-2 pr-3">{formatCurrency(computeLineTotal(line.item))}</td>
                  <td className="min-w-[17.5rem] py-2 pr-3">
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
                  </td>
                  <td className="py-2">
                    {line.error ? <Badge variant="destructive">{line.error}</Badge>
                      : line.warning ? <Badge variant="secondary">{line.warning}</Badge>
                      : <Badge variant="default" className="gap-1"><CheckCircle2 className="size-3" />OK</Badge>}
                  </td>
                  <td className="py-2 text-center">
                    {isDiscarded ? (
                      <Button type="button" size="sm" variant="ghost" className="size-7 p-0 text-success hover:bg-success/10 hover:text-success"
                        onClick={() => onRestoreLine(line.key)} disabled={isImporting} title="Restaurar línea">
                        <RotateCcw className="size-3.5" />
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" className="size-7 p-0 text-danger hover:bg-danger-soft hover:text-danger"
                        onClick={() => onDiscardLine(line.key)} disabled={isImporting} title="Descartar línea">
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
);
