import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, User, Phone, Mail, MapPin, FolderTree, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClientSummaryPanelProps {
  name: string;
  rut: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  departments: string[];
  isActive: boolean;
  isEditing: boolean;
}

export const ClientSummaryPanel = ({
  name,
  rut,
  phone,
  email,
  address,
  contactName,
  departments,
  isActive,
  isEditing,
}: ClientSummaryPanelProps) => {
  const validDepartments = departments.filter(d => d.trim() !== '');

  return (
    <Card className="bg-gradient-to-b from-card to-muted/30 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Resumen del Cliente
          </span>
          <Badge className={cn(
            isActive 
              ? "border-success/30 bg-success-soft text-success"
              : "border-danger/30 bg-danger-soft text-danger"
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
            <span className="text-xs text-muted-foreground">Razón Social:</span>
            <span className="truncate text-sm font-semibold text-primary">
              {name}
            </span>
          </div>
        )}

        {/* RUT */}
        {rut && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">RUT:</span>
            <span className="text-sm font-mono">{rut}</span>
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

        {/* Departamentos */}
        {validDepartments.length > 0 && (
          <>
            <Separator className="my-3" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FolderTree className="size-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Departamentos ({validDepartments.length}):
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {validDepartments.map((dept, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="bg-primary-soft text-xs text-primary"
                  >
                    {dept}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Indicador de modo */}
        {isEditing && (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning-soft p-2">
            <p className="text-xs text-warning">
              Modo edición - Los cambios actualizarán el cliente existente
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
