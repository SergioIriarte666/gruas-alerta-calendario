
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

  const cardClasses = `metric-card group h-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 ${linkTo ? 'cursor-pointer hover:border-tms-green hover:shadow-lg' : ''}`;

  return (
    <Card 
      className={cardClasses}
      onClick={handleCardClick}
      style={{ background: '#ffffff', color: '#000000' }}
    >
      <div className="p-3 sm:p-4 md:p-5 lg:p-6">
        <div className="flex items-start justify-between mb-2 sm:mb-3">
          <div className="flex-1 min-w-0 pr-2 sm:pr-3">
            <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide truncate mb-1 sm:mb-2">
              {title}
            </p>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex flex-col space-y-1">
                <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-black leading-tight break-all">
                  {value}
                </h3>
                {change && (
                  <span className={`text-xs sm:text-sm font-semibold ${getChangeColor()} inline-block`}>
                    {change}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="p-2 sm:p-2.5 md:p-3 bg-tms-green/10 rounded-lg group-hover:bg-tms-green/20 transition-all duration-300 flex-shrink-0">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-tms-green" />
          </div>
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed line-clamp-2 break-words">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
};
