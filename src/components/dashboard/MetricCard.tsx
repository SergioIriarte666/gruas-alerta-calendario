
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

  const cardClasses = `metric-card group p-6 h-full bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 ${linkTo ? 'cursor-pointer hover:border-tms-green hover:shadow-lg' : ''}`;

  return (
    <Card 
      className={cardClasses}
      onClick={handleCardClick}
      style={{ background: '#ffffff', color: '#000000' }}
    >
      <div className="flex items-start justify-between h-full">
        <div className="flex-1 space-y-2">
          <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">{title}</p>
          <div className="space-y-1">
            <div className="flex items-baseline space-x-2">
              <h3 className="text-2xl xl:text-3xl font-bold text-black leading-none">{value}</h3>
              {change && (
                <span className={`text-xs font-semibold ${getChangeColor()} flex items-center`}>
                  {change}
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
        <div className="p-3 bg-tms-green/10 rounded-lg group-hover:bg-tms-green/20 transition-all duration-300 ml-3">
          <Icon className="w-6 h-6 text-tms-green" />
        </div>
      </div>
    </Card>
  );
};
