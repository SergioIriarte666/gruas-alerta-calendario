import React from 'react';
import { DeferredBillingDashboard } from '@/components/deferred-billing/DeferredBillingDashboard';

const DeferredBilling: React.FC = () => {
  React.useEffect(() => {
    document.title = 'Facturación Diferida | Panel';
    const meta = document.querySelector('meta[name="description"]');
    const content = 'Gestiona la facturación diferida: calendario, servicios listos y configuración.';
    if (meta) meta.setAttribute('content', content);
    else { const m = document.createElement('meta'); m.name = 'description'; m.content = content; document.head.appendChild(m); }
    if (!document.querySelector('link[rel="canonical"]')) {
      const l = document.createElement('link'); l.rel = 'canonical'; l.href = window.location.href; document.head.appendChild(l);
    }
  }, []);
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