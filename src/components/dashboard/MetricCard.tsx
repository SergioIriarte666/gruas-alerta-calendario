
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

  const cardClasses = `metric-card group p-4 sm:p-6 h-full bg-white border border-gray-200 ${linkTo ? 'cursor-pointer hover:border-tms-green transition-colors' : ''}`;

  return (
    <Card 
      className={cardClasses}
      onClick={handleCardClick}
      style={{ background: '#ffffff', color: '#000000' }}
    >
      <div className="flex items-start justify-between space-x-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 truncate mb-1">{title}</p>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-black">{value}</h3>
            {change && (
              <span className={`text-xs font-semibold ${getChangeColor()}`}>
                {change}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-2 line-clamp-2">{description}</p>
          )}
        </div>
        <div className="flex-shrink-0 p-2 sm:p-3 bg-green-100 rounded-lg">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
        </div>
      </div>
    </Card>
  );
};
