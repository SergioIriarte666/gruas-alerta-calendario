import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * StatusBadge — Badge semántico para estados.
 * Mapea estados de negocio a tokens de color, garantizando contraste.
 * Centraliza la decisión visual: cambiar la paleta = un solo cambio aquí.
 */
export type StatusTone =
  | "paid"
  | "pending"
  | "overdue"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "draft"
  | "info"
  | "neutral";

const toneClasses: Record<StatusTone, string> = {
  paid: "bg-success-soft text-success-text border-success/30",
  completed: "bg-success-soft text-success-text border-success/30",
  pending: "bg-warning-soft text-warning-text border-warning/35",
  in_progress: "bg-info-soft text-info-text border-info/30",
  overdue: "bg-danger-soft text-danger-text border-danger/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  draft: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info-text border-info/30",
  neutral: "bg-muted text-foreground border-border",
};

export interface StatusBadgeProps {
  tone: StatusTone;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  tone,
  children,
  icon: Icon,
  className,
}) => (
  <Badge
    variant="outline"
    className={cn("gap-1 font-medium border", toneClasses[tone], className)}
  >
    {Icon && <Icon className="size-3" />}
    {children}
  </Badge>
);
