import { businessClock } from '@/utils/businessClock';
import React from 'react';
import { useXmlCostUpload } from '@/hooks/xml/useXmlCostUpload';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import { BatchProgressModal } from '@/components/ui/batch-progress-modal';
import { XMLImportDialogHeader, XMLImportProgressCard, XMLImportStatsGrid, XMLImportStepGuide } from '@/components/common/XMLImportShared';
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
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { getDocumentStateKey } from '@/utils/xml/xmlGlosaHelpers';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface XMLCostUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const XMLCostUpload = ({ isOpen, onClose, onSuccess }: XMLCostUploadProps) => {
  const {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive, triggerAnalyze,
    isUploading, uploadProgress,
    isCheckingDuplicates, isSearchingMatches, showDuplicateWarning, setShowDuplicateWarning,
    selectedSuppliers, selectedDocuments, selectedTotal, uploadableCount,
    getSelectedLineSet, getSelectedLineCount, hasSelectedLines, getDocumentAmount, toggleLineSelection, toggleAllLines,
    supplierCategoryMapping, supplierSubcategoryMapping,
    supplierPaymentCondition: _supplierPaymentCondition, setSupplierPaymentCondition,
    supplierCreditDate, setSupplierCreditDate,
    dueDateOverrides, setDueDateOverrides,
    paidOverrides, setPaidOverrides,
    paidDateOverrides, setPaidDateOverrides,
    documentDescriptionOverrides, setDocumentDescriptionOverrides,
    expandedDocumentDetails, setExpandedDocumentDetails,
    historicalGlosaSuggestions,
    duplicateResults, matchedCosts,
    linkDecisions, setLinkDecisions,
    syncToInventory, setSyncToInventory,
    defaultDaysToAdd,
    activeCategories, paymentTerms, loadingTerms, batchProgress,
    getSupplierCondition, getDuplicateInfoForDocument,
    buildSuggestedGlosa, applyConditionToSupplierDocuments, resolveCategoryId,
    handleUploadCosts, reset,
    handleCategoryChange, handleSubcategoryChange,
    toggleSupplierSelection, toggleDocumentSelection, selectAllDocuments, clearSelectedDocuments,
    getDocumentEntity, lowboyCraneOptions, craneIdByDocument, setCraneIdByDocument,
    paidByDocument, setPaidByDocument, hasLowboyDocuments,
  } = useXmlCostUpload({ onSuccess, onClose });

  const handleClose = () => {
    if (isUploading) return;
    reset();
    batchProgress.close();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && handleClose()}>
      <DialogContent className="finance-dialog flex max-h-[96vh] w-[calc(100vw-1rem)] max-w-[100rem] flex-col overflow-hidden border-border/70 bg-card p-0 shadow-2xl sm:w-[min(96vw,100rem)]">
        <XMLImportDialogHeader icon={Code} title="Cargar Gastos desde XML" description="Analiza documentos XML, detecta duplicados y registra gastos con categorización automática." fileName={selectedFile?.name} documentCount={parseResult?.totalDocuments} />

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 px-3 pb-5 pt-4 sm:px-6 sm:pb-6">
          <XMLDropzoneArea selectedFile={selectedFile} parseResult={parseResult} isAnalyzing={isAnalyzing} isDragActive={isDragActive} getRootProps={getRootProps} getInputProps={getInputProps} onAnalyze={triggerAnalyze} onReset={reset} badges={['Detección de duplicados', 'Sync con Bodega', 'Categorización']} />

          {isUploading && uploadProgress > 0 && <XMLImportProgressCard label="Subiendo datos..." value={uploadProgress} />}

          {parseResult && (
            <div className="space-y-6">
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

              <XMLImportStepGuide step={1} title="Revisa proveedor y configuración base" description="Ajusta la forma de pago y la categoría solo si quieres cambiar cómo se registrarán los gastos de este proveedor." />

              {parseResult.suppliers.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Building className="size-5" />Proveedores Encontrados ({parseResult.suppliers.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.suppliers.map((supplier, index) => (
                        <CostSupplierRow
                          key={index}
                          supplier={supplier}
                          isSelected={selectedSuppliers.has(supplier.rut)}
                          onToggle={() => toggleSupplierSelection(supplier.rut)}
                          paymentCondition={getSupplierCondition(supplier.rut)}
                          creditDate={supplierCreditDate[supplier.rut] || ''}
                          onPaymentConditionChange={val => setSupplierPaymentCondition(prev => ({ ...prev, [supplier.rut]: val as any }))}
                          onCreditDateChange={date => setSupplierCreditDate(prev => ({ ...prev, [supplier.rut]: date }))}
                          categoryId={resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category)}
                          subcategory={supplierSubcategoryMapping[supplier.rut] || ''}
                          onCategoryChange={val => handleCategoryChange(supplier.rut, val)}
                          onSubcategoryChange={val => handleSubcategoryChange(supplier.rut, val)}
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

              <XMLImportStepGuide step={2} title="Revisa cada documento" description="Primero valida el estado del documento. Luego, solo si hace falta, abre los detalles para editar la descripción o el vencimiento." />

              {parseResult.documents.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Receipt className="size-5" />Documentos Encontrados ({parseResult.documents.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.documents.map((document, index) => {
                        const documentKey = getDocumentStateKey(document);
                        const defaultDueDate = dueDateOverrides[documentKey] || document.due_date || (() => { const d = safeParseDateOnly(document.issue_date || businessClock.today()); d.setDate(d.getDate() + defaultDaysToAdd); return format(d, 'yyyy-MM-dd'); })();
                        const dupInfo = getDuplicateInfoForDocument(document);
                        const isExactDup = dupInfo?.matchType === 'exact' || dupInfo?.matchType === 'folio';
                        const isLowboy = getDocumentEntity(document) === 'lowboy';
                        return (
                          <CostDocumentRow
                            key={index}
                            document={document}
                            documentKey={documentKey}
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
                            onDecisionChange={val => setLinkDecisions(prev => ({ ...prev, [documentKey]: val }))}
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

              <XMLImportStepGuide step={3} title="Confirma la carga" description="Revisa el resumen antes de confirmar." />

              <div className="sticky bottom-0 z-10 -mx-3 flex flex-col gap-4 border-t border-border/70 bg-card/95 px-3 py-4 shadow-lg backdrop-blur sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="text-sm text-muted-foreground">
                  {uploadableCount > 0 && <div className="space-y-1"><span className="block">{uploadableCount} documento(s) seleccionados</span><span className="block">Total seleccionado: ${selectedTotal.toLocaleString('es-CL')}</span></div>}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button variant="outline" onClick={handleClose} disabled={isUploading}>Cancelar</Button>
                  <Button onClick={handleUploadCosts} disabled={isUploading || uploadableCount === 0}>
                    {isUploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Database className="size-4 mr-2" />}
                    Confirmar carga{uploadableCount > 0 && ` (${uploadableCount})`}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
      </DialogContent>
    </Dialog>
  );
};
