import React from 'react';

export const HistoricalPurchases: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
      <div className="p-4 bg-muted rounded-full">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8 text-muted-foreground"
        >
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <path d="M3 6h18" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Histórico de Compras</h3>
        <p className="text-muted-foreground max-w-sm">
          Este módulo está en desarrollo. Próximamente podrás gestionar y visualizar el historial de facturas de compra.
        </p>
      </div>
    </div>
  );
};
