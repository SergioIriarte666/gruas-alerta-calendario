import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useCreditors, useUpdateCreditor } from '@/hooks/useCreditors';
import { useCostCategories } from '@/hooks/useCostCategories';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';
import { Skeleton } from '@/components/ui/skeleton';
import { Pencil } from 'lucide-react';
import { useCreditorTypes } from '@/hooks/useCreditorTypes';

const CREDITOR_TYPES = [
  { value: 'fiscal', label: 'Fiscal' },
  { value: 'bank', label: 'Banco' },
  { value: 'leasing', label: 'Leasing' },
  { value: 'supplier', label: 'Proveedor' },
  { value: 'other', label: 'Otro' },
];

interface EditState {
  id: string;
  name: string;
  type: string;
  notes: string;
  category_id: string;
  subcategory: string;
}

export const CreditorList = () => {
  const { data: creditors = [], isLoading } = useCreditors();
  const { data: categories = [] } = useCostCategories();
  const { data: creditorTypes = [] } = useCreditorTypes();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditState | null>(null);
  const { subcategories = [] } = useCostSubcategories(editing?.category_id && editing.category_id !== 'none' ? editing.category_id : undefined);
  const { mutate: update, isPending: updating } = useUpdateCreditor();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return creditors;
    return creditors.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.type.toLowerCase().includes(q) ||
      (c.notes || '').toLowerCase().includes(q)
    );
  }, [creditors, search]);

  const getCategoryLabel = (c: any) => {
    const catId = (c.metadata as any)?.category_id || null;
    if (!catId) return '-';
    return categories.find(cat => cat.id === catId)?.name || '-';
  };
  const getSubcategoryLabel = (c: any) => {
    const sub = (c.metadata as any)?.subcategory || null;
    return sub || '-';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border border-border">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-6">
          <CardTitle className="text-base font-semibold text-foreground">Acreedores</CardTitle>
          <div className="w-64">
            <Input placeholder="Buscar por nombre, tipo o nota..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Subcategoría</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-[80px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sin resultados</TableCell>
                </TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-foreground font-medium">{c.name}</TableCell>
                  <TableCell className="text-foreground">{CREDITOR_TYPES.find(t => t.value === c.type)?.label || c.type}</TableCell>
                  <TableCell className="text-foreground">{getCategoryLabel(c)}</TableCell>
                  <TableCell className="text-foreground">{getSubcategoryLabel(c)}</TableCell>
                  <TableCell className="text-foreground">{c.notes || '-'}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setEditing({
                      id: c.id,
                      name: c.name,
                      type: c.type,
                      notes: c.notes || '',
                      category_id: ((c.metadata as any)?.category_id as string) || 'none',
                      subcategory: ((c.metadata as any)?.subcategory as string) || 'none',
                    })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar Acreedor</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                  <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                      {creditorTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                      {!creditorTypes.includes(editing.type) && (
                        <SelectItem key={editing.type} value={editing.type}>{editing.type}</SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select value={editing.category_id} onValueChange={(v) => setEditing({ ...editing, category_id: v, subcategory: 'none' })}>
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
                    value={editing.subcategory}
                    onValueChange={(v) => setEditing({ ...editing, subcategory: v })}
                    disabled={editing.category_id === 'none'}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin subcategoría</SelectItem>
                      {subcategories.map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notas</Label>
                <Input value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button
                  onClick={() => {
                    update({
                      id: editing.id,
                      name: editing.name,
                      type: editing.type,
                      notes: editing.notes,
                      category_id: editing.category_id === 'none' ? null : editing.category_id,
                      subcategory: editing.subcategory === 'none' ? null : editing.subcategory,
                    }, {
                      onSuccess: () => setEditing(null),
                    });
                  }}
                  disabled={updating || !editing.name}
                >
                  {updating ? 'Guardando...' : 'Guardar'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
