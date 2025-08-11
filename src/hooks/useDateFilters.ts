
import { useMemo } from 'react';
import { Cost } from '@/types/costs';

export const useDateFilters = (costs: Cost[]) => {
  const dateMetrics = useMemo(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // Filtrar costos de hoy
    const todayCosts = costs.filter(cost => {
      const costDate = new Date(cost.date + 'T00:00:00');
      return costDate.toDateString() === today.toDateString();
    });

    // Filtrar costos del mes actual
    const currentMonthCosts = costs.filter(cost => {
      const costDate = new Date(cost.date + 'T00:00:00');
      return costDate.getMonth() === currentMonth && costDate.getFullYear() === currentYear;
    });

    // Filtrar costos del mes anterior
    const previousMonthCosts = costs.filter(cost => {
      const costDate = new Date(cost.date + 'T00:00:00');
      return costDate.getMonth() === previousMonth && costDate.getFullYear() === previousMonthYear;
    });

    // Calcular totales
    const todayTotal = todayCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
    const currentMonthTotal = currentMonthCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
    const previousMonthTotal = previousMonthCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);

    // Calcular variación mes a mes
    const monthVariation = previousMonthTotal > 0 
      ? ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100 
      : 0;

    return {
      today: {
        costs: todayCosts,
        total: todayTotal,
        count: todayCosts.length
      },
      currentMonth: {
        costs: currentMonthCosts,
        total: currentMonthTotal,
        count: currentMonthCosts.length,
        variation: monthVariation
      },
      previousMonth: {
        total: previousMonthTotal,
        count: previousMonthCosts.length
      }
    };
  }, [costs]);

  return dateMetrics;
};
