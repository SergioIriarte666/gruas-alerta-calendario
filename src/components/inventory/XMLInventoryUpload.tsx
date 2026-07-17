import React from 'react';
import { AlertCircle, CheckCircle2, FileText, Package, Receipt } from 'lucide-react';
import { useXmlInventoryUpload } from '@/hooks/xml/useXmlInventoryUpload';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import { XMLImportDialogHeader, XMLImportStatsGrid } from '@/components/common/XMLImportShared';
import { InventoryValidatedDocumentCard } from '@/components/inventory/InventoryValidatedDocumentCard';
import { InventoryImportParameters } from '@/components/inventory/InventoryImportParameters';
import { SimilarProductAlert } from '@/components/cranes/forms/SimilarProductAlert';
import { ProductDetailsModal } from '@/components/inventory/ProductDetailsModal';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    validatedDocuments, selectedValidatedDocuments, summary, inventoryCatalog, serviceSearchResults,
    selectedDocuments, toggleSelectedDocument, selectAllDocuments, clearSelectedDocuments,
    lineDescriptionOverrides: _lineDescriptionOverrides, updateLineDescription,
    manualMatchedItems, setManualMatchedItems,
    editedDescriptions, setEditedDescriptions,
    discardedLines, setDiscardedLines,
    catalogSearchOpen, setCatalogSearchOpen,
    creatingProductKeys,
    selectedCostCategoryId, setSelectedCostCategoryId,
    selectedCostSubcategory, setSelectedCostSubcategory,
    selectedCostCenterId, setSelectedCostCenterId,
    selectedCraneId, setSelectedCraneId,
    selectedOperatorId, setSelectedOperatorId,
    selectedServiceId, setSelectedServiceId,
    selectedServiceFolio, setSelectedServiceFolio,
    serviceSearchOpen, setServiceSearchOpen,
    serviceSearchQuery, setServiceSearchQuery,
    isPaid, setIsPaid, showAdvancedAssociations, setShowAdvancedAssociations,
    selectedLocationId, setSelectedLocationId,
    isImporting, progress,
    pendingProductSuggestion, setPendingProductSuggestion,
    suggestedProductDetails, setSuggestedProductDetails,
    selectedService, selectedLocation, selectedCostCategory, selectedCostCenter, selectedCrane, selectedOperator,
    locations, costCategories, costSubcategories, costCenters, cranes, operators,
    handleImport, handleClose, resetState,
    handleCreateMissingProduct, handleUseSuggestedProduct, handleCreateSuggestedNew,
  } = hook;
  const selectedInventoryTotal = selectedValidatedDocuments.reduce((sum, item) => sum + item.doc.total_amount, 0);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="inventory-dialog h-[95vh] w-[min(99vw,1600px)] max-w-[1600px] overflow-clip border-border/70 bg-card p-0 shadow-2xl">
          <XMLImportDialogHeader icon={Receipt} title="Importar XML a Bodega"
            description="Valida documentos, corrige glosas, crea productos faltantes y sincroniza Bodega, Costos y Proveedores."
            fileName={selectedFile?.name} documentCount={summary.totalDocs} />

          <div className="grid min-h-0 flex-1 gap-4 px-6 pb-6 pt-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-h-0 gap-y-4 lg:flex lg:flex-col">
              <XMLDropzoneArea selectedFile={selectedFile} parseResult={parseResult} isAnalyzing={isAnalyzing}
                isDragActive={isDragActive} getRootProps={getRootProps} getInputProps={getInputProps}
                onAnalyze={() => {}} onReset={resetState}
                badges={['Validación por líneas', 'Match con catálogo', 'Trazabilidad completa']} />

              <XMLImportStatsGrid className="sm:grid-cols-2" items={[
                { title: 'Facturas Detectadas', value: summary.totalDocs, icon: FileText, tone: 'neutral' },
                { title: 'Facturas Válidas', value: summary.validDocs, icon: CheckCircle2, tone: 'success' },
                { title: 'Líneas Totales', value: summary.totalLines, icon: Package, tone: 'info' },
                { title: 'Líneas con Error', value: summary.invalidLines, icon: AlertCircle, tone: 'danger' },
              ]} />

              <ScrollArea className="min-h-0 flex-1 rounded-2xl border border-border/60 bg-background/90 shadow-sm backdrop-blur">
                <div className="space-y-4 p-4">
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
                      <CardContent className="flex min-h-[260px] flex-col items-center justify-center text-center">
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
              </ScrollArea>
            </div>

            <InventoryImportParameters
              locations={locations} costCategories={costCategories} costSubcategories={costSubcategories}
              costCenters={costCenters} cranes={cranes} operators={operators} serviceSearchResults={serviceSearchResults}
              selectedLocationId={selectedLocationId} onLocationChange={setSelectedLocationId}
              selectedCostCategoryId={selectedCostCategoryId}
              onCostCategoryChange={id => { setSelectedCostCategoryId(id); setSelectedCostSubcategory(''); const cat = costCategories.find(c => c.id === id); if (!selectedCostCenterId && cat?.default_cost_center_id) setSelectedCostCenterId(cat.default_cost_center_id); }}
              selectedCostSubcategory={selectedCostSubcategory} onCostSubcategoryChange={setSelectedCostSubcategory}
              selectedCostCenterId={selectedCostCenterId} onCostCenterChange={setSelectedCostCenterId}
              selectedCraneId={selectedCraneId} onCraneChange={setSelectedCraneId}
              selectedOperatorId={selectedOperatorId} onOperatorChange={setSelectedOperatorId}
              selectedServiceId={selectedServiceId} onServiceChange={setSelectedServiceId}
              selectedServiceFolio={selectedServiceFolio} onServiceFolioChange={setSelectedServiceFolio}
              serviceSearchOpen={serviceSearchOpen} onServiceSearchOpenChange={setServiceSearchOpen}
              serviceSearchQuery={serviceSearchQuery} onServiceSearchQueryChange={setServiceSearchQuery}
              isPaid={isPaid} onIsPaidChange={setIsPaid}
              showAdvancedAssociations={showAdvancedAssociations} onShowAdvancedAssociationsChange={setShowAdvancedAssociations}
              selectedValidatedDocumentsCount={selectedValidatedDocuments.length}
              selectedLocation={selectedLocation} selectedCostCategory={selectedCostCategory}
              selectedCostCenter={selectedCostCenter} selectedCrane={selectedCrane}
              selectedOperator={selectedOperator} selectedService={selectedService}
              isAnalyzing={isAnalyzing} isImporting={isImporting} progress={progress}
              onImport={handleImport} onClose={handleClose}
            />
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
