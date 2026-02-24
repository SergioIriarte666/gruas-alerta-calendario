import React from 'react';
import { TransportCostTabs } from '@/components/transport/TransportCostTabs';
import { Truck } from 'lucide-react';

const TransportCosts: React.FC = () => {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Truck className="w-6 h-6 text-violet-600" />
          Costos de Transporte
        </h1>
        <p className="text-muted-foreground mt-1">
          Calculadora inteligente de costos, gestión de rutas, peajes y combustible
        </p>
      </div>
      <TransportCostTabs />
    </div>
  );
};

export default TransportCosts;
