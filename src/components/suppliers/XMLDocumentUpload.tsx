import React from 'react';
import { useXmlDocumentUpload } from '@/hooks/xml/useXmlDocumentUpload';
import { XMLDropzoneArea } from '@/components/common/XMLDropzoneArea';
import { BatchProgressModal } from '@/components/ui/batch-progress-modal';
import { XMLImportDialogHeader, XMLImportProgressCard, XMLImportStatsGrid } from '@/components/common/XMLImportShared';
import { CostSupplierRow } from '@/components/costs/CostSupplierRow';
import { SupplierImportDocumentRow } from '@/components/suppliers/SupplierImportDocumentRow';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, CheckCircle, Loader2, FileSpreadsheet, Users, Receipt, DollarSign, Building, ShieldAlert, Link2 } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { safeParseDateOnly } from '@/utils/timezoneUtils';
import { getDocumentStateKey } from '@/utils/xml/xmlGlosaHelpers';

interface XMLDocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const XMLDocumentUpload: React.FC<XMLDocumentUploadProps> = ({ isOpen, onClose, onSuccess }) => {
  const {
    selectedFile, parseResult, isAnalyzing, getRootProps, getInputProps, isDragActive, triggerAnalyze,
    isUploading, uploadProgress,
    isCheckingDuplicates, isSearchingMatches, showDuplicateWarning, setShowDuplicateWarning,
    selectedSuppliers, selectedDocuments, selectedTotalAmount,
    createPayments, setCreatePayments,
    supplierCategoryMapping, supplierSubcategoryMapping,
    supplierPaymentCondition, setSupplierPaymentCondition,
    supplierCreditDate, setSupplierCreditDate,
    dueDateOverrides, setDueDateOverrides,
    defaultDaysToAdd,
    paidDateOverrides, setPaidDateOverrides,
    statusOverrides, setStatusOverrides,
    documentDescriptionOverrides, setDocumentDescriptionOverrides,
    expandedDocumentDetails, setExpandedDocumentDetails,
    historicalGlosaSuggestions,
    duplicateResults, matchedCosts,
    linkDecisions,
    expandedSearchKeys, expandingSearchKey,
    activeCategories, paymentTerms, loadingTerms, batchProgress,
    getSupplierCondition, getEffectiveGlosa, getDuplicateInfoForDocument,
    buildSuggestedGlosa, applyConditionToSupplierDocuments, resolveCategoryId,
    getMatchQuality, getCostAgeLabel, handleLinkDecisionChange, expandMatchSearchForDoc,
    handleUploadData, reset,
    handleCategoryChange, handleSubcategoryChange,
    toggleSupplierSelection, toggleDocumentSelection,
  } = useXmlDocumentUpload({ onSuccess, onClose });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[95vh] w-[min(99vw,1600px)] max-w-[1600px] flex-col overflow-hidden border-border/70 bg-card p-0 shadow-2xl">
        <XMLImportDialogHeader icon={FileSpreadsheet} title="Importar Documentos XML"
          description="Analiza documentos XML, detecta duplicados y registra pagos a proveedores."
          fileName={selectedFile?.name} documentCount={parseResult?.totalDocuments} />

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-4">
          <XMLDropzoneArea selectedFile={selectedFile} parseResult={parseResult} isAnalyzing={isAnalyzing}
            isDragActive={isDragActive} getRootProps={getRootProps} getInputProps={getInputProps}
            onAnalyze={triggerAnalyze} onReset={reset}
            badges={['Detección de duplicados', 'Pago automático', 'Categorización']} />

          {isUploading && uploadProgress > 0 && <XMLImportProgressCard label="Subiendo datos..." value={uploadProgress} />}

