import React from 'react';
import { Tags, Wallet, Clock3, CircleCheck, Link2, Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn, toTitleCase } from '@/lib/utils';
import { formatCurrency } from '@/utils/xml/xmlInventoryHelpers';
import type { useXmlInventoryUpload } from '@/hooks/xml/useXmlInventoryUpload';

interface InventoryImportParametersProps {
  upload: ReturnType<typeof useXmlInventoryUpload>;
}

export const InventoryImportParameters = ({ upload }: InventoryImportParametersProps) => {
  const {
    locations, costCategories, costCenters, operators, serviceSearchResults,
    selectedLocationId, setSelectedLocationId, selectedCostCategoryId, setSelectedCostCategoryId,
    setLineCostSubcategories,
    selectedCostCenterId, setSelectedCostCenterId, selectedOperatorId, setSelectedOperatorId,
    selectedServiceId, setSelectedServiceId: onServiceChange, selectedService,
    selectedServiceFolio, setSelectedServiceFolio: onServiceFolioChange,
    serviceSearchOpen, setServiceSearchOpen: onServiceSearchOpenChange,
    serviceSearchQuery, setServiceSearchQuery: onServiceSearchQueryChange,
    showAdvancedAssociations, setShowAdvancedAssociations,
    isPaid, setIsPaid, paymentDate, setPaymentDate, paymentReference, setPaymentReference,
    dueDateOverride, setDueDateOverride, importNotes, setImportNotes, isImporting,
    selectedValidatedDocuments,
  } = upload;
  const total = selectedValidatedDocuments.reduce((sum, document) => sum + document.doc.total_amount, 0);
  const documentDueDate = selectedValidatedDocuments.length === 1
    ? selectedValidatedDocuments[0].doc.due_date || selectedValidatedDocuments[0].doc.issue_date : '';
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden border-border/70">
          <CardHeader className="border-b bg-muted/20 py-4">
            <CardTitle className="flex items-center gap-2 text-base"><Tags className="size-4 text-primary" />Clasificación del costo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="xml-cost-category">Categoría de costo *</Label>
              <Select value={selectedCostCategoryId} disabled={isImporting} onValueChange={id => {
                setSelectedCostCategoryId(id);
                setLineCostSubcategories({});
                const category = costCategories.find(item => item.id === id);
                if (category?.default_cost_center_id) setSelectedCostCenterId(category.default_cost_center_id);
              }}>
                <SelectTrigger id="xml-cost-category"><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
                <SelectContent>{costCategories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="xml-cost-center">Centro de costo</Label>
              <Select value={selectedCostCenterId || 'none'} disabled={isImporting} onValueChange={value => setSelectedCostCenterId(value === 'none' ? '' : value)}>
                <SelectTrigger id="xml-cost-center"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Sin centro de costo</SelectItem>{costCenters.filter(center => center.is_active).map(center => <SelectItem key={center.id} value={center.id}>{center.code} - {center.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="xml-warehouse">Bodega de ingreso *</Label>
              <Select value={selectedLocationId} disabled={isImporting} onValueChange={setSelectedLocationId}>
                <SelectTrigger id="xml-warehouse"><SelectValue placeholder="Selecciona una bodega" /></SelectTrigger>
                <SelectContent>{locations.map(location => <SelectItem key={location.id} value={location.id}>{location.name} ({location.code})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-primary/5 p-3 sm:col-span-2">
              <p className="text-sm font-medium">Subcategorías por producto</p>
              <p className="mt-1 text-xs text-muted-foreground">En el paso Productos asignarás la subcategoría de cada artículo: por ejemplo, Partes y Piezas, Consumibles o Herramientas. La factura conserva un solo costo consolidado.</p>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-border/70">
          <CardHeader className="border-b bg-muted/20 py-4">
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="size-4 text-primary" />Estado de pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Estado de pago">
              <Button type="button" variant="outline" aria-pressed={!isPaid} disabled={isImporting} onClick={() => setIsPaid(false)} className={cn(!isPaid && 'border-primary bg-primary/10')}><Clock3 className="mr-2 size-4" />Pendiente</Button>
              <Button type="button" variant="outline" aria-pressed={isPaid} disabled={isImporting} onClick={() => setIsPaid(true)} className={cn(isPaid && 'border-primary bg-primary/10')}><CircleCheck className="mr-2 size-4" />Pagada</Button>
            </div>
            {isPaid ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="xml-payment-date">Fecha de pago *</Label><DatePickerInput id="xml-payment-date" value={paymentDate} disabled={isImporting} onChange={setPaymentDate} /></div>
                <div className="space-y-2"><Label htmlFor="xml-payment-reference">Referencia de pago</Label><Input id="xml-payment-reference" value={paymentReference} disabled={isImporting} onChange={event => setPaymentReference(event.target.value)} placeholder="N.º de operación (opcional)" maxLength={200} /></div>
              </div>
            ) : (
              <div className="space-y-2"><Label htmlFor="xml-due-date">Fecha de vencimiento</Label><DatePickerInput id="xml-due-date" value={dueDateOverride || documentDueDate} disabled={isImporting} onChange={setDueDateOverride} /><p className="text-xs text-muted-foreground">{selectedValidatedDocuments.length > 1 && !dueDateOverride ? 'Se conserva el vencimiento de cada XML. Al elegir una fecha, se aplica a todas las facturas seleccionadas.' : 'La compra quedará en cuentas por pagar con este vencimiento.'}</p></div>
            )}
            <div className={cn('rounded-xl border p-4', isPaid ? 'border-success/20 bg-success/10' : 'border-warning/20 bg-warning/10')} aria-live="polite">
              <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{isPaid ? 'Pago por el total de la compra' : 'Saldo por pagar'}</span><span className="font-semibold tabular-nums">{formatCurrency(total)}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{isPaid ? 'Se registrará la fecha indicada en el costo y en el pago al proveedor.' : 'La factura y su costo quedarán pendientes de pago.'}</p>
            </div>
            <p className="text-xs text-muted-foreground">Una factura, un costo consolidado y un registro de pago por documento.</p>
          </CardContent>
        </Card>
      </div>
      <details open={showAdvancedAssociations} onToggle={event => setShowAdvancedAssociations(event.currentTarget.open)} className="rounded-xl border border-border/70 bg-background p-4">
        <summary className="cursor-pointer text-sm font-medium"><Link2 className="mr-2 inline size-4 text-muted-foreground" />Asociaciones y observaciones</summary>
        <fieldset disabled={isImporting} className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
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
                    <PopoverContent className="w-[26.25rem] p-0" align="start">
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
          <div className="space-y-2"><Label htmlFor="xml-operator">Operador</Label><Select value={selectedOperatorId || 'none'} disabled={isImporting} onValueChange={value => setSelectedOperatorId(value === 'none' ? '' : value)}><SelectTrigger id="xml-operator"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin asociar</SelectItem>{operators.map(operator => <SelectItem key={operator.id} value={operator.id}>{operator.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="xml-service-folio">Folio de servicio</Label><Input id="xml-service-folio" value={selectedServiceFolio} onChange={event => onServiceFolioChange(event.target.value)} placeholder="Opcional" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="xml-import-notes">Observaciones</Label><Textarea id="xml-import-notes" value={importNotes} onChange={event => setImportNotes(event.target.value)} rows={2} /></div>
        </fieldset>
      </details>
    </div>
  );
};
