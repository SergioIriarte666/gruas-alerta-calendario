import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type ComplianceLevel = 'ok' | 'warning' | 'error';

interface ComplianceBadgeProps {
  level: ComplianceLevel;
  compact?: boolean;
  tooltip?: string;
}

const badgeConfig: Record<ComplianceLevel, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  ok: { label: 'Apto', variant: 'success' },
  warning: { label: 'Con observaciones', variant: 'warning' },
  error: { label: 'No apto', variant: 'destructive' },
};

export const ComplianceBadge = ({ level, compact = false, tooltip }: ComplianceBadgeProps) => {
  const config = badgeConfig[level];
  const badge = (
    <Badge
      variant={config.variant}
      className={compact ? 'px-2 py-0 text-[11px] leading-5' : undefined}
    >
      {compact && level === 'warning' ? 'Observado' : config.label}
    </Badge>
  );

  if (!tooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{badge}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
