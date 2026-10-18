import React from 'react';
import { useXmlCostUpload } from '@/hooks/xml/useXmlCostUpload';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import { BatchProgressModal } from '@/components/ui/batch-progress-modal';
import { XMLImportDialogHeader, XMLImportProgressCard, XMLImportStatsGrid } from '@/components/common/XMLImportShared';
import { CostXmlImportReview } from '@/components/costs/CostXmlImportReview';
import { CostSupplierRow } from '@/components/costs/CostSupplierRow';
import { CostDocumentRow } from '@/components/costs/CostDocumentRow';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Loader2, Users, Receipt, DollarSign, Building, ShieldAlert, Link2, Package, Info, Code, Database } from 'lucide-react';
import { getDocumentStateKey } from '@/utils/xml/xmlGlosaHelpers';
import { cn } from '@/lib/utils';

interface XMLCostUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const XMLCostUpload = ({ isOpen, onClose, onSuccess }: XMLCostUploadProps) => {
  const upload = useXmlCostUpload({ onSuccess, onClose });
  const {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive, triggerAnalyze,
    isUploading, uploadProgress,
    isCheckingDuplicates, isSearchingMatches, showDuplicateWarning, setShowDuplicateWarning,
    selectedSuppliers, selectedDocuments, selectedTotal, uploadableCount,
    getSelectedLineSet, getSelectedLineCount, hasSelectedLines, getDocumentAmount, toggleLineSelection, toggleAllLines,
    supplierCategoryMapping, lineSubcategories, setLineSubcategories, costSubcategories,
    step, setStep, configurationError, reviewError, getDocumentDueDate,
    supplierPaymentCondition: _supplierPaymentCondition, setSupplierPaymentCondition,
    supplierCreditDate, setSupplierCreditDate,
    setDueDateOverrides,
    paidOverrides, setPaidOverrides,
    paidDateOverrides, setPaidDateOverrides,
    documentDescriptionOverrides, setDocumentDescriptionOverrides,
    expandedDocumentDetails, setExpandedDocumentDetails,
    historicalGlosaSuggestions,
    duplicateResults, matchedCosts,
    linkDecisions, handleLinkDecisionChange,
    syncToInventory, setSyncToInventory,
    activeCategories, paymentTerms, loadingTerms, batchProgress,
    getSupplierCondition, getDuplicateInfoForDocument,
    buildSuggestedGlosa, applyConditionToSupplierDocuments, resolveCategoryId,
    handleUploadCosts, reset,
    handleCategoryChange,
    toggleSupplierSelection, toggleDocumentSelection, selectAllDocuments, clearSelectedDocuments,
    getDocumentEntity, lowboyCraneOptions, craneIdByDocument, setCraneIdByDocument,
    paidByDocument, setPaidByDocument, hasLowboyDocuments,
  } = upload;
  const busy = isUploading || isAnalyzing || isCheckingDuplicates || isSearchingMatches;
  const steps = ['Costo y proveedores', 'Productos y pago', 'Revisión'];