          {parseResult && (
            <div className="space-y-6">
              <XMLImportStatsGrid items={[
                { title: 'Proveedores', value: `${parseResult.validSuppliers}/${parseResult.totalSuppliers}`, icon: Users, tone: 'neutral' },
                { title: 'Documentos', value: `${parseResult.validDocuments}/${parseResult.totalDocuments}`, icon: Receipt, tone: 'success' },
                { title: 'Errores', value: parseResult.errors.length, icon: AlertCircle, tone: 'danger' },
                { title: 'Total Montos', value: `$${selectedTotalAmount.toLocaleString('es-CL')}`, icon: DollarSign, tone: 'info' },
              ]} />

              <Card className="border bg-card">
                <CardHeader><CardTitle className="text-foreground">Opciones de Importación</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center gap-x-2">
                    <Checkbox id="create-payments" checked={createPayments} onCheckedChange={checked => setCreatePayments(checked === true)} />
                    <label htmlFor="create-payments" className="text-foreground">Crear pagos automáticamente desde los documentos</label>
                  </div>
                </CardContent>
              </Card>

              {duplicateResults.length > 0 && showDuplicateWarning && (
                <Alert className="border-warning/30 bg-warning/10">
                  <ShieldAlert className="size-4 text-warning" />
                  <AlertDescription className="text-warning">
                    <strong>⚠️ Se detectaron coincidencias que requieren revisión.</strong>
                    <span className="ml-2">
                      {duplicateResults.filter(d => d.matchType === 'exact_folio').length > 0 && (
                        <Badge variant="destructive" className="mr-2">{duplicateResults.filter(d => d.matchType === 'exact_folio').length} por folio</Badge>
                      )}
                      {duplicateResults.filter(d => d.matchType === 'similar').length > 0 && (
                        <Badge className="border-warning/30 bg-warning/15 text-warning">{duplicateResults.filter(d => d.matchType === 'similar').length} similares</Badge>
                      )}
                    </span>
                    <span className="ml-2 text-sm">Solo los duplicados por folio se deseleccionan automáticamente. Las coincidencias similares son solo referencia.</span>
                    <Button variant="ghost" size="sm" className="ml-4 text-warning hover:bg-warning/10 hover:text-warning" onClick={() => setShowDuplicateWarning(false)}>Ocultar</Button>
                  </AlertDescription>
                </Alert>
              )}

              {isCheckingDuplicates && <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-3"><Loader2 className="size-4 animate-spin text-info" /><span className="text-sm text-info">Verificando duplicados en la base de datos...</span></div>}
              {isSearchingMatches && <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/10 p-3"><Loader2 className="size-4 animate-spin text-info" /><span className="text-sm text-info">Buscando costos existentes que coincidan...</span></div>}
              {Object.keys(matchedCosts).length > 0 && (
                <Alert className="border-info/30 bg-info/10"><Link2 className="size-4 text-info" /><AlertDescription className="text-info"><strong>🔗 {Object.keys(matchedCosts).length} documento(s)</strong> coinciden con costos ya registrados. Puedes vincular la factura al costo existente o crear un pago nuevo.</AlertDescription></Alert>
              )}

              {(parseResult.errors.length > 0 || parseResult.warnings.length > 0) && (
                <div className="space-y-2">
                  {parseResult.errors.length > 0 && <Alert className="border-destructive bg-destructive/10"><AlertCircle className="size-4 text-destructive" /><AlertDescription className="text-destructive"><strong>Errores encontrados:</strong><ul className="mt-2 list-inside list-disc space-y-1">{parseResult.errors.slice(0, 5).map((e, i) => <li key={i} className="text-sm">{e}</li>)}{parseResult.errors.length > 5 && <li className="text-sm">... y {parseResult.errors.length - 5} errores más</li>}</ul></AlertDescription></Alert>}
                  {parseResult.warnings.length > 0 && <Alert className="border-warning/30 bg-warning/10"><AlertCircle className="size-4 text-warning" /><AlertDescription className="text-warning"><strong>Advertencias:</strong><ul className="mt-2 list-inside list-disc space-y-1">{parseResult.warnings.slice(0, 3).map((w, i) => <li key={i} className="text-sm">{w}</li>)}{parseResult.warnings.length > 3 && <li className="text-sm">... y {parseResult.warnings.length - 3} advertencias más</li>}</ul></AlertDescription></Alert>}
                </div>
              )}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 1</p><p className="mt-1 font-medium text-foreground">Revisa proveedor y configuración base</p><p className="mt-1 text-sm text-muted-foreground">Ajusta la forma de pago y la categoría solo si necesitas cambiar cómo se registrarán los documentos de este proveedor.</p></div>

              {parseResult.suppliers.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Building className="size-5" />Proveedores Encontrados ({parseResult.suppliers.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.suppliers.map((supplier, index) => (
                        <CostSupplierRow key={index} supplier={supplier}
                          isSelected={selectedSuppliers.has(supplier.rut)}
                          onToggle={() => toggleSupplierSelection(supplier.rut)}
                          paymentCondition={getSupplierCondition(supplier.rut)}
                          creditDate={supplierCreditDate[supplier.rut] || ''}
                          onPaymentConditionChange={val => { setSupplierPaymentCondition(prev => ({ ...prev, [supplier.rut]: val as any })); applyConditionToSupplierDocuments(supplier.rut, val === 'credit' ? 'credit' : val, supplierCreditDate[supplier.rut]); }}
                          onCreditDateChange={date => { setSupplierCreditDate(prev => ({ ...prev, [supplier.rut]: date })); applyConditionToSupplierDocuments(supplier.rut, 'credit', date); }}
                          categoryId={resolveCategoryId(supplierCategoryMapping[supplier.rut] || supplier.category)}
                          subcategory={supplierSubcategoryMapping[supplier.rut] || ''}
                          onCategoryChange={val => handleCategoryChange(supplier.rut, val)}
                          onSubcategoryChange={val => handleSubcategoryChange(supplier.rut, val)}
                          activeCategories={activeCategories} paymentTerms={paymentTerms}
                          loadingTerms={loadingTerms} applyCondition={applyConditionToSupplierDocuments} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 2</p><p className="mt-1 font-medium text-foreground">Revisa cada documento</p><p className="mt-1 text-sm text-muted-foreground">Primero valida el estado del documento. Luego, solo si hace falta, abre los detalles para editar la descripción o el vencimiento.</p></div>

              {parseResult.documents.length > 0 && (
                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Receipt className="size-5" />Documentos Encontrados ({parseResult.documents.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {parseResult.documents.map((document, index) => {
                        const documentKey = getDocumentStateKey(document);
                        const defaultDueDate = dueDateOverrides[documentKey] || document.due_date || format(addDays(safeParseDateOnly(document.issue_date || format(new Date(), 'yyyy-MM-dd')), defaultDaysToAdd), 'yyyy-MM-dd');
                        const dupInfo = getDuplicateInfoForDocument(document);
                        const isExactDuplicate = dupInfo?.matchType === 'exact_folio';
                        const showDetails = expandedDocumentDetails[documentKey] ?? !isExactDuplicate;
                        const hasDescriptionOverride = Object.prototype.hasOwnProperty.call(documentDescriptionOverrides, documentKey);
                        const descriptionValue = hasDescriptionOverride ? documentDescriptionOverrides[documentKey] : buildSuggestedGlosa(document);
                        return (
                          <SupplierImportDocumentRow key={index} document={document} documentKey={documentKey}
                            isSelected={selectedDocuments.has(documentKey)}
                            onToggle={() => toggleDocumentSelection(documentKey)}
                            defaultDueDate={defaultDueDate} duplicateInfo={dupInfo}
                            costsForDoc={matchedCosts[documentKey] || []}
                            currentDecision={linkDecisions[documentKey] || 'new'}
                            expandedSearch={expandedSearchKeys.has(documentKey)}
                            isExpandingSearch={expandingSearchKey === documentKey}
                            onExpandSearch={() => expandMatchSearchForDoc(document, 15)}
                            onLinkDecisionChange={handleLinkDecisionChange}
                            showDetails={showDetails}
                            onToggleDetails={() => setExpandedDocumentDetails(prev => ({ ...prev, [documentKey]: !showDetails }))}
                            descriptionValue={descriptionValue}
                            onDescriptionChange={val => setDocumentDescriptionOverrides(prev => ({ ...prev, [documentKey]: val }))}
                            historicalSuggestion={historicalGlosaSuggestions[documentKey]}
                            effectiveGlosa={getEffectiveGlosa(document)}
                            paymentCondition={getSupplierCondition(document.supplier_rut)}
                            onPaymentConditionChange={val => { setSupplierPaymentCondition(prev => ({ ...prev, [document.supplier_rut]: val as any })); applyConditionToSupplierDocuments(document.supplier_rut, val === 'credit' ? 'credit' : val, supplierCreditDate[document.supplier_rut]); }}
                            creditDate={supplierCreditDate[document.supplier_rut] || ''}
                            onDueDateChange={date => setDueDateOverrides(prev => ({ ...prev, [documentKey]: date }))}
                            isPaid={statusOverrides[documentKey] === 'paid'}
                            onPaidChange={checked => { setStatusOverrides(prev => ({ ...prev, [documentKey]: checked ? 'paid' : 'pending' })); if (checked && !paidDateOverrides[documentKey]) setPaidDateOverrides(prev => ({ ...prev, [documentKey]: format(new Date(), 'yyyy-MM-dd') })); }}
                            paidDate={paidDateOverrides[documentKey] || format(new Date(), 'yyyy-MM-dd')}
                            onPaidDateChange={date => setPaidDateOverrides(prev => ({ ...prev, [documentKey]: date }))}
                            paymentTerms={paymentTerms} loadingTerms={loadingTerms}
                            applyCondition={applyConditionToSupplierDocuments}
                            getMatchQuality={getMatchQuality} getCostAgeLabel={getCostAgeLabel} />
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Paso 3</p><p className="mt-1 font-medium text-foreground">Confirma la importación</p><p className="mt-1 text-sm text-muted-foreground">Revisa el resumen y luego confirma. Los documentos ya registrados no necesitan cambios salvo que quieras revisar sus detalles.</p></div>

              <div className="flex items-center justify-between border-t border-border/70 pt-4">
                <div className="text-sm text-muted-foreground">
                  {selectedSuppliers.size > 0 && (
                    <div className="space-y-1">
                      <span className="block">{selectedSuppliers.size} proveedor(es) · {selectedDocuments.size} documento(s)</span>
                      <span className="block">Total seleccionado: ${selectedTotalAmount.toLocaleString('es-CL')}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset} disabled={isUploading}>Cancelar</Button>
                  <Button onClick={handleUploadData} disabled={isUploading || selectedSuppliers.size === 0}>
                    {isUploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <CheckCircle className="mr-2 size-4" />}
                    Confirmar importación{createPayments && selectedDocuments.size > 0 && ` y ${selectedDocuments.size} Pagos`}
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
