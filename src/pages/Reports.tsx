
import * as React from 'react';
import ReportsPage from '@/components/reports/ReportsPage';

const Reports = () => {
  React.useEffect(() => {
    document.title = 'Reportes | Panel';
    const meta = document.querySelector('meta[name="description"]');
    const content = 'Análisis detallado de métricas, operaciones y costos del negocio.';
    if (meta) meta.setAttribute('content', content);
    else { const m = document.createElement('meta'); m.name = 'description'; m.content = content; document.head.appendChild(m); }
    if (!document.querySelector('link[rel="canonical"]')) {
      const l = document.createElement('link'); l.rel = 'canonical'; l.href = window.location.href; document.head.appendChild(l);
    }
  }, []);
  return <ReportsPage />;
};

export default Reports;