  const handleClose = () => {
    if (isUploading) return;
    reset();
    batchProgress.close();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="finance-dialog flex h-[94dvh] w-[calc(100vw-1rem)] max-w-[84rem] flex-col gap-0 overflow-hidden border-border/70 bg-card p-0 shadow-2xl sm:w-[min(96vw,84rem)]">
        <XMLImportDialogHeader icon={Code} title="Importar gastos XML" description="Clasifica cada producto, registra el pago y revisa antes de guardar." fileName={selectedFile?.name} documentCount={parseResult?.totalDocuments} />
        <div className="shrink-0 space-y-3 border-b px-3 py-3 sm:px-6">
          <nav className="grid grid-cols-3 gap-2" aria-label="Etapas de importación de costos">
            {steps.map((name, index) => <Button key={name} type="button" variant="outline"
              aria-current={step === index + 1 ? 'step' : undefined}
              disabled={busy || (index > 0 && (!parseResult || !!configurationError)) || (index === 2 && !!reviewError)}
              onClick={() => setStep(index + 1)} className={cn('h-auto min-h-10 whitespace-normal px-2 text-xs sm:text-sm', step === index + 1 && 'border-primary bg-primary/10')}>
              {index + 1}. {name}
            </Button>)}
          </nav>
          <div className="flex flex-wrap justify-between gap-2 rounded-xl bg-primary/5 px-3 py-2 text-sm" aria-live="polite">
            <span>{uploadableCount} factura(s) incluidas · {upload.uploadableDocuments.filter(document => paidOverrides[getDocumentStateKey(document)]).length} pagada(s)</span>
            <strong>{`$${selectedTotal.toLocaleString('es-CL')}`}</strong>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 px-3 pb-5 pt-4 sm:px-6 sm:pb-6">
          {step === 1 && <XMLDropzoneArea selectedFile={selectedFile} parseResult={parseResult} isAnalyzing={isAnalyzing} isDragActive={isDragActive} getRootProps={getRootProps} getInputProps={getInputProps} onAnalyze={triggerAnalyze} onReset={reset} badges={['Detección de duplicados', 'Sync con Bodega', 'Clasificación por producto']} />}

          {isUploading && uploadProgress > 0 && <XMLImportProgressCard label="Subiendo datos..." value={uploadProgress} />}

          {parseResult && (
            <div className="space-y-6">
              {step === 1 && <>
              <XMLImportStatsGrid items={[
                { title: 'Proveedores', value: `${parseResult.validSuppliers}/${parseResult.totalSuppliers}`, icon: Users, tone: 'neutral' },
                { title: 'Documentos', value: `${parseResult.validDocuments}/${parseResult.totalDocuments}`, icon: Receipt, tone: 'success' },
                { title: 'Errores', value: parseResult.errors.length, icon: AlertCircle, tone: 'danger' },
                { title: 'Total Selec.', value: `$${selectedTotal.toLocaleString('es-CL')}`, icon: DollarSign, tone: 'info' },
              ]} />

              {hasLowboyDocuments && (
                <Alert className="border-primary/30 bg-primary/10">
                  <Building className="size-4 text-primary" />
                  <AlertDescription className="text-primary">
                    <strong>🏗️ Documentos de LowBoy Chile SpA detectados.</strong> Se registrarán con entidad LowBoy, financiados por Grúas 5 Norte por defecto. Ajusta el equipo y quién financia en cada documento (sección "Ver detalles").
                  </AlertDescription>
                </Alert>
              )}

              <Card className="overflow-hidden border-border/70 bg-card shadow-sm">
                <CardHeader className="border-b border-border/60 bg-muted/30 py-4"><CardTitle className="text-base text-foreground">Cómo registrar estos gastos</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Switch checked={syncToInventory} onCheckedChange={setSyncToInventory} />
                    <Label className="text-sm flex items-center gap-2"><Package className="size-4" />Sincronizar con Bodega/Inventario</Label>
                    <TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="size-4 text-muted-foreground cursor-help" /></TooltipTrigger><TooltipContent><p>Los costos se registrarán como entradas de inventario automáticamente</p></TooltipContent></Tooltip></TooltipProvider>
                  </div>
                  {syncToInventory && <p className="ml-8 text-xs text-success">✓ Los costos se sincronizarán con el módulo de Bodega</p>}
                  {syncToInventory && hasLowboyDocuments && <p className="ml-8 text-xs text-info">ℹ️ Los documentos LowBoy se sincronizan con su propia bodega (Bodega LowBoy); si asignas un equipo, además se registra el consumo inmediato hacia esa grúa.</p>}
                  <p className="text-xs text-muted-foreground">Activa esta opción solo si además quieres reflejar estos documentos como entradas en inventario.</p>
                  {syncToInventory && <Alert><AlertDescription>Esta sincronización crea una entrada consolidada por factura. Para registrar productos individuales, distintas grúas o consumo parcial, utiliza Importar XML a Bodega.</AlertDescription></Alert>}
                </CardContent>
              </Card>

              {parseResult.documents.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="border-b border-border/60 bg-muted/30 pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <Receipt className="size-5" />
                          Facturas detectadas
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {selectedDocuments.size} de {parseResult.documents.length} seleccionadas · Total ${selectedTotal.toLocaleString('es-CL')}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Button type="button" variant="outline" size="sm" onClick={selectAllDocuments}>
                          Seleccionar todas
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={clearSelectedDocuments}>
                          Deseleccionar todas
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-72 divide-y divide-border/60 overflow-y-auto">
                      {parseResult.documents.map((document, index) => {
                        const documentKey = getDocumentStateKey(document);
                        const isSelected = selectedDocuments.has(documentKey);
                        const supplierName = parseResult.suppliers.find(s => s.rut === document.supplier_rut)?.name || 'Proveedor sin nombre';
                        const duplicateInfo = getDuplicateInfoForDocument(document);
                        const isExactDuplicate = duplicateInfo?.matchType === 'exact' || duplicateInfo?.matchType === 'folio';

                        return (
                          <div
                            key={`${documentKey}-${index}`}
                            className={cn(
                              'flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
                              isSelected ? 'bg-background' : 'bg-muted/30 text-muted-foreground'
                            )}
                          >
                            <Checkbox
                              aria-label={`Seleccionar factura ${document.folio || index + 1}`}
                              className="mt-1"
                              checked={isSelected}
                              onCheckedChange={() => toggleDocumentSelection(documentKey)}
                            />
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left"
                              onClick={() => toggleDocumentSelection(documentKey)}
                            >
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="font-medium text-foreground">Folio {document.folio || 'sin folio'}</span>
                                <span className="text-sm">{supplierName}</span>
                                {isExactDuplicate && <Badge variant="destructive">Ya registrado</Badge>}
                                {duplicateInfo?.matchType === 'similar' && <Badge className="border-warning/30 bg-warning/15 text-warning">Revisar</Badge>}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {document.issue_date && <span>Fecha: {document.issue_date}</span>}
                                <span>Monto: ${document.total_amount.toLocaleString('es-CL')}</span>
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedDocuments.size === 0 && (
                <Alert className="border-warning/30 bg-warning/10">
                  <AlertCircle className="size-4 text-warning" />
                  <AlertDescription className="text-warning">
                    Selecciona al menos una factura para habilitar la carga.
                  </AlertDescription>
                </Alert>
              )}

              {duplicateResults.length > 0 && showDuplicateWarning && (
                <Alert className="border-warning/30 bg-warning/10">
                  <ShieldAlert className="size-4 text-warning" />
                  <AlertDescription className="text-warning">
                    <strong>⚠️ Se detectaron coincidencias que requieren revisión.</strong>
                    <span className="ml-2">
                      {duplicateResults.filter(d => d.matchType === 'exact').length > 0 && <Badge variant="destructive" className="mr-2">{duplicateResults.filter(d => d.matchType === 'exact').length} exactos</Badge>}
                      {duplicateResults.filter(d => d.matchType === 'folio').length > 0 && <Badge className="mr-2 border-warning/30 bg-warning/15 text-warning">{duplicateResults.filter(d => d.matchType === 'folio').length} por folio</Badge>}
                      {duplicateResults.filter(d => d.matchType === 'similar').length > 0 && <Badge className="border-warning/30 bg-warning/15 text-warning">{duplicateResults.filter(d => d.matchType === 'similar').length} similares</Badge>}
                    </span>
                    <Button variant="ghost" size="sm" className="ml-4 text-warning hover:bg-warning/10 hover:text-warning" onClick={() => setShowDuplicateWarning(false)}>Ocultar</Button>
                  </AlertDescription>
                </Alert>
              )}

              {isCheckingDuplicates && <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-3"><Loader2 className="size-4 animate-spin text-info" /><span className="text-sm text-info">Verificando duplicados en la base de datos...</span></div>}
              {isSearchingMatches && <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-3"><Loader2 className="size-4 animate-spin text-info" /><span className="text-sm text-info">Buscando costos existentes que coincidan...</span></div>}
              {Object.keys(matchedCosts).length > 0 && <Alert className="border-info/30 bg-info/10"><Link2 className="size-4 text-info" /><AlertDescription className="text-info"><strong>🔗 {Object.keys(matchedCosts).length} documento(s)</strong> coinciden con costos ya registrados.</AlertDescription></Alert>}

              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
                <div className="space-y-2">
                  {parseResult.errors.length > 0 && <Alert className="border-destructive bg-destructive/10"><AlertCircle className="size-4 text-destructive" /><AlertDescription className="text-destructive"><strong>Errores encontrados:</strong><ul className="mt-2 list-disc list-inside space-y-1">{parseResult.errors.slice(0, 5).map((e, i) => <li key={i} className="text-sm">{e}</li>)}{parseResult.errors.length > 5 && <li className="text-sm">... y {parseResult.errors.length - 5} errores más</li>}</ul></AlertDescription></Alert>}
                  {parseResult.warnings.length > 0 && <Alert className="border-warning/30 bg-warning/10"><AlertCircle className="size-4 text-warning" /><AlertDescription className="text-warning"><strong>Advertencias:</strong><ul className="mt-2 list-disc list-inside space-y-1">{parseResult.warnings.slice(0, 3).map((w, i) => <li key={i} className="text-sm">{w}</li>)}{parseResult.warnings.length > 3 && <li className="text-sm">... y {parseResult.warnings.length - 3} advertencias más</li>}</ul></AlertDescription></Alert>}
                </div>
              )}


              {parseResult.suppliers.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Building className="size-5" />Proveedores Encontrados ({parseResult.suppliers.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.suppliers.map((supplier, index) => (
                        <CostSupplierRow
                          key={index}
                          perProductClassification
                          supplier={supplier}
                          isSelected={selectedSuppliers.has(supplier.rut)}
                          onToggle={() => toggleSupplierSelection(supplier.rut)}
                          paymentCondition={getSupplierCondition(supplier.rut)}
                          creditDate={supplierCreditDate[supplier.rut] || ''}
                          onPaymentConditionChange={val => setSupplierPaymentCondition(prev => ({ ...prev, [supplier.rut]: val as any }))}
                          onCreditDateChange={date => setSupplierCreditDate(prev => ({ ...prev, [supplier.rut]: date }))}
                          categoryId={resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category)}
                          onCategoryChange={val => handleCategoryChange(supplier.rut, val)}
                          activeCategories={activeCategories}
                          paymentTerms={paymentTerms}
                          loadingTerms={loadingTerms}
                          applyCondition={applyConditionToSupplierDocuments}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              </>}
              {step === 2 && <>
              <Alert><AlertDescription>Elige la subcategoría de cada producto y el estado de pago de cada factura. Las condiciones del proveedor solo definen el vencimiento.</AlertDescription></Alert>

              {parseResult.documents.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Receipt className="size-5" />Documentos Encontrados ({parseResult.documents.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.documents.map((document, index) => {
                        const documentKey = getDocumentStateKey(document);
                        const defaultDueDate = getDocumentDueDate(document);
                        const dupInfo = getDuplicateInfoForDocument(document);
                        const isExactDup = dupInfo?.matchType === 'exact' || dupInfo?.matchType === 'folio';
                        const isLowboy = getDocumentEntity(document) === 'lowboy';
                        return (
                          <CostDocumentRow
                            key={index}
                            document={document}
                            documentKey={documentKey}
                            subcategories={costSubcategories.filter(option => option.category_id === resolveCategoryId(supplierCategoryMapping[document.supplier_rut]))}
                            lineSubcategories={lineSubcategories}
                            onLineSubcategoryChange={(index, value) => setLineSubcategories(previous => ({ ...previous, [`${documentKey}:${index}`]: value }))}
                            isLowboy={isLowboy}
                            craneOptions={lowboyCraneOptions}
                            craneId={craneIdByDocument[documentKey] ?? null}
                            onCraneIdChange={craneId => setCraneIdByDocument(prev => ({ ...prev, [documentKey]: craneId }))}
                            paidBy={paidByDocument[documentKey] || 'gruas_5_norte'}
                            onPaidByChange={paidBy => setPaidByDocument(prev => ({ ...prev, [documentKey]: paidBy }))}
                            isSelected={selectedDocuments.has(documentKey)}
                            onToggle={() => toggleDocumentSelection(documentKey)}
                            defaultDueDate={defaultDueDate}
                            duplicateInfo={dupInfo}
                            costsForDoc={matchedCosts[documentKey] || []}
                            currentDecision={linkDecisions[documentKey] || 'new'}
                            onDecisionChange={val => handleLinkDecisionChange(documentKey, val)}
                            showDetails={expandedDocumentDetails[documentKey] ?? !isExactDup}
                            onToggleDetails={() => setExpandedDocumentDetails(prev => ({ ...prev, [documentKey]: !(expandedDocumentDetails[documentKey] ?? !isExactDup) }))}
                            descriptionValue={Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, documentKey) ? documentDescriptionOverrides[documentKey] : buildSuggestedGlosa(document)}
                            onDescriptionChange={val => setDocumentDescriptionOverrides(prev => ({ ...prev, [documentKey]: val }))}
                            historicalSuggestion={historicalGlosaSuggestions[documentKey]}
                            paymentCondition={getSupplierCondition(document.supplier_rut)}
                            creditDate={supplierCreditDate[document.supplier_rut] || ''}
                            onPaymentConditionChange={val => setSupplierPaymentCondition(prev => ({ ...prev, [document.supplier_rut]: val as any }))}
                            onDueDateChange={date => setDueDateOverrides(prev => ({ ...prev, [documentKey]: date }))}
                            isPaid={!!paidOverrides[documentKey]}
                            onPaidChange={checked => setPaidOverrides(prev => ({ ...prev, [documentKey]: checked }))}
                            paidDate={paidDateOverrides[documentKey] || ''}
                            onPaidDateChange={date => setPaidDateOverrides(prev => ({ ...prev, [documentKey]: date }))}
                            paymentTerms={paymentTerms}
                            loadingTerms={loadingTerms}
                            applyCondition={applyConditionToSupplierDocuments}
                            documentAmount={getDocumentAmount(document)}
                            selectedLineSet={getSelectedLineSet(document)}
                            selectedLineCount={getSelectedLineCount(document)}
                            hasSelectedLines={hasSelectedLines(document)}
                            onToggleLine={index => toggleLineSelection(document, index)}
                            onToggleAllLines={selectAll => toggleAllLines(document, selectAll)}
                          />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              </>}
              {step === 3 && <CostXmlImportReview upload={upload} />}
            </div>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t bg-card px-3 py-3 sm:px-6">
          {(step === 1 ? configurationError : reviewError) && parseResult && <p role="status" className="text-sm text-warning">{step === 1 ? configurationError : reviewError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isUploading}>Cancelar</Button>
            <div className="flex gap-2">
              {step > 1 && <Button type="button" variant="outline" disabled={busy} onClick={() => setStep(step - 1)}>Atrás</Button>}
              {step < 3 ? <Button type="button" disabled={busy || !parseResult || !!(step === 1 ? configurationError : reviewError)} onClick={() => setStep(step + 1)}>{step === 1 ? 'Continuar' : 'Revisar carga'}</Button>
                : <Button type="button" onClick={handleUploadCosts} disabled={busy || !!reviewError}>
                  {isUploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Database className="mr-2 size-4" />}Confirmar carga ({uploadableCount})
                </Button>}
            </div>
          </div>
        </div>

        <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
      </DialogContent>
    </Dialog>
  );
};
