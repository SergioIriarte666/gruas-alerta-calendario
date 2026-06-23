import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, MapPin, User, Calendar, FileText } from 'lucide-react';
import { SupplierWithStats } from '@/types/suppliers';
import { useSupplierCategories } from '@/hooks/useSupplierCategories';
import { getCategoryLabel } from '@/utils/categoryUtils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SupplierGeneralTabProps {
  supplier: SupplierWithStats;
}

const InfoItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Icon className="size-5 text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-foreground font-medium">{value}</p>
      </div>
    </div>
  );
};

export const SupplierGeneralTab: React.FC<SupplierGeneralTabProps> = ({ supplier }) => {
  const { data: supplierCategoriesData = [] } = useSupplierCategories();
  const activeCategories = supplierCategoriesData.filter(c => c.is_active).map(c => ({ id: c.id, name: c.label || c.name }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Información Principal */}
      <Card className="bg-card border">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            Información del Proveedor
          </h3>
          
          <div className="space-y-1">
            <InfoItem icon={Building2} label="Razón Social" value={supplier.name} />
            <InfoItem icon={FileText} label="RUT" value={supplier.rut} />
            <InfoItem icon={User} label="Contacto" value={supplier.contact_name} />
            <InfoItem icon={Mail} label="Email" value={supplier.email} />
            <InfoItem icon={Phone} label="Teléfono" value={supplier.phone} />
            <InfoItem icon={MapPin} label="Dirección" value={supplier.address} />
          </div>
        </CardContent>
      </Card>

      {/* Estado y Categoría */}
      <Card className="bg-card border">
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            Estado y Clasificación
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="text-muted-foreground">Estado</span>
              <Badge 
                variant={supplier.is_active ? "default" : "secondary"}
                className={supplier.is_active ? "bg-success text-success-foreground hover:bg-success/90" : ""}
              >
                {supplier.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="text-muted-foreground">Categoría</span>
              <Badge variant="outline">
                {getCategoryLabel(activeCategories || [], supplier.category)}
              </Badge>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-border">
              <span className="text-muted-foreground">Fecha de Registro</span>
              <span className="text-foreground">
                {supplier.created_at 
                  ? format(new Date(supplier.created_at), "d 'de' MMMM, yyyy", { locale: es })
                  : '-'
                }
              </span>
            </div>
          </div>

          {supplier.notes && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Notas</h4>
              <p className="text-foreground bg-muted/50 p-3 rounded-md text-sm">
                {supplier.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
