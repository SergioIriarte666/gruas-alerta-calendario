import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * MetricCard — Tarjeta KPI estándar para dashboards y headers.
 * Reemplaza ReportMetricCard, MetricCard de dashboard, PendingCategoryCard.
 *
 * Variantes de acento (icono + barra) usan tokens semánticos:
 * primary | success | warning | danger | info | muted
 */
type Tone = "primary" | "success" | "warning" | "danger" | "info" | "muted";

export interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  trend?: {
    value: number;
    /** "up" en este contexto significa "subió". El color (bueno/malo) viene de `trendIsGood`. */
    direction?: "up" | "down" | "flat";
    /** Si true, "up" es bueno (verde). Si false, "up" es malo (rojo). */
    isPositive?: boolean;
    label?: string;
  };
  className?: string;
}

const toneStyles: Record<Tone, { iconBg: string; iconText: string; valueText?: string }> = {
  primary: { iconBg: "bg-primary/10", iconText: "text-primary", valueText: "text-foreground" },
  success: { iconBg: "bg-success/10", iconText: "text-success", valueText: "text-success" },
  warning: { iconBg: "bg-warning/10", iconText: "text-warning", valueText: "text-foreground" },
  danger: { iconBg: "bg-danger/10", iconText: "text-danger", valueText: "text-danger" },
  info: { iconBg: "bg-info/10", iconText: "text-info", valueText: "text-foreground" },
  muted: { iconBg: "bg-muted", iconText: "text-muted-foreground", valueText: "text-foreground" },
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  description,
  icon: Icon,
  tone = "primary",
  trend,
  className,
}) => {
  const t = toneStyles[tone];
  const trendIcon =
    trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : Minus;
  const TrendIcon = trendIcon;
  const trendIsGood = trend?.isPositive ?? (trend?.direction === "up");
  const trendColor = trend
    ? trendIsGood
      ? "text-success"
      : trend.direction === "flat"
        ? "text-muted-foreground"
        : "text-danger"
    : "";

  return (
    <Card className={cn("border bg-card overflow-hidden", className)}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <div className={cn("mt-1 text-2xl font-bold truncate", t.valueText)}>
              {value}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {description}
              </p>
            )}
            {trend && (
              <div className={cn("mt-1 flex items-center gap-1 text-xs", trendColor)}>
                <TrendIcon className="size-3" />
                <span>{Math.abs(trend.value).toFixed(1)}%</span>
                {trend.label && <span className="text-muted-foreground">{trend.label}</span>}
              </div>
            )}
          </div>
          {Icon && (
            <div className={cn("rounded-lg p-2 shrink-0", t.iconBg)}>
              <Icon className={cn("size-5", t.iconText)} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};