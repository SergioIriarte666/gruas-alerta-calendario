import React from 'react';
import { AlertTriangle, PackageCheck, PackageX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/section-card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ProductStockSummary } from '@/utils/lowStock';

interface LowStockPanelProps {
  items: ProductStockSummary[];
  isLoading?: boolean;
  /** Productos agotados que todavía no tienen mínimo cargado. Sólo se menciona. */
  withoutMinimumCount?: number;
}

/**
 * Panel de productos bajo mínimo, debajo de las tarjetas de Bodega.
 * Sólo pantalla: no dispara WhatsApp, correo ni nada fuera del TMS.
 */
export const LowStockPanel: React.FC<LowStockPanelProps> = ({
  items,
  isLoading = false,
  withoutMinimumCount = 0,
}) => {
  if (isLoading) {
    return (
      <SectionCard flush className="border-border/70 bg-card/80 shadow-sm" contentClassName="space-y-3 p-4 sm:p-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </SectionCard>
    );
  }

  if (items.length === 0) {
    return (
      <SectionCard flush className="border-border/70 bg-card/80 shadow-sm" contentClassName="p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
            <PackageCheck className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Ningún producto bajo su mínimo</p>
            <p className="text-sm text-muted-foreground">
              {withoutMinimumCount > 0
                ? `Se controlan sólo los productos con mínimo definido. Hay ${withoutMinimumCount} producto${withoutMinimumCount === 1 ? '' : 's'} agotado${withoutMinimumCount === 1 ? '' : 's'} sin mínimo cargado: hasta que se le cargue uno, no puede avisar.`
                : 'Se controlan sólo los productos con mínimo definido.'}
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }

  const agotados = items.filter((item) => item.quantity === 0).length;

  return (
    <SectionCard
      flush
      className="border-warning/30 bg-card/80 shadow-sm"
      contentClassName="space-y-3 p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" />
          <h2 className="text-sm font-semibold text-foreground">Productos bajo su mínimo</h2>
          <Badge variant="outline" className="border-warning/30 bg-warning-soft text-warning">
            {items.length}
          </Badge>
        </div>
        {agotados > 0 && (
          <span className="text-xs text-muted-foreground">
            {agotados} de ellos sin ninguna unidad
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((item) => {
          const sinStock = item.quantity === 0;
          return (
            <li
              key={item.itemId}
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3',
                sinStock ? 'border-danger/30 bg-danger/5' : 'border-warning/30 bg-warning-soft',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'rounded-full px-2 py-0 text-xs',
                      sinStock
                        ? 'border-danger/30 bg-danger/10 text-danger'
                        : 'border-warning/30 bg-warning/10 text-warning',
                    )}
                  >
                    {sinStock ? <PackageX className="mr-1 size-3" /> : null}
                    {item.label}
                  </Badge>
                </div>
                {item.locations.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.locations.join(' · ')}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Actual</div>
                  <div className={cn('font-semibold', sinStock ? 'text-danger' : 'text-foreground')}>
                    {item.quantity}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Mínimo</div>
                  <div className="font-semibold text-foreground">{item.minimumStock}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Faltan</div>
                  <div className="font-semibold text-warning">{item.missing}</div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
};
