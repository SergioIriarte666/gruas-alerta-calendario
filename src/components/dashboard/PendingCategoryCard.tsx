
import React, { useState } from 'react';
import { LucideIcon, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DetailItem {
  id: string;
  label: string;
  sublabel: string;
  extra?: string;
}

interface PendingCategoryCardProps {
  icon: LucideIcon;
  title: string;
  count: number;
  description: string;
  severity: 'error' | 'warning' | 'success';
  linkTo?: string;
  linkLabel?: string;
  details?: DetailItem[];
  onNavigate?: () => void;
}

export const PendingCategoryCard: React.FC<PendingCategoryCardProps> = ({
  icon: Icon,
  title,
  count,
  description,
  severity,
  linkTo,
  linkLabel = 'Ver detalle',
  details,
  onNavigate,
}) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const severityStyles = {
    error: {
      bg: 'border-danger/30 bg-danger-soft',
      badge: 'border-danger/30 bg-danger/10 text-danger-text',
      icon: 'text-danger',
    },
    warning: {
      bg: 'border-warning/30 bg-warning-soft',
      badge: 'border-warning/30 bg-warning/10 text-warning-text',
      icon: 'text-warning-text',
    },
    success: {
      bg: 'border-success/30 bg-success-soft',
      badge: 'border-success/30 bg-success/10 text-success-text',
      icon: 'text-success',
    },
  };

  const styles = severityStyles[severity];

  const handleNavigate = () => {
    if (linkTo) {
      onNavigate?.();
      navigate(linkTo);
    }
  };

  return (
    <div className={`rounded-lg border p-3 transition-all ${styles.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex-shrink-0 ${styles.icon}`}>
            <Icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground truncate">{title}</span>
              <Badge variant="outline" className={`text-xs font-bold ${styles.badge}`}>
                {count}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {details && details.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          )}
          {linkTo && count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-primary hover:text-primary/80"
              onClick={handleNavigate}
            >
              {linkLabel}
              <ExternalLink className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {expanded && details && details.length > 0 && (
        <ScrollArea className="mt-3 max-h-40">
          <div className="space-y-1.5 pr-3">
            {details.slice(0, 20).map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded bg-card/60 px-2 py-1.5 text-xs">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{item.label}</span>
                  <span className="text-muted-foreground ml-2">{item.sublabel}</span>
                </div>
                {item.extra && (
                  <span className="text-muted-foreground flex-shrink-0 ml-2">{item.extra}</span>
                )}
              </div>
            ))}
            {details.length > 20 && (
              <p className="text-xs text-muted-foreground text-center py-1">
                y {details.length - 20} más...
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
