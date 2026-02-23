import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Target, RefreshCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface CostCentersHeaderProps {
  onAddCostCenter: () => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  totalCostCenters: number;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export const CostCentersHeader = ({
  onAddCostCenter,
  searchTerm,
  onSearchChange,
  totalCostCenters,
  onRefresh,
  isLoading
}: CostCentersHeaderProps) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
            <Target className="w-8 h-8 text-primary" />
            Centros de Costo
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona y organiza los centros de costo para un mejor control financiero
          </p>
        </div>
        
        <div className="flex gap-2">
          {onRefresh && (
            <Button 
              variant="outline" 
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          )}
          <Button onClick={onAddCostCenter} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuevo Centro
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por nombre, código o descripción..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              Total: {totalCostCenters} centros de costo
              {isLoading && <span className="ml-2 text-primary">• Actualizando...</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};