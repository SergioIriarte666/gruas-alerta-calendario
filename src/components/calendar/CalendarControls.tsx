
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarControlsProps {
  viewTitle: string;
  viewMode: 'month' | 'week' | 'day';
  onNavigate: (direction: 'prev' | 'next') => void;
  onViewModeChange: (mode: 'month' | 'week' | 'day') => void;
}

export const CalendarControls = ({ 
  viewTitle, 
  viewMode, 
  onNavigate, 
  onViewModeChange 
}: CalendarControlsProps) => {
  return (
    <Card className="glass-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-gray-700 text-gray-300"
              onClick={() => onNavigate('prev')}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="text-xl font-semibold text-white min-w-64 text-center">
              {viewTitle}
            </h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-gray-700 text-gray-300"
              onClick={() => onNavigate('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant={viewMode === 'day' ? 'default' : 'outline'} 
              size="sm" 
              className={viewMode === 'day' ? 'bg-green-500 hover:bg-green-600 text-white' : 'border-gray-700 text-gray-300'}
              onClick={() => onViewModeChange('day')}
            >
              Día
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'default' : 'outline'} 
              size="sm" 
              className={viewMode === 'week' ? 'bg-green-500 hover:bg-green-600 text-white' : 'border-gray-700 text-gray-300'}
              onClick={() => onViewModeChange('week')}
            >
              Semana
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'default' : 'outline'} 
              size="sm" 
              className={viewMode === 'month' ? 'bg-green-500 hover:bg-green-600 text-white' : 'border-gray-700 text-gray-300'}
              onClick={() => onViewModeChange('month')}
            >
              Mes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
