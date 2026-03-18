import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColoredSectionCard } from '@/components/services/form/ColoredSectionCard';
import { Tag, FileText, Power, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCostSubcategories } from '@/hooks/useCostSubcategories';

interface Category {
  id: string;
  label: string;
}

interface SupplierFormStep3Props {
  category: string;
  subcategory: string;
  notes: string;
  isActive: boolean;
  categories: Category[];
  categoriesLoading: boolean;
  onCategoryChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onIsActiveChange: (value: boolean) => void;
  errors: {
    category?: string;
  };
}

const EVALUATION_TAGS = [
  { label: "Puntual", color: "bg-green-100 text-green-800 border-green-200" },
  { label: "Económico", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { label: "Calidad Alta", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { label: "Respuesta Rápida", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { label: "Retrasos", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { label: "Caro", color: "bg-red-100 text-red-800 border-red-200" },
  { label: "Mala Comunicación", color: "bg-gray-100 text-gray-800 border-gray-200" },
];

export const SupplierFormStep3 = ({ 
  category, 
  subcategory,
  notes, 
  isActive,
  categories,
  categoriesLoading,
  onCategoryChange,
  onSubcategoryChange,
  onNotesChange,
  onIsActiveChange,
  errors 
}: SupplierFormStep3Props) => {

  const { subcategories, isLoading: subcategoriesLoading } = useCostSubcategories(category || undefined);

  const validCategoryIds = categories.map((cat) => cat.id);
  const validSubcategoryNames = subcategories.map((sub) => sub.name);
  const safeCategoryValue = validCategoryIds.includes(category) ? category : undefined;
  const safeSubcategoryValue = validSubcategoryNames.includes(subcategory) ? subcategory : undefined;

  const handleCategoryChange = (value: string) => {
    if (!value || value === 'loading') return;
    onCategoryChange(value);
    onSubcategoryChange(''); // Reset subcategory when category changes
  };

  const handleRatingClick = (rating: number) => {
    const ratingLineRegex = /^Calificación: .*\n?/;
    const stars = "⭐".repeat(rating);
    const newRatingLine = `Calificación: ${stars} (${rating}/5)\n`;
    
    let newNotes = notes;
    if (ratingLineRegex.test(notes)) {
      newNotes = notes.replace(ratingLineRegex, newRatingLine);
    } else {
      newNotes = newRatingLine + (notes ? "\n" + notes : "");
    }
    onNotesChange(newNotes);
  };

  const handleTagClick = (tagLabel: string) => {
    if (notes.includes(tagLabel)) return;
    const separator = notes && !notes.endsWith('\n') ? '\n' : '';
    onNotesChange(`${notes}${separator}- ${tagLabel}`);
  };

  const currentRatingMatch = notes.match(/^Calificación: (?:⭐)+ \((\d)\/5\)/);
  const currentRating = currentRatingMatch ? parseInt(currentRatingMatch[1]) : 0;

  return (
    <div className="space-y-4">
      <ColoredSectionCard
        title="Categoría"
        icon={<Tag className="h-5 w-5" />}
        color="orange"
        required
        hasError={!!errors.category}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-foreground">Categoría *</Label>
            <Select
              value={safeCategoryValue}
              onValueChange={handleCategoryChange}
              disabled={categoriesLoading || categories.length === 0}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={categoriesLoading ? 'Cargando categorías...' : 'Seleccionar categoría'} />
              </SelectTrigger>
              <SelectContent>
                {categoriesLoading ? (
                  <SelectItem value="loading" disabled>Cargando categorías...</SelectItem>
                ) : categories.length === 0 ? (
                  <SelectItem value="no-categories" disabled>Sin categorías disponibles</SelectItem>
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

          {/* Subcategoría - solo visible si hay subcategorías disponibles */}
          {category && subcategories.length > 0 && (
            <div className="space-y-2">
              <Label className="text-foreground">Subcategoría</Label>
              <Select
                value={safeSubcategoryValue}
                onValueChange={(value) => {
                  if (!value || value === 'loading') return;
                  onSubcategoryChange(value);
                }}
                disabled={subcategoriesLoading || subcategories.length === 0}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={subcategoriesLoading ? 'Cargando...' : 'Seleccionar subcategoría'} />
                </SelectTrigger>
                <SelectContent>
                  {subcategoriesLoading ? (
                    <SelectItem value="loading" disabled>Cargando...</SelectItem>
                  ) : (
                    subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.name}>
                        {sub.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </ColoredSectionCard>

      <ColoredSectionCard
        title="Evaluación y Notas"
        icon={<FileText className="h-5 w-5" />}
        color="blue"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-foreground">Calificación General</Label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRatingClick(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star 
                    className={cn(
                      "h-6 w-6 transition-colors", 
                      star <= currentRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                    )} 
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {currentRating > 0 ? `${currentRating}/5` : 'Sin calificar'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Etiquetas Rápidas</Label>
            <div className="flex flex-wrap gap-2">
              {EVALUATION_TAGS.map((tag) => (
                <Badge
                  key={tag.label}
                  variant="outline"
                  className={cn(
                    "cursor-pointer hover:opacity-80 transition-opacity", 
                    tag.color
                  )}
                  onClick={() => handleTagClick(tag.label)}
                >
                  {tag.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Notas Detalladas</Label>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Ingrese información adicional, evaluación del proveedor, desempeño, incidencias, etc..."
              rows={5}
              className="bg-background resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Utilice este espacio para registrar evaluaciones periódicas, comentarios sobre el servicio o productos entregados.
            </p>
          </div>
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
