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
            <Building2 className="h-4 w-4 text-violet-500" />
            Resumen del Cliente
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
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Razón Social:</span>
            <span className="text-sm font-semibold text-violet-600 dark:text-violet-400 truncate">
              {name}
            </span>
          </div>
        )}

        {/* RUT */}
        {rut && (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">RUT:</span>
            <span className="text-sm font-mono">{rut}</span>
          </div>
        )}

        <Separator className="my-3" />

        {/* Contacto */}
        <div className="space-y-2">
          {contactName && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Contacto:</span>
              <span className="text-sm truncate">{contactName}</span>
            </div>
          )}

          {phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Teléfono:</span>
              <span className="text-sm">{phone}</span>
            </div>
          )}

          {email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Email:</span>
              <span className="text-sm truncate">{email}</span>
            </div>
          )}

          {address && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
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
                <FolderTree className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Departamentos ({validDepartments.length}):
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {validDepartments.map((dept, index) => (
                  <Badge 
                    key={index} 
                    variant="secondary" 
                    className="text-xs bg-violet-500/10 text-violet-700 dark:text-violet-300"
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
          <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-md">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Modo edición - Los cambios actualizarán el cliente existente
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
