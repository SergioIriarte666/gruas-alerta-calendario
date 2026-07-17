import React from 'react';
import { Coins, DollarSign, Landmark, Euro, Pickaxe } from 'lucide-react';
import { useEconomicIndicators } from '@/hooks/useEconomicIndicators';

/** Formatea un número al estilo chileno: miles con punto, decimales con coma. */
const formatCL = (valor: number, decimals = 2) =>
  valor.toLocaleString('es-CL', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** Convierte "YYYY-MM-DD" (string de findic) a "DD-MM-YYYY" para mostrar. */
const formatFecha = (fecha: string) => {
  const [year, month, day] = fecha.split('-');
  return year && month && day ? `${day}-${month}-${year}` : fecha;
};

interface TickerItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

export const EconomicIndicatorsTicker: React.FC = () => {
  const { data, isLoading, error } = useEconomicIndicators();

  // La cinta es informativa: ante cualquier problema desaparece sin ruido.
  if (isLoading || error || !data) return null;

  const items: TickerItem[] = [
    { icon: Coins, label: 'UF', value: `$${formatCL(data.uf.valor)}` },
    { icon: DollarSign, label: 'Dólar', value: `$${formatCL(data.dolar.valor)}` },
    { icon: Landmark, label: 'UTM', value: `$${formatCL(data.utm.valor, 0)}` },
    { icon: Euro, label: 'Euro', value: `$${formatCL(data.euro.valor)}` },
    { icon: Pickaxe, label: 'Cobre', value: `US$${formatCL(data.libra_cobre.valor)}/lb` },
  ];

  return (
    <div className="flex items-center gap-x-1 overflow-x-auto rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-sm whitespace-nowrap">
      {items.map(({ icon: Icon, label, value }) => (
        <div
          key={label}
          className="flex items-center gap-1.5 border-r border-border/50 px-3 first:pl-0 last:border-r-0"
        >
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-foreground tabular-nums">{value}</span>
        </div>
      ))}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-3">
        <span className="text-muted-foreground">Fuente: findic.cl ·</span>
        <span className="font-medium text-foreground tabular-nums">{formatFecha(data.fecha)}</span>
      </div>
    </div>
  );
};
