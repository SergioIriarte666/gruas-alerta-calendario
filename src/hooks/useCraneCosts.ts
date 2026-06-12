import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Cost } from '@/types/costs';
import { createLogger } from "@/lib/logger";

const logger = createLogger("useCraneCosts");

const CRANE_COSTS_SELECT = `
  *,
  cost_categories (*),
  operators (*),
  services (*, clients!services_client_id_fkey(*))
`;

// Variante con inner join: permite filtrar por la grúa del servicio asociado
// (services.crane_id) en el servidor, sin pasar listas de IDs por la URL
const CRANE_COSTS_SELECT_VIA_SERVICE = `
  *,
  cost_categories (*),
  operators (*),
  services!inner(*, clients!services_client_id_fkey(*))
`;

const PAGE_SIZE = 1000;

type CostsQueryBuilder = (from: number, to: number) => ReturnType<typeof buildPage>;

function buildPage(select: string) {
  return supabase
    .from('costs')
    .select(select)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
}

async function fetchAllPages(label: string, makeQuery: CostsQueryBuilder): Promise<Cost[]> {
  const rows: Cost[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await makeQuery(from, to);

    if (error) {
      logger.error(`Error fetching crane costs (${label}, page ${page}):`, error);
      throw error;
    }

    const pageData = (data as any[]) || [];
    rows.push(...(pageData as Cost[]));

    if (pageData.length < PAGE_SIZE) break;
    page++;
  }

  return rows;
}

async function fetchAllCraneCosts(craneId: string): Promise<Cost[]> {
  // Unión de dos fuentes, cada una paginada y filtrada en el servidor:
  //   a) costos directos: costs.crane_id = craneId (mantenimiento, piezas, etc.)
  //   b) costos de servicios de la grúa: services.crane_id = craneId vía inner join
  //      (gastos de servicios, comisiones, peajes, etc. con crane_id NULL o distinto)
  const [directCosts, viaServiceCosts] = await Promise.all([
    fetchAllPages('direct', (from, to) =>
      buildPage(CRANE_COSTS_SELECT).eq('crane_id', craneId).range(from, to)
    ),
    fetchAllPages('via-service', (from, to) =>
      buildPage(CRANE_COSTS_SELECT_VIA_SERVICE).eq('services.crane_id', craneId).range(from, to)
    ),
  ]);

  // Deduplicar por id (un costo puede tener crane_id Y service_id de la misma grúa)
  const seen = new Set<string>();
  const unique = [...directCosts, ...viaServiceCosts].filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  // Reordenar la unión (cada fuente viene ordenada, pero el merge no)
  unique.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
    return 0;
  });

  logger.debug(`[useCraneCosts] crane=${craneId}: ${directCosts.length} directos, ${viaServiceCosts.length} via servicio, ${unique.length} únicos`);

  return unique;
}

export const useCraneCosts = (craneId: string) => {
  return useQuery({
    queryKey: ['crane-costs', craneId],
    queryFn: () => fetchAllCraneCosts(craneId),
    enabled: !!craneId,
    staleTime: 5 * 60 * 1000,
  });
};
