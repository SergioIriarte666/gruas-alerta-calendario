import React from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, FileText, Loader2, Package, Receipt } from 'lucide-react';
import { useXmlInventoryUpload } from '@/hooks/xml/useXmlInventoryUpload';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import { XMLImportDialogHeader, XMLImportStatsGrid } from '@/components/common/XMLImportShared';
import { InventoryValidatedDocumentCard } from '@/components/inventory/InventoryValidatedDocumentCard';
import { InventoryImportParameters } from '@/components/inventory/InventoryImportParameters';
import { InventoryImportReview } from '@/components/inventory/InventoryImportReview';
import { SimilarProductAlert } from '@/components/cranes/forms/SimilarProductAlert';
import { ProductDetailsModal } from '@/components/inventory/ProductDetailsModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/utils/xml/xmlInventoryHelpers';
import { cn } from '@/lib/utils';

interface XMLInventoryUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export const XMLInventoryUpload: React.FC<XMLInventoryUploadProps> = ({ isOpen, onClose, onSuccess }) => {
  const hook = useXmlInventoryUpload({ onSuccess, onClose });
  const {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive,
    validatedDocuments, selectedValidatedDocuments, summary, inventoryCatalog,
    selectedDocuments, toggleSelectedDocument, selectAllDocuments, clearSelectedDocuments,
    updateLineDescription, manualMatchedItems, setManualMatchedItems, editedDescriptions, setEditedDescriptions,
    discardedLines, setDiscardedLines, lineConsumptions, setLineConsumptions,
    lineCostSubcategories, setLineCostSubcategories, catalogSearchOpen, setCatalogSearchOpen,
    creatingProductKeys, isPaid, isImporting, progress,
    pendingProductSuggestion, setPendingProductSuggestion, suggestedProductDetails, setSuggestedProductDetails,
    selectedCostCategory, selectedCostCenter, selectedLocation, costSubcategories, cranes,
    handleImport, handleClose, resetState, handleCreateMissingProduct, handleUseSuggestedProduct, handleCreateSuggestedNew,
    step, setStep, selectedLineKeys, setSelectedLineKeys, bulkCraneId, setBulkCraneId,
    applyBulkCrane, selectedBulkLineCount, activeSelectedLines, configurationError, reviewError,
  } = hook;
  const selectedInventoryTotal = selectedValidatedDocuments.reduce((sum, item) => sum + item.doc.total_amount, 0);
  const busy = isAnalyzing || isImporting;
  const canContinue = validatedDocuments.length > 0 && !configurationError && !busy;
  const steps = ['Costo y pago', 'Productos', 'Revisión'];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="inventory-dialog h-[94dvh] w-[min(97vw,84rem)] max-w-[84rem] gap-0 overflow-hidden border-border/70 bg-card p-0 shadow-2xl">
          <XMLImportDialogHeader icon={Receipt} title="Importar compra XML"
            description="Clasifica el costo, registra el pago y distribuye los productos."
            fileName={selectedFile?.name} documentCount={summary.totalDocs} />
          <div className="shrink-0 space-y-3 border-b px-4 py-3 sm:px-6">
            <nav className="grid grid-cols-3 gap-2" aria-label="Etapas de importación">
              {steps.map((name, index) => <Button key={name} type="button" variant="outline"
                aria-current={step === index + 1 ? 'step' : undefined}
                disabled={busy || (index > 0 && !canContinue) || (index === 2 && Boolean(reviewError))}
                onClick={() => setStep(index + 1)}
                className={cn('h-auto min-h-10 gap-2 whitespace-normal px-2 text-xs sm:text-sm', step === index + 1 && 'border-primary bg-primary/10')}>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border text-xs">{index + 1}</span>{name}
              </Button>)}
            </nav>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary/5 px-3 py-2 text-xs sm:text-sm" aria-live="polite">
              <span className="min-w-0 break-words">{selectedCostCategory?.name || 'Falta clasificar el costo'} · {selectedCostCenter ? `${selectedCostCenter.code} - ${selectedCostCenter.name}` : 'Sin centro de costo'}{selectedLocation ? ` · ${selectedLocation.name}` : ''}</span>
              <span className="flex shrink-0 items-center gap-2"><Badge variant={isPaid ? 'default' : 'outline'}>{isPaid ? 'Pagada' : 'Pendiente de pago'}</Badge><strong className="tabular-nums">{formatCurrency(selectedInventoryTotal)}</strong></span>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6" aria-label={steps[step - 1]}>
            {step === 1 && <div className="space-y-4">
              <XMLDropzoneArea selectedFile={selectedFile} parseResult={parseResult} isAnalyzing={isAnalyzing}
                isDragActive={isDragActive} getRootProps={getRootProps} getInputProps={getInputProps}
                onAnalyze={() => {}} onReset={resetState} badges={['Validación por líneas', 'Match con catálogo', 'Trazabilidad completa']} />
              {parseResult?.errors?.length ? <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{parseResult.errors.join(' ')}</AlertDescription></Alert> : null}
              <InventoryImportParameters upload={hook} />
            </div>}
            {step === 2 && <div className="space-y-4">
                            <XMLImportStatsGrid className="sm:grid-cols-4" items={[
                { title: 'Facturas Detectadas', value: summary.totalDocs, icon: FileText, tone: 'neutral' },
                { title: 'Facturas Válidas', value: summary.validDocs, icon: CheckCircle2, tone: 'success' },
                { title: 'Líneas Totales', value: summary.totalLines, icon: Package, tone: 'info' },
                { title: 'Líneas con Error', value: summary.invalidLines, icon: AlertCircle, tone: 'danger' },
              ]} />
              <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-3">
                <label className="mr-auto flex min-h-10 items-center gap-2 text-sm">
                  <Checkbox aria-label="Seleccionar todos los productos" checked={activeSelectedLines.length > 0 && selectedBulkLineCount === activeSelectedLines.length}
                    disabled={busy || activeSelectedLines.length === 0}
                    onCheckedChange={checked => setSelectedLineKeys(checked === true ? new Set(activeSelectedLines.map(line => line.key)) : new Set())} />
                  {selectedBulkLineCount} producto(s) seleccionado(s)
                </label>
                <div className="min-w-40 flex-1 space-y-1 sm:max-w-60"><Label htmlFor="xml-bulk-crane">Grúa para selección</Label>
                  <Select value={bulkCraneId || 'none'} disabled={busy} onValueChange={value => setBulkCraneId(value === 'none' ? '' : value)}>
                    <SelectTrigger id="xml-bulk-crane"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="none">Elegir grúa</SelectItem>{cranes.map(crane => <SelectItem key={crane.id} value={crane.id}>{crane.licensePlate}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button type="button" variant="outline" onClick={applyBulkCrane} disabled={busy || !selectedBulkLineCount || !bulkCraneId}>Aplicar a seleccionados</Button>
              </div>
                              <div className="space-y-4">
                  {parseResult?.errors?.length ? (
                    <Alert variant="destructive"><AlertCircle className="size-4" /><AlertDescription>{parseResult.errors.join(' ')}</AlertDescription></Alert>
                  ) : null}

                  {validatedDocuments.length > 0 && (
                    <Card className="overflow-hidden border-border/70 shadow-sm">
                      <CardHeader className="border-b border-border/60 bg-muted/30 pb-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Receipt className="size-5" />
                              Facturas detectadas
                            </CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {selectedValidatedDocuments.length} de {validatedDocuments.length} seleccionadas · Total ${selectedInventoryTotal.toLocaleString('es-CL')}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:flex">
                            <Button type="button" variant="outline" size="sm" onClick={selectAllDocuments} disabled={isImporting}>
                              Seleccionar válidas
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={clearSelectedDocuments} disabled={isImporting}>
                              Deseleccionar todas
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="max-h-72 divide-y divide-border/60 overflow-y-auto">
                          {validatedDocuments.map((validatedDoc, index) => {
                            const isSelected = selectedDocuments.has(validatedDoc.doc.folio);
                            const supplierName = validatedDoc.supplier?.name || parseResult?.suppliers.find(s => s.rut === validatedDoc.doc.supplier_rut)?.name || 'Proveedor sin nombre';

                            return (
                              <div
                                key={`${validatedDoc.doc.supplier_rut || 'sin-rut'}-${validatedDoc.doc.folio || index}`}
                                className={cn(
                                  'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
                                  isSelected ? 'bg-background' : 'bg-muted/30 text-muted-foreground',
                                  !validatedDoc.isValid && 'cursor-not-allowed opacity-70'
                                )}
                              >
                                <Checkbox
                                  aria-label={`Seleccionar factura ${validatedDoc.doc.folio || index + 1}`}
                                  className="mt-1"
                                  checked={isSelected}
                                  disabled={!validatedDoc.isValid || isImporting}
                                  onCheckedChange={checked => toggleSelectedDocument(validatedDoc.doc.folio, checked === true)}
                                />
                                <button
                                  type="button"
                                  className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                                  disabled={!validatedDoc.isValid || isImporting}
                                  onClick={() => toggleSelectedDocument(validatedDoc.doc.folio, !isSelected)}
                                >
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="font-medium text-foreground">Folio {validatedDoc.doc.folio || 'sin folio'}</span>
                                    <span className="text-sm">{supplierName}</span>
                                    <Badge variant={validatedDoc.isValid ? 'default' : 'destructive'}>
                                      {validatedDoc.isValid ? 'Lista' : 'Con errores'}
                                    </Badge>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                    {validatedDoc.doc.issue_date && <span>Fecha: {validatedDoc.doc.issue_date}</span>}
                                    <span>Monto: ${validatedDoc.doc.total_amount.toLocaleString('es-CL')}</span>
                                    <span>{validatedDoc.lines.filter(l => !discardedLines.has(l.key)).length} línea(s)</span>
                                  </div>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {validatedDocuments.length > 0 && selectedValidatedDocuments.length === 0 && (
                    <Alert className="border-warning/30 bg-warning/10">
                      <AlertCircle className="size-4 text-warning" />
                      <AlertDescription className="text-warning">
                        Selecciona al menos una factura válida para importar a bodega.
                      </AlertDescription>
                    </Alert>
                  )}

                  {validatedDocuments.length === 0 && !parseResult?.errors?.length && (
                    <Card className="border-dashed border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-none">
                      <CardContent className="flex min-h-[16.25rem] flex-col items-center justify-center text-center">
                        <div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary"><FileText className="size-10" /></div>
                        <p className="text-lg font-semibold">Aún no hay facturas cargadas</p>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">Carga un XML para ver el detalle de documentos, editar glosas, validar productos y revisar errores antes de importar.</p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2">
                          <Badge variant="outline">XML estructurado</Badge>
                          <Badge variant="outline">Validación previa</Badge>
                          <Badge variant="outline">Importación segura</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {validatedDocuments.map(validatedDoc => (
                    <InventoryValidatedDocumentCard
                      key={validatedDoc.doc.folio}
                      validatedDoc={validatedDoc}
                      isSelected={selectedDocuments.has(validatedDoc.doc.folio)}
                      onToggleSelected={checked => toggleSelectedDocument(validatedDoc.doc.folio, checked)}
                      isImporting={isImporting}
                      discardedLines={discardedLines}
                      lineConsumptions={lineConsumptions}
                      onConsumptionChange={(key, value) => setLineConsumptions(previous => ({ ...previous, [key]: value }))}
                      cranes={cranes}
                      selectedLineKeys={selectedLineKeys}
                      onToggleLine={(key, checked) => setSelectedLineKeys(previous => { const next = new Set(previous); if (checked) next.add(key); else next.delete(key); return next; })}
                      costSubcategories={costSubcategories}
                      lineCostSubcategories={lineCostSubcategories}
                      onCostSubcategoryChange={(key, value) => setLineCostSubcategories(previous => {
                        const next = { ...previous };
                        next[key] = value === 'none' ? '' : value;
                        return next;
                      })}
                      onDiscardLine={key => setDiscardedLines(prev => new Set(prev).add(key))}
                      onRestoreLine={key => setDiscardedLines(prev => { const next = new Set(prev); next.delete(key); return next; })}
                      manualMatchedItems={manualMatchedItems}
                      onSetManualMatch={(key, item) => setManualMatchedItems(prev => ({ ...prev, [key]: item }))}
                      onRemoveManualMatch={key => setManualMatchedItems(prev => { const next = { ...prev }; delete next[key]; return next; })}
                      catalogSearchOpen={catalogSearchOpen}
                      onSetCatalogSearchOpen={(key, open) => setCatalogSearchOpen(prev => ({ ...prev, [key]: open }))}
                      inventoryCatalog={inventoryCatalog}
                      creatingProductKeys={creatingProductKeys}
                      editedDescription={editedDescriptions.get(validatedDoc.doc.folio) ?? validatedDoc.doc.description ?? ''}
                      onEditDescription={value => setEditedDescriptions(prev => { const next = new Map(prev); next.set(validatedDoc.doc.folio, value); return next; })}
                      onUpdateLineDescription={(lineNumber, desc) => updateLineDescription(validatedDoc.doc.folio, lineNumber, desc)}
                      onCreateMissingProduct={line => void handleCreateMissingProduct(validatedDoc.doc, line)}
                    />
                  ))}
                </div>
            </div>}
            {step === 3 && <InventoryImportReview upload={hook} />}
          </div>
          <div className="shrink-0 space-y-2 border-t bg-muted/20 px-4 py-3 sm:px-6">
            {step === 2 && reviewError && <p role="alert" className="text-xs text-destructive">{reviewError}</p>}
            {step === 1 && selectedFile && configurationError && <p className="text-xs text-muted-foreground">{configurationError}</p>}
            {isImporting && <Progress value={progress} aria-label="Progreso de importación" />}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button type="button" variant="outline" disabled={busy} onClick={() => step > 1 ? setStep(step - 1) : handleClose()}>{step > 1 ? <><ChevronLeft className="mr-1 size-4" />Anterior</> : 'Cerrar'}</Button>
              <p className="hidden text-xs text-muted-foreground sm:block">{selectedValidatedDocuments.length} factura(s) · costo consolidado por documento</p>
              <Button type="button" disabled={step === 1 ? !canContinue : busy || Boolean(reviewError)}
                onClick={() => step === 3 ? void handleImport() : setStep(step + 1)}>
                {isImporting ? <><Loader2 className="mr-2 size-4 animate-spin" />Importando...</> : step === 3 ? `Importar compra · ${formatCurrency(selectedInventoryTotal)}` : <>{step === 1 ? 'Continuar a productos' : 'Revisar importación'}<ChevronRight className="ml-1 size-4" /></>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingProductSuggestion} onOpenChange={open => { if (!open) setPendingProductSuggestion(null); }}>
        <DialogContent className="inventory-dialog max-w-3xl overflow-clip">
          <DialogHeader><DialogTitle>Validación de producto antes de crear</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Se detectaron productos similares en el catálogo. Para no afectar el flujo actual de importación, puedes reutilizar uno existente o confirmar conscientemente la creación de uno nuevo.</p>
            {pendingProductSuggestion && (
              <>
                <div className="rounded-md border bg-muted/30 p-3 text-sm">
                  <div><strong>Factura:</strong> {pendingProductSuggestion.doc.folio}</div>
                  <div><strong>Línea:</strong> {pendingProductSuggestion.line.lineNumber}</div>
                  <div><strong>Descripción XML:</strong> {pendingProductSuggestion.line.item.description}</div>
                </div>
                <SimilarProductAlert similarityResult={pendingProductSuggestion.similarityResult}
                  onUseExisting={handleUseSuggestedProduct}
                  onCreateNew={() => void handleCreateSuggestedNew()}
                  onViewDetails={setSuggestedProductDetails} />
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProductDetailsModal isOpen={!!suggestedProductDetails} onClose={() => setSuggestedProductDetails(null)} product={suggestedProductDetails} />
    </>
  );
};
