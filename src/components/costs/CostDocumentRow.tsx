import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import DatePickerInput from '@/components/common/DatePickerInput';
import { Link2, ChevronDown, ChevronUp, Sparkles, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { applyCurrentDocumentFolioToSuggestion } from '@/utils/xmlGlosaSuggestion';
import { normalizeGlosaText } from '@/utils/xml/xmlGlosaHelpers';
import { XMLDocumentData } from '@/types/suppliers';
import { CostDuplicateResult } from '@/hooks/useDuplicateCheck';
import { HistoricalGlosaSuggestion } from '@/utils/xml/xmlGlosaHelpers';

interface PaymentTerm { id: string; name: string; days: number }

interface CostDocumentRowProps {
  document: XMLDocumentData;
  documentKey: string;
  isSelected: boolean;
  onToggle: () => void;
  defaultDueDate: string;
  duplicateInfo: CostDuplicateResult | undefined;
  costsForDoc: any[];
  currentDecision: string;
  onDecisionChange: (val: string) => void;
  showDetails: boolean;
  onToggleDetails: () => void;
  descriptionValue: string;
  onDescriptionChange: (val: string) => void;
  historicalSuggestion: HistoricalGlosaSuggestion | undefined;
  effectiveGlosa: string;
  paymentCondition: string;
  creditDate: string;
  onPaymentConditionChange: (val: string) => void;
  onDueDateChange: (date: string) => void;
  isPaid: boolean;
  onPaidChange: (checked: boolean) => void;
  paidDate: string;
  onPaidDateChange: (date: string) => void;
  paymentTerms: PaymentTerm[];
  loadingTerms: boolean;
  applyCondition: (rut: string, condition: string, creditDate?: string) => void;
  isLowboy?: boolean;
  craneOptions?: { id: string; label: string }[];
  craneId?: string | null;
  onCraneIdChange?: (craneId: string | null) => void;
  paidBy?: 'gruas_5_norte' | 'lowboy';
  onPaidByChange?: (paidBy: 'gruas_5_norte' | 'lowboy') => void;
}

const autoResize = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
};

