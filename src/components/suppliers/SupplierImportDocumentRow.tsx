import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Link2, ChevronDown, ChevronUp, Sparkles, Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { applyCurrentDocumentFolioToSuggestion } from '@/utils/xmlGlosaSuggestion';
import { normalizeGlosaText, HistoricalGlosaSuggestion } from '@/utils/xml/xmlGlosaHelpers';
import { XMLDocumentData } from '@/types/suppliers';
import { SupplierInvoiceDuplicateResult } from '@/hooks/useDuplicateCheck';

interface MatchedCost {
  id: string;
  description: string;
  amount: number;
  date: string;
  payment_date: string | null;
  supplier_name: string;
  supplier_payment_id: string | null;
  has_invoice: boolean;
}

interface PaymentTerm { id: string; name: string; days: number }

interface SupplierImportDocumentRowProps {
  document: XMLDocumentData;
  documentKey: string;
  isSelected: boolean;
  onToggle: () => void;
  defaultDueDate: string;
  duplicateInfo: SupplierInvoiceDuplicateResult | undefined;
  costsForDoc: MatchedCost[];
  currentDecision: string;
  expandedSearch: boolean;
  isExpandingSearch: boolean;
  onExpandSearch: () => void;
  onLinkDecisionChange: (documentKey: string, val: string, doc: XMLDocumentData) => void;
  showDetails: boolean;
  onToggleDetails: () => void;
  descriptionValue: string;
  onDescriptionChange: (val: string) => void;
  historicalSuggestion: HistoricalGlosaSuggestion | undefined;
  effectiveGlosa: string;
  paymentCondition: string;
  onPaymentConditionChange: (val: string) => void;
  creditDate: string;
  onDueDateChange: (date: string) => void;
  isPaid: boolean;
  onPaidChange: (checked: boolean) => void;
  paidDate: string;
  onPaidDateChange: (date: string) => void;
  paymentTerms: PaymentTerm[];
  loadingTerms: boolean;
  applyCondition: (rut: string, condition: string, creditDate?: string) => void;
  getMatchQuality: (cost: MatchedCost, doc: XMLDocumentData) => { label: string; tone: 'exact' | 'similar' | 'possible' };
  getCostAgeLabel: (cost: MatchedCost, doc: XMLDocumentData) => string;
}

const autoResize = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

