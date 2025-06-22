
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
      <div className="p-4 sm:p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm font-medium text-gray-600 uppercase tracking-wide mb-3 leading-tight">
              {title}
            </p>
            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-black leading-tight break-words">
                {value}
              </h3>
              {change && (
                <span className={`text-xs sm:text-sm font-semibold ${getChangeColor()} block`}>
                  {change}
                </span>
              )}
            </div>
          </div>
          <div className="p-2 sm:p-2.5 bg-tms-green/10 rounded-lg group-hover:bg-tms-green/20 transition-all duration-300 flex-shrink-0">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-tms-green" />
          </div>
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed line-clamp-2 break-words mt-2">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
};
