import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, User, Phone, Mail, MapPin, Tag, FileText, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupplierSummaryPanelProps {
  name: string;
  rut: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  category: string;
  categoryLabel?: string;
  notes: string;
  isActive: boolean;
  isEditing: boolean;
}

export const SupplierSummaryPanel = ({
  name,
  rut,
  phone,
  email,
  address,
  contactName,
  category,
  categoryLabel,
  notes,
  isActive,
  isEditing,
}: SupplierSummaryPanelProps) => {
  // Extract rating and clean notes
  const ratingMatch = notes?.match(/^Calificación: (?:⭐)+ \((\d)\/5\)/);
  const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;
  const cleanNotes = notes?.replace(/^Calificación: .*\n?/, '').trim();

  return (
    <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Building2 className="size-4 text-violet-500" />
            Resumen del Proveedor
          </span>
          <Badge className={cn(
            isActive 
              ? "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30"
              : "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30"
          )}>
            {isActive ? 'Activo' : 'Inactivo'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Nombre */}
        {name && (
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Nombre:</span>
            <span className="text-sm font-semibold text-violet-600 dark:text-violet-400 truncate">
              {name}
            </span>
          </div>
        )}

        {/* RUT */}
        {rut && (
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">RUT:</span>
            <span className="text-sm font-mono">{rut}</span>
          </div>
        )}

        {/* Categoría */}
        {categoryLabel && (
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Categoría:</span>
            <Badge variant="secondary" className="text-xs bg-violet-500/10 text-violet-700 dark:text-violet-300">
              {categoryLabel}
            </Badge>
          </div>
        )}

        {/* Evaluación / Rating */}
        {rating > 0 && (
          <div className="flex items-center gap-2 mt-2 p-2 bg-yellow-500/5 rounded-md border border-yellow-500/10">
            <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Evaluación:</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star 
                  key={s} 
                  className={cn(
                    "size-3.5", 
                    s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"
                  )} 
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-auto">({rating}/5)</span>
          </div>
        )}

        <Separator className="my-3" />

        {/* Contacto */}
        <div className="space-y-2">
          {contactName && (
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Contacto:</span>
              <span className="text-sm truncate">{contactName}</span>
            </div>
          )}

          {phone && (
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Teléfono:</span>
              <span className="text-sm">{phone}</span>
            </div>
          )}

          {email && (
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Email:</span>
              <span className="text-sm truncate">{email}</span>
            </div>
          )}

          {address && (
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-muted-foreground mt-0.5" />
              <span className="text-xs text-muted-foreground">Dirección:</span>
              <span className="text-sm truncate">{address}</span>
            </div>
          )}
        </div>

        {/* Notas (limpias) */}
        {cleanNotes && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <FileText className="size-4 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-xs text-muted-foreground block">Notas:</span>
                  <span className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{cleanNotes}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Indicador de modo */}
        {isEditing && (
          <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Modo edición - Los cambios actualizarán el proveedor existente
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
