import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DatePickerInput from '@/components/common/DatePickerInput';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { XMLSupplierData } from '@/types/suppliers';

interface Category { id: string; label: string; name: string }
interface PaymentTerm { id: string; name: string; days: number }

interface CostSupplierRowProps {
  supplier: XMLSupplierData;
  isSelected: boolean;
  onToggle: () => void;
  paymentCondition: string;
  creditDate: string;
  onPaymentConditionChange: (val: string) => void;
  onCreditDateChange: (date: string) => void;
  categoryId: string;
  subcategory: string;
  onCategoryChange: (val: string) => void;
  onSubcategoryChange: (val: string) => void;
  activeCategories: Category[];
  paymentTerms: PaymentTerm[];
  loadingTerms: boolean;
  applyCondition: (rut: string, condition: string, creditDate?: string) => void;
}

const SubcategorySelect: React.FC<{ categoryId: string; value: string; onValueChange: (val: string) => void }> = ({ categoryId, value, onValueChange }) => {
  const { subcategories, isLoading } = useCostSubcategories(categoryId);
  if (isLoading) return <span className="text-xs text-muted-foreground px-2">Cargando...</span>;
  if (subcategories.length === 0) return null;
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-40"><SelectValue placeholder="Subcategoría" /></SelectTrigger>
      <SelectContent>{subcategories.map(sub => <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>)}</SelectContent>
    </Select>
  );
};

export const CostSupplierRow: React.FC<CostSupplierRowProps> = ({
  supplier, isSelected, onToggle, paymentCondition, creditDate,
  onPaymentConditionChange, onCreditDateChange, categoryId, subcategory,
  onCategoryChange, onSubcategoryChange, activeCategories, paymentTerms,
  loadingTerms, applyCondition,
}) => (
  <div className="grid gap-4 rounded-xl border border-border/70 border-l-4 border-l-primary bg-card p-4 shadow-sm xl:grid-cols-[minmax(220px,0.75fr)_minmax(0,2fr)]">
    <div className="flex min-w-0 items-start gap-x-3">
      <Checkbox checked={isSelected} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground font-medium truncate">{supplier.name}</p>
          <Badge variant="outline" className="text-xs">{supplier.rut}</Badge>
        </div>
      </div>
    </div>
    <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Forma de pago por defecto</Label>
        <Select
          value={paymentCondition}
          onValueChange={val => {
            onPaymentConditionChange(val);
            if (val === 'credit') applyCondition(supplier.rut, 'credit', creditDate);
            else applyCondition(supplier.rut, val);
          }}
          disabled={loadingTerms}
        >
          <SelectTrigger className="w-full"><SelectValue placeholder={loadingTerms ? 'Cargando...' : 'Sin condición (manual)'} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin condición (manual)</SelectItem>
            <SelectItem value="credit">Crédito (fecha)</SelectItem>
            {paymentTerms.map(term => <SelectItem key={term.id} value={term.id}>{term.name} ({term.days} días)</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">Se aplicará como sugerencia a los documentos de este proveedor.</p>
      </div>
      {paymentCondition === 'credit' && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Fecha de Crédito</Label>
          <DatePickerInput value={creditDate || ''} onChange={date => { onCreditDateChange(date); applyCondition(supplier.rut, 'credit', date); }} className="w-full" />
        </div>
      )}
      <div>
        <Label className="text-xs text-muted-foreground mb-1.5 block">Categoría del gasto</Label>
        <Select value={categoryId} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>{activeCategories?.map(c => <SelectItem key={c.id} value={c.id}>{getCategoryLabel(activeCategories, c.id)}</SelectItem>)}</SelectContent>
        </Select>
        <p className="mt-1 text-xs text-muted-foreground">Ayuda a clasificar el gasto y sus reportes asociados.</p>
      </div>
      {categoryId && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">Subcategoría</Label>
          <SubcategorySelect categoryId={categoryId} value={subcategory} onValueChange={onSubcategoryChange} />
        </div>
      )}
    </div>
  </div>
);