export const SupplierImportDocumentRow: React.FC<SupplierImportDocumentRowProps> = ({
  document, documentKey, isSelected, onToggle, defaultDueDate, duplicateInfo,
  costsForDoc, currentDecision, expandedSearch, isExpandingSearch, onExpandSearch,
  onLinkDecisionChange, showDetails, onToggleDetails, descriptionValue, onDescriptionChange,
  historicalSuggestion, effectiveGlosa, paymentCondition, onPaymentConditionChange, creditDate,
  onDueDateChange, isPaid, onPaidChange, paidDate, onPaidDateChange,
  paymentTerms, loadingTerms, applyCondition, getMatchQuality, getCostAgeLabel,
}) => {
  const isDuplicate = !!duplicateInfo;
  const isExactDuplicate = duplicateInfo?.matchType === 'exact_folio';
  const hasMatches = costsForDoc.length > 0;

  const appliedHistoricalDesc = historicalSuggestion
    ? applyCurrentDocumentFolioToSuggestion(historicalSuggestion.description, document)
    : '';
  const shouldShowHistoricalSuggestion =
    !!historicalSuggestion && normalizeGlosaText(appliedHistoricalDesc) !== normalizeGlosaText(descriptionValue);

  const statusMeta = hasMatches && currentDecision !== 'new'
    ? { label: 'Vinculado a costo', badgeClass: 'bg-info/15 text-info', hint: 'Este documento se enlazará con un costo existente.' }
    : isExactDuplicate
      ? { label: 'Ya registrado', badgeClass: 'bg-danger/15 text-danger', hint: 'Ya existe en el sistema. Normalmente no necesitas cambiar nada.' }
      : isDuplicate && duplicateInfo.matchType === 'similar'
        ? { label: 'Revisar coincidencia', badgeClass: 'bg-warning/15 text-warning', hint: 'Se encontró una coincidencia parecida. Conviene revisarlo antes de importar.' }
        : { label: 'Listo para revisar', badgeClass: 'bg-success/15 text-success', hint: 'Puedes importarlo o ajustar sus detalles si lo necesitas.' };

  return (
    <div className={cn(
      'flex flex-col gap-3 rounded-lg border p-3 shadow-sm transition-opacity',
      hasMatches && currentDecision !== 'new' ? 'border-info/30 bg-info/10'
        : isExactDuplicate ? 'border-danger/30 bg-danger/10'
        : isDuplicate && duplicateInfo.matchType === 'similar' ? 'border-warning/30 bg-warning/10'
        : 'border-border/60 bg-muted/30',
      !isSelected && 'opacity-60'
    )}>
      {hasMatches ? (
        <div className="rounded-md border border-info/30 bg-info/10 p-2.5 text-xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-medium text-info">
              <Link2 className="size-3.5" />
              Se encontraron {costsForDoc.length} costo{costsForDoc.length > 1 ? 's' : ''} de este proveedor
            </div>
            {!expandedSearch && (
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs text-info hover:bg-info/20"
                disabled={isExpandingSearch} onClick={onExpandSearch}>
                {isExpandingSearch && <Loader2 className="mr-1 size-3 animate-spin" />}
                Ampliar ±15 días
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            {costsForDoc.map(cost => {
              const quality = getMatchQuality(cost, document);
              const ageLabel = getCostAgeLabel(cost, document);
              const isSelected = currentDecision === cost.id;
              const toneClass = quality.tone === 'exact'
                ? 'border-primary/40 bg-primary/10 text-primary'
                : quality.tone === 'similar'
                  ? 'border-warning/40 bg-warning/10 text-warning'
                  : 'border-border bg-muted text-muted-foreground';
              return (
                <label key={cost.id} className={cn(
                  'flex cursor-pointer items-start gap-2 rounded border bg-background p-2 transition-colors',
                  isSelected ? 'border-primary ring-1 ring-primary/30' : 'border-border/60 hover:border-border'
                )}>
                  <input type="radio" name={`link-decision-${documentKey}`} checked={isSelected}
                    onChange={() => onLinkDecisionChange(documentKey, cost.id, document)} className="mt-0.5 accent-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground">${Number(cost.amount).toLocaleString('es-CL')}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{cost.date}</span>
                      <span className="text-muted-foreground">({ageLabel})</span>
                      <Badge variant="outline" className={cn('h-5 border px-1.5 text-xs', toneClass)}>{quality.label}</Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">{cost.description || 'Sin descripción'}</p>
                  </div>
                </label>
              );
            })}
            <label className={cn(
              'flex cursor-pointer items-center gap-2 rounded border bg-background p-2 transition-colors',
              currentDecision === 'new' ? 'border-primary ring-1 ring-primary/30' : 'border-border/60 hover:border-border'
            )}>
              <input type="radio" name={`link-decision-${documentKey}`} checked={currentDecision === 'new'}
                onChange={() => onLinkDecisionChange(documentKey, 'new', document)} className="accent-primary" />
              <span className="text-foreground">➕ Crear costo nuevo (no vincular)</span>
            </label>
          </div>
        </div>
      ) : (
        !isDuplicate && document.supplier_rut && document.total_amount ? (
          <div className="flex items-center justify-between gap-2 rounded border border-dashed border-border/70 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
            <span>Sin costos coincidentes en ±7 días</span>
            {!expandedSearch && (
              <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs"
                disabled={isExpandingSearch} onClick={onExpandSearch}>
                {isExpandingSearch && <Loader2 className="mr-1 size-3 animate-spin" />}
                Buscar en ±15 días
              </Button>
            )}
          </div>
        ) : null
      )}

      {isDuplicate && duplicateInfo.existingPayment && (
        <div className={cn('rounded px-2 py-1 text-xs', isExactDuplicate ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning')}>
          <strong>{isExactDuplicate ? '⚠️ Folio ya registrado:' : '🔍 Similar:'}</strong>{' '}
          {duplicateInfo.existingPayment.supplier_name} - ${duplicateInfo.existingPayment.amount.toLocaleString('es-CL')}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-x-3">
          <Checkbox aria-label={`Seleccionar factura ${document.folio}`} checked={isSelected} onCheckedChange={onToggle} />
          <div className="min-w-0 flex-1">
            <p className="break-words whitespace-pre-wrap font-medium text-foreground">{effectiveGlosa}</p>
            <div className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
              <span>Folio: {document.folio}</span>
              <span>Total: ${document.total_amount.toLocaleString('es-CL')}</span>
              {document.issue_date && <span className="flex items-center gap-1"><Calendar className="size-3" />Emisión: {document.issue_date}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusMeta.badgeClass)}>{statusMeta.label}</span>
              <span className="text-xs text-muted-foreground">{statusMeta.hint}</span>
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2 text-xs" onClick={onToggleDetails}>
          {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
          {showDetails ? <ChevronUp className="ml-1 size-3.5" /> : <ChevronDown className="ml-1 size-3.5" />}
        </Button>
      </div>

      {showDetails ? (
        <div className="space-y-3 border-t pt-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Descripción que se guardará</Label>
            <Textarea value={descriptionValue} onChange={e => onDescriptionChange(e.target.value)}
              onInput={e => autoResize(e.currentTarget)} ref={el => autoResize(el)} rows={3} className="resize-y text-sm" />
            <p className="mt-1 text-xs text-muted-foreground">Este texto se usará como descripción del pago o del vínculo con costos.</p>
            {shouldShowHistoricalSuggestion && historicalSuggestion && (
              <div className="mt-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="mt-0.5 size-4 flex-shrink-0" />
                      <span className="font-medium">Glosa sugerida por historial</span>
                      <Badge variant="secondary" className="text-xs">
                        {historicalSuggestion.matchCount} similar{historicalSuggestion.matchCount > 1 ? 'es' : ''}
                      </Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{appliedHistoricalDesc}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Coincidencia estimada: {Math.round(historicalSuggestion.confidence * 100)}%</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onDescriptionChange(appliedHistoricalDesc)}>
                    Usar sugerencia
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-44 max-w-56 flex-1">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Forma de pago</Label>
              <Select value={paymentCondition} disabled={loadingTerms}
                onValueChange={val => { onPaymentConditionChange(val); applyCondition(document.supplier_rut, val === 'credit' ? 'credit' : val, creditDate); }}>
                <SelectTrigger className="w-full"><SelectValue placeholder={loadingTerms ? 'Cargando...' : 'Sin condición (manual)'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin condición (manual)</SelectItem>
                  <SelectItem value="credit">Crédito (fecha)</SelectItem>
                  {paymentTerms.map(term => <SelectItem key={term.id} value={term.id}>{term.name} ({term.days} días)</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Define si el documento queda pagado manualmente o con vencimiento.</p>
            </div>
            <div className="min-w-44 max-w-56 flex-1">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Vencimiento</Label>
              <DatePickerInput value={defaultDueDate || ''} onChange={onDueDateChange} className="w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Puedes ajustarlo si el XML no trae una fecha correcta.</p>
            </div>
            <div className="min-w-48 max-w-64 flex-1">
              <Label className="mb-1.5 block text-xs text-muted-foreground">Estado de pago</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
                <Switch id={`sup-paid-${documentKey}`} checked={isPaid} onCheckedChange={onPaidChange} />
                <Label htmlFor={`sup-paid-${documentKey}`} className="cursor-pointer text-xs">Marcar como pagado</Label>
              </div>
              {isPaid && <div className="mt-2"><DatePickerInput value={paidDate} onChange={onPaidDateChange} className="w-full" /></div>}
              <p className="mt-1 text-xs text-muted-foreground">Si el documento ya fue pagado, indica la fecha real del pago.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/70 px-3 py-2 text-sm text-muted-foreground">
          Vista resumida. Abre los detalles solo si necesitas editar la descripción o la fecha de vencimiento.
        </div>
      )}
    </div>
  );
};
