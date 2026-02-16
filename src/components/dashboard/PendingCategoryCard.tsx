
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
      bg: 'bg-red-50 border-red-200',
      badge: 'bg-red-100 text-red-700 border-red-300',
      icon: 'text-red-600',
    },
    warning: {
      bg: 'bg-amber-50 border-amber-200',
      badge: 'bg-amber-100 text-amber-700 border-amber-300',
      icon: 'text-amber-600',
    },
    success: {
      bg: 'bg-emerald-50 border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      icon: 'text-emerald-600',
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
            <Icon className="w-5 h-5" />
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
              className="h-7 w-7 p-0"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          )}
          {linkTo && count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-violet-600 hover:text-violet-700 gap-1"
              onClick={handleNavigate}
            >
              {linkLabel}
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {expanded && details && details.length > 0 && (
        <ScrollArea className="mt-3 max-h-40">
          <div className="space-y-1.5 pr-3">
            {details.slice(0, 20).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs bg-white/60 rounded px-2 py-1.5">
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
