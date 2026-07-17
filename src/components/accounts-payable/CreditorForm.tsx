import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateCreditor } from '@/hooks/useCreditors';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { useCreditorTypes } from '@/hooks/useCreditorTypes';

interface CreditorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const _CREDITOR_TYPES = [
  { value: 'fiscal', label: 'Fiscal (SII, Tesorería)' },
  { value: 'bank', label: 'Banco / Institución Financiera' },
  { value: 'leasing', label: 'Leasing' },
  { value: 'supplier', label: 'Proveedor' },
  { value: 'other', label: 'Otro' },
];

export const CreditorForm = ({ open, onOpenChange }: CreditorFormProps) => {
  const { mutate: create, isPending } = useCreateCreditor();
  const [form, setForm] = useState({ name: '', type: 'other', notes: '', category_id: 'none', subcategory: 'none' });
  const { data: categories = [], isLoading: loadingCategories } = useCostCategories();
  const { subcategories = [] } = useCostSubcategories(form.category_id !== 'none' ? form.category_id : undefined);
  const { data: creditorTypes = [] } = useCreditorTypes();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create({
      name: form.name,
      type: form.type,
      notes: form.notes,
      category_id: form.category_id === 'none' ? null : form.category_id,
      subcategory: form.subcategory === 'none' ? null : form.subcategory,
    }, { onSuccess: () => { onOpenChange(false); setForm({ name: '', type: 'other', notes: '', category_id: 'none', subcategory: 'none' }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="finance-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nuevo Acreedor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: SII, Banco Estado, Leasing Corp..." required />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {creditorTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
                {!creditorTypes.includes(form.type) && (
                  <SelectItem key={form.type} value={form.type}>{form.type}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v, subcategory: 'none' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subcategoría</Label>
              <Select
                value={form.subcategory}
                onValueChange={(v) => setForm({ ...form, subcategory: v })}
                disabled={form.category_id === 'none' || loadingCategories}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin subcategoría</SelectItem>
                  {subcategories
                    .filter((s) => s.category_id === form.category_id)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending || !form.name}>
              {isPending ? 'Creando...' : 'Crear Acreedor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
