
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, List } from 'lucide-react';
import { CalendarViewMode } from '@/types/calendar';

interface CalendarControlsProps {
  viewTitle: string;
  viewMode: CalendarViewMode;
  onNavigate: (direction: 'prev' | 'next') => void;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

export const CalendarControls = ({ 
  viewTitle, 
  viewMode, 
  onNavigate, 
  onViewModeChange 
}: CalendarControlsProps) => {
  return (
    <Card className="border-border/70 bg-card shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-x-4">
            <Button 
              variant="outline" 
              size="sm" 
              className="border-border/70 bg-background/60"
              onClick={() => onNavigate('prev')}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="text-xl font-semibold text-foreground min-w-48 sm:min-w-64 text-center">
              {viewTitle}
            </h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="border-border/70 bg-background/60"
              onClick={() => onNavigate('next')}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant={viewMode === 'day' ? 'default' : 'outline'} 
              size="sm" 
              className={viewMode === 'day' ? 'shadow-sm' : 'border-border/70 bg-background/60'}
              onClick={() => onViewModeChange('day')}
            >
              Día
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'default' : 'outline'} 
              size="sm" 
              className={viewMode === 'week' ? 'shadow-sm' : 'border-border/70 bg-background/60'}
              onClick={() => onViewModeChange('week')}
            >
              Semana
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'default' : 'outline'} 
              size="sm" 
              className={viewMode === 'month' ? 'shadow-sm' : 'border-border/70 bg-background/60'}
              onClick={() => onViewModeChange('month')}
            >
              Mes
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => onViewModeChange('list')}
              className={viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'border-border/70 bg-background/60'}
            >
              <List className="size-4 mr-1" />
              Lista
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
