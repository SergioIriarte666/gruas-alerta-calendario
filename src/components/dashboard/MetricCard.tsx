
import React from 'react';
import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDeviceType } from '@/hooks/useDeviceType';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  description?: string;
  linkTo?: string;
}

export const MetricCard = ({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', 
  icon: Icon,
  description,
  linkTo
}: MetricCardProps) => {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useDeviceType();

  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-emerald-600';
      case 'negative':
        return 'text-destructive';
      default:
        return 'text-muted-foreground';
    }
  };

  const handleCardClick = () => {
    if (linkTo) {
      navigate(linkTo);
    }
  };

  const cardClasses = cn(
    "metric-card group h-full bg-gradient-card border tms-border",
    isMobile ? "p-3" : isTablet ? "p-4" : "p-6",
    linkTo ? 'cursor-pointer hover:border-primary hover:tms-glow transition-all' : ''
  );

  return (
    <Card 
      className={cardClasses}
      onClick={handleCardClick}
    >
      <div className={cn(
        "flex items-start justify-between",
        isMobile ? "space-x-2" : "space-x-3"
      )}>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium text-muted-foreground truncate mb-1",
            isMobile ? "text-xs" : "text-sm"
          )}>{title}</p>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className={cn(
              "font-bold text-foreground",
              isMobile ? "text-base" : isTablet ? "text-lg" : "text-xl lg:text-2xl"
            )}>{value}</h3>
            {change && (
              <span className={cn(
                "font-semibold",
                isMobile ? "text-xs" : "text-xs",
                getChangeColor()
              )}>
                {change}
              </span>
            )}
          </div>
          {description && (
            <p className={cn(
              "text-muted-foreground mt-2 line-clamp-2",
              isMobile ? "text-xs" : "text-xs"
            )}>{description}</p>
          )}
        </div>
        <div className={cn(
          "flex-shrink-0 bg-primary/30 rounded-lg",
          isMobile ? "p-1.5" : isTablet ? "p-2" : "p-3"
        )}>
          <Icon className={cn(
            "text-foreground",
            isMobile ? "w-4 h-4" : isTablet ? "w-5 h-5" : "w-6 h-6"
          )} strokeWidth={2.25} />
        </div>
      </div>
    </Card>
  );
};