export const CostDocumentRow: React.FC<CostDocumentRowProps> = ({
  document, documentKey, isSelected, onToggle, defaultDueDate, duplicateInfo,
  costsForDoc, currentDecision, onDecisionChange, showDetails, onToggleDetails,
  descriptionValue, onDescriptionChange, historicalSuggestion, effectiveGlosa,
  paymentCondition, onPaymentConditionChange, onDueDateChange, isPaid, onPaidChange,
  paidDate, onPaidDateChange, paymentTerms, loadingTerms, applyCondition,
  isLowboy, craneOptions = [], craneId, onCraneIdChange, paidBy = 'gruas_5_norte', onPaidByChange,
}) => {
  const isDuplicate = !!duplicateInfo;
  const isExactDuplicate = duplicateInfo?.matchType === 'exact' || duplicateInfo?.matchType === 'folio';
  const hasMatches = costsForDoc.length > 0;

  const appliedHistoricalDesc = historicalSuggestion ? applyCurrentDocumentFolioToSuggestion(historicalSuggestion.description, document) : '';
  const shouldShowHistoricalSuggestion = !!historicalSuggestion && normalizeGlosaText(appliedHistoricalDesc) !== normalizeGlosaText(descriptionValue);

  const statusMeta = hasMatches && currentDecision !== 'new'
    ? { label: 'Vinculado a costo', badgeClass: 'bg-info/15 text-info', hint: 'Este documento se enlazará con un costo existente.' }
    : isExactDuplicate
      ? { label: 'Ya registrado', badgeClass: 'bg-danger/15 text-danger', hint: 'Ya existe en el sistema.' }
      : isDuplicate && duplicateInfo.matchType === 'similar'
        ? { label: 'Revisar coincidencia', badgeClass: 'bg-warning/15 text-warning', hint: 'Se encontró una coincidencia parecida.' }
        : { label: 'Listo para revisar', badgeClass: 'bg-success/15 text-success', hint: 'Puedes cargarlo o ajustar sus detalles.' };

  return (
    <div className={cn('flex flex-col p-3 rounded-lg gap-2 shadow-sm border transition-opacity',
      hasMatches && currentDecision !== 'new' ? 'bg-info/10 border-info/30'
      : isDuplicate && isExactDuplicate ? 'bg-danger/10 border-danger/30'
      : isDuplicate && duplicateInfo.matchType === 'similar' ? 'bg-warning/10 border-warning/30'
      : 'bg-muted/30 border-border/60',
      !isSelected && 'opacity-60')}>

      {hasMatches && (
        <div className="flex items-center gap-2 rounded bg-info/15 px-2 py-1.5 text-xs text-info">
          <Link2 className="size-3.5 flex-shrink-0" />
          <span className="font-medium">🔗 Costo encontrado:</span>
          <Select value={currentDecision} onValueChange={onDecisionChange}>
            <SelectTrigger className="h-7 text-xs flex-1 min-w-[200px] bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">➕ Crear nuevo gasto</SelectItem>
              {costsForDoc.map((cost: any) => <SelectItem key={cost.id} value={cost.id}>🔗 {cost.description} — ${Number(cost.amount).toLocaleString('es-CL')} — {cost.date}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {isDuplicate && duplicateInfo.existingCost && (
        <div className={cn('text-xs px-2 py-1 rounded', isExactDuplicate ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning')}>
          <strong>{isExactDuplicate ? '⚠️ Ya registrado:' : '🔍 Similar:'}</strong>{' '}
          {duplicateInfo.existingCost.description?.substring(0, 50)} - ${duplicateInfo.existingCost.amount.toLocaleString('es-CL')}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-x-3 flex-1 min-w-0">
          <Checkbox aria-label={`Seleccionar factura ${document.folio}`} checked={isSelected} onCheckedChange={onToggle} />
          <div className="min-w-0 flex-1">
            <p className="text-foreground font-medium break-words whitespace-pre-wrap">{effectiveGlosa}</p>
            <div className="flex items-center gap-x-4 text-sm text-muted-foreground flex-wrap">
              <span>Folio: {document.folio}</span>
              <span>Total: ${document.total_amount.toLocaleString('es-CL')}</span>
              {document.issue_date && <span className="flex items-center gap-1"><Calendar className="size-3" />Emisión: {document.issue_date}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', statusMeta.badgeClass)}>{statusMeta.label}</span>
              <span className="text-xs text-muted-foreground">{statusMeta.hint}</span>
              {isLowboy && <Badge className="bg-primary/15 text-primary border-primary/30">LowBoy Chile SpA</Badge>}
            </div>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs shrink-0" onClick={onToggleDetails}>
          {showDetails ? 'Ocultar detalles' : 'Ver detalles'}
          {showDetails ? <ChevronUp className="ml-1 size-3.5" /> : <ChevronDown className="ml-1 size-3.5" />}
        </Button>
      </div>

      {showDetails ? (
        <div className="space-y-3 border-t pt-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Descripción que se guardará</Label>
            <Textarea value={descriptionValue} onChange={e => onDescriptionChange(e.target.value)} onInput={e => autoResize(e.currentTarget)} ref={el => autoResize(el)} placeholder="Ej: Insumo - Mantención" rows={3} className="text-sm resize-y" />
            <p className="mt-1 text-xs text-muted-foreground">Este texto se usará como descripción del gasto.</p>
            {shouldShowHistoricalSuggestion && historicalSuggestion && (
              <div className="mt-2 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-primary">
                      <Sparkles className="mt-0.5 size-4 flex-shrink-0" />
                      <span className="font-medium">Glosa sugerida por historial</span>
                      <Badge variant="secondary" className="text-[11px]">{historicalSuggestion.matchCount} similar{historicalSuggestion.matchCount > 1 ? 'es' : ''}</Badge>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-foreground">{appliedHistoricalDesc}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Coincidencia estimada: {Math.round(historicalSuggestion.confidence * 100)}%</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => onDescriptionChange(appliedHistoricalDesc)}>Usar sugerencia</Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[180px] max-w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Forma de pago</Label>
              <Select value={paymentCondition} onValueChange={val => { onPaymentConditionChange(val); applyCondition(document.supplier_rut, val === 'credit' ? 'credit' : val); }} disabled={loadingTerms}>
                <SelectTrigger className="w-full"><SelectValue placeholder={loadingTerms ? 'Cargando...' : 'Sin condición'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin condición (manual)</SelectItem>
                  <SelectItem value="credit">Crédito (fecha)</SelectItem>
                  {paymentTerms.map(term => <SelectItem key={term.id} value={term.id}>{term.name} ({term.days} días)</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">Define si el gasto queda con vencimiento o se manejará manualmente.</p>
            </div>
            <div className="flex-1 min-w-[180px] max-w-[220px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Vencimiento</Label>
              <DatePickerInput value={defaultDueDate || ''} onChange={onDueDateChange} className="w-full" />
              <p className="mt-1 text-xs text-muted-foreground">Puedes ajustarlo si el XML no trae una fecha correcta.</p>
            </div>
            <div className="flex-1 min-w-[200px] max-w-[260px]">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Estado de pago</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background">
                <Switch id={`paid-${documentKey}`} checked={isPaid} onCheckedChange={checked => { onPaidChange(checked); if (checked && !paidDate) onPaidDateChange(format(new Date(), 'yyyy-MM-dd')); }} />
                <Label htmlFor={`paid-${documentKey}`} className="text-xs cursor-pointer">Marcar como pagado</Label>
              </div>
              {isPaid && <div className="mt-2"><DatePickerInput value={paidDate || format(new Date(), 'yyyy-MM-dd')} onChange={onPaidDateChange} className="w-full" /></div>}
              <p className="mt-1 text-xs text-muted-foreground">Si ya fue pagado, indica la fecha real del pago.</p>
            </div>
          </div>

          {isLowboy && (
            <div className="flex flex-wrap items-end gap-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex-1 min-w-[180px] max-w-[260px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Equipo LowBoy</Label>
                <Select value={craneId ?? '__none__'} onValueChange={val => onCraneIdChange?.(val === '__none__' ? null : val)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona equipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin equipo asignado</SelectItem>
                    {craneOptions.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {!craneId && <p className="mt-1 text-xs text-warning">⚠️ Sin equipo asignado. El gasto igual quedará registrado como LowBoy.</p>}
              </div>
              <div className="flex-1 min-w-[180px] max-w-[260px]">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Financiado por</Label>
                <Select value={paidBy} onValueChange={val => onPaidByChange?.(val as 'gruas_5_norte' | 'lowboy')}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gruas_5_norte">Grúas 5 Norte</SelectItem>
                    <SelectItem value="lowboy">LowBoy Chile SpA</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Quién puso la plata para este gasto.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/70 px-3 py-2 text-sm text-muted-foreground">Vista resumida. Abre los detalles solo si necesitas editar la descripción o la fecha de vencimiento.</div>
      )}
    </div>
  );
};
