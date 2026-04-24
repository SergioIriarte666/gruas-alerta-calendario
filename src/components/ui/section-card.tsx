import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * SectionCard — Tarjeta de sección con header tipográfico estandarizado.
 * Útil para envolver bloques de formularios, tablas o listados.
 */
export interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Quita el padding del contenido (útil para tablas que viven al borde) */
  flush?: boolean;
  className?: string;
  contentClassName?: string;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  icon: Icon,
  actions,
  children,
  flush = false,
  className,
  contentClassName,
}) => (
  <Card className={cn("border bg-card", className)}>
    {(title || description || actions) && (
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          {title && (
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              {Icon && <Icon className="h-4 w-4 text-primary" />}
              {title}
            </CardTitle>
          )}
          {description && (
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              {description}
            </CardDescription>
          )}
        </div>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </CardHeader>
    )}
    <CardContent className={cn(flush ? "p-0" : "pt-0", contentClassName)}>
      {children}
    </CardContent>
  </Card>
);