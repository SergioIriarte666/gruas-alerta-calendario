import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceItems } from '@/hooks/services/useServiceItems';
import type { ServiceItemDraft } from '@/types';

const clp = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

interface ServiceItemsTabProps {
  serviceId: string;
  readOnly?: boolean;
}

export function ServiceItemsTab({ serviceId, readOnly = false }: ServiceItemsTabProps) {
  const { items, isLoading, saveItems } = useServiceItems(serviceId);
  const [drafts, setDrafts] = useState<ServiceItemDraft[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isLoading && !isDirty) {
      setDrafts(
        items.map((item) => ({
          id: item.id,
          glosa: item.glosa,
          cantidad: item.cantidad,
          valor_unitario: item.valor_unitario,
        }))
      );
      initializedRef.current = true;
    }
  }, [items, isLoading, isDirty]);

  const updateDraft = (id: string, field: keyof ServiceItemDraft, value: string | number) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: value } : d))
    );
    setIsDirty(true);
  };

  const addRow = () => {
    setDrafts((prev) => [
      ...prev,
      { id: crypto.randomUUID(), glosa: '', cantidad: 1, valor_unitario: 0 },
    ]);
    setIsDirty(true);
  };

  const removeRow = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    setIsDirty(true);
  };

  const handleSave = () => {
    const existingIds = new Set(items.map((i) => i.id));
    const draftIds = new Set(drafts.map((d) => d.id));

    const toDelete = items.filter((i) => !draftIds.has(i.id)).map((i) => i.id);
    const toUpsert = drafts.map((d) => ({
      id: d.id,
      service_id: serviceId,
      glosa: d.glosa,
      cantidad: d.cantidad,
      valor_unitario: d.valor_unitario,
    }));

    saveItems.mutate(
      { serviceId, toUpsert, toDelete },
      {
        onSuccess: () => {
          setIsDirty(false);
        },
      }
    );
  };

  const subtotal = drafts.reduce((sum, d) => sum + d.cantidad * d.valor_unitario, 0);
  const iva = subtotal * 0.19;
  const total = subtotal + iva;

  if (isLoading) {
    return (
      <div className="space-y-2 py-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (drafts.length === 0 && readOnly) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Sin ítems registrados para este servicio.
      </p>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Glosa</th>
              <th className="w-20 px-3 py-2 text-right font-medium text-muted-foreground">Cantidad</th>
              <th className="w-32 px-3 py-2 text-right font-medium text-muted-foreground">Valor unitario</th>
              <th className="w-32 px-3 py-2 text-right font-medium text-muted-foreground">Total neto</th>
              {!readOnly && <th className="w-10 px-2 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {drafts.map((draft) => (
              <tr key={draft.id} className="bg-card">
                <td className="px-3 py-2">
                  <Input
                    value={draft.glosa}
                    disabled={readOnly}
                    placeholder="Descripción del trabajo"
                    className="h-8 min-w-[180px]"
                    onChange={(e) => updateDraft(draft.id, 'glosa', e.target.value)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={draft.cantidad}
                    disabled={readOnly}
                    className="h-8 w-20 text-right"
                    onChange={(e) => updateDraft(draft.id, 'cantidad', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.valor_unitario}
                    disabled={readOnly}
                    className="h-8 w-32 text-right"
                    onChange={(e) => updateDraft(draft.id, 'valor_unitario', parseFloat(e.target.value) || 0)}
                  />
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {clp.format(draft.cantidad * draft.valor_unitario)}
                </td>
                {!readOnly && (
                  <td className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeRow(draft.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={addRow}>
          <Plus className="size-4" />
          Agregar ítem
        </Button>
      )}

      {!readOnly && (
        <div className="rounded-md border border-border bg-muted/20 p-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal neto</span>
            <span className="tabular-nums font-medium">{clp.format(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA 19%</span>
            <span className="tabular-nums font-medium">{clp.format(iva)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 mt-1">
            <span className="font-semibold">Total con IVA</span>
            <span className="tabular-nums font-bold text-primary">{clp.format(total)}</span>
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!isDirty || saveItems.isPending}
            onClick={handleSave}
            className="flex items-center gap-1.5"
          >
            {saveItems.isPending && <Loader2 className="size-4 animate-spin" />}
            Guardar cambios
          </Button>
        </div>
      )}
    </div>
  );
}
