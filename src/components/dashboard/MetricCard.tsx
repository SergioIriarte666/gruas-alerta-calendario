
import React from 'react';
import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-emerald-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleCardClick = () => {
    if (linkTo) {
      navigate(linkTo);
    }
  };

  const cardClasses = `metric-card group p-3 sm:p-4 h-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 ${linkTo ? 'cursor-pointer hover:border-tms-green hover:shadow-lg' : ''}`;

  return (
    <Card 
      className={cardClasses}
      onClick={handleCardClick}
      style={{ background: '#ffffff', color: '#000000' }}
    >
      <div className="flex items-start justify-between h-full min-h-0">
        <div className="flex-1 space-y-1 sm:space-y-2 min-w-0 pr-2 sm:pr-3">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide truncate">{title}</p>
          <div className="space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-baseline space-y-1 sm:space-y-0 sm:space-x-2 min-w-0">
              <h3 className="text-lg sm:text-xl xl:text-2xl font-bold text-black leading-tight break-words min-w-0 flex-1">
                {value}
              </h3>
              {change && (
                <span className={`text-xs font-semibold ${getChangeColor()} flex items-center whitespace-nowrap`}>
                  {change}
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{description}</p>
            )}
          </div>
        </div>
        <div className="p-2 sm:p-2.5 bg-tms-green/10 rounded-lg group-hover:bg-tms-green/20 transition-all duration-300 flex-shrink-0">
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-tms-green" />
        </div>
      </div>
    </Card>
  );
};
