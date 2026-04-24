import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PageHeader — Encabezado estándar de página o sección.
 * Patrón heredado del módulo de Costos (project-knowledge).
 *
 * Estructura:
 *   <PageHeader
 *     title="Gestión de Costos"
 *     description="Administra todos los costos operativos"
 *     actions={<Button>Nuevo</Button>}
 *   />
 */
export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Iconos o badges al lado del título */
  badges?: React.ReactNode;
  /** Botones de acción a la derecha */
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  badges,
  actions,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {title}
          </h1>
          {badges}
        </div>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
};