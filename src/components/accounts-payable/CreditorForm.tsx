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

interface CreditorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CREDITOR_TYPES = [
  { value: 'fiscal', label: 'Fiscal (SII, Tesorería)' },
  { value: 'bank', label: 'Banco / Institución Financiera' },
  { value: 'leasing', label: 'Leasing' },
  { value: 'supplier', label: 'Proveedor' },
  { value: 'other', label: 'Otro' },
];

export const CreditorForm = ({ open, onOpenChange }: CreditorFormProps) => {
  const { mutate: create, isPending } = useCreateCreditor();
  const [form, setForm] = useState({ name: '', type: 'other', notes: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    create(form, { onSuccess: () => { onOpenChange(false); setForm({ name: '', type: 'other', notes: '' }); } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
                {CREDITOR_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
