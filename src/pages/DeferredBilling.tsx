import React from 'react';
import { DeferredBillingDashboard } from '@/components/deferred-billing/DeferredBillingDashboard';

const DeferredBilling: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Facturación Diferida
        </h1>
        <p className="text-muted-foreground">
          Gestiona la facturación de clientes con períodos de diferimiento personalizados.
        </p>
      </div>
      
      <DeferredBillingDashboard />
    </div>
  );
};

export default DeferredBilling;