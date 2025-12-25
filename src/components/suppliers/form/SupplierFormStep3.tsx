import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Tag, FileText, Power } from 'lucide-react';

interface Category {
  id: string;
  label: string;
}

interface SupplierFormStep3Props {
  category: string;
  notes: string;
  isActive: boolean;
  categories: Category[];
  categoriesLoading: boolean;
  onCategoryChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onIsActiveChange: (value: boolean) => void;
  errors: {
    category?: string;
  };
}

export const SupplierFormStep3 = ({ 
  category, 
  notes, 
  isActive,
  categories,
  categoriesLoading,
  onCategoryChange,
  onNotesChange,
  onIsActiveChange,
  errors 
}: SupplierFormStep3Props) => {
  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Categoría"
        icon={<Tag className="h-5 w-5" />}
        color="orange"
        required
        hasError={!!errors.category}
      >
        <div className="space-y-2">
          <Label className="text-foreground">Categoría *</Label>
          <Select
            value={category}
            onValueChange={onCategoryChange}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent>
              {categoriesLoading ? (
                <SelectItem value="loading" disabled>Cargando categorías...</SelectItem>
              ) : (
                categories.map((cat) => (
                  <SelectItem 
                    key={cat.id} 
                    value={cat.id}
                  >
                    {cat.label}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-destructive text-sm">{errors.category}</p>
          )}
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Notas Adicionales"
        icon={<FileText className="h-5 w-5" />}
        color="blue"
      >
        <div className="space-y-2">
          <Label className="text-foreground">Notas</Label>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Información adicional sobre el proveedor..."
            rows={3}
            className="bg-background resize-none"
          />
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Estado del Proveedor"
        icon={<Power className="h-5 w-5" />}
        color="green"
      >
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <Label htmlFor="isActive" className="text-foreground font-medium">
              Proveedor Activo
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Los proveedores inactivos no aparecerán en las listas de selección
            </p>
          </div>
          <Switch
            id="isActive"
            checked={isActive}
            onCheckedChange={onIsActiveChange}
          />
        </div>
      </ColoredSectionCard>
    </div>
  );
};
