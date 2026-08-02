# `usePagedServices` — paginación server-side de Servicios

Código rescatado de `074013f9^`, antes de que el commit `074013f9`
(*"fix: estabiliza Servicios y Nuevo Servicio en revisión global"*, 2026-06-10) lo
retirara. **No está en el árbol de compilación.** Vive acá como referencia, para no
tener que reescribirlo desde cero si hace falta reponerlo.

- **Vivía en:** `src/hooks/services/useServiceQueries.ts`
- **Lo consumía:** `src/hooks/services/useServicesPage.ts`
- **Estado hoy:** `useServiceQueries.ts` sigue en el árbol pero está muerto desde ese
  mismo commit — ver `CODIGO_MUERTO.md`. La auditoría lo mostraba como huérfano del
  2026-07-29 porque un refactor posterior lo tocó; murió siete semanas antes, acá.

## Por qué se retiró

`074013f9` sacó la paginación server-side y la reemplazó por `.slice()` en cliente sobre
la lista completa que devuelve `useServices()`.

El commit no fue un retroceso gratuito: la paginación server-side convivía mal con el
resto de la pantalla. Había dos fuentes de datos para la misma tabla —`pagedData` cuando
la vista era "básica", `services` cuando no— y la decisión de cuál usar dependía de un
`isBasicView` que se apagaba con cualquier filtro avanzado, orden o búsqueda:

```ts
const isBasicView =
  !advancedFilters &&
  futureParam !== 'true' &&
  !sortField;

const shouldUsePagedData = isBasicView && !searchTerm;
const baseServices = shouldUsePagedData && pagedData?.services ? pagedData.services : services;
```

Con dos fuentes, `totalPages` y `paginatedServices` también tenían que bifurcarse, y el
filtrado en memoria corría igual sobre `baseServices`. El commit unificó todo en una sola
fuente (`services`) y aprovechó para memoizar el filtrado con `useMemo`. Ganó
previsibilidad y perdió la paginación real.

## Por qué puede hacer falta reponerlo

Es exactamente el patrón que causó el "solo 8" en Bodega → Movimientos: traer todo,
cortar en cliente, y que el usuario vea una fracción del universo sin que nada avise. Ver
la memoria del proyecto sobre paginación server-side de Movimientos.

Mientras la tabla `services` sea chica, `.slice()` funciona. Cuando deje de serlo, los
síntomas van a ser: la página de Servicios cargando lento, el contador de páginas
peleado con la cantidad real de filas, y filtros que "pierden" servicios antiguos porque
la query base ya venía recortada por un límite de PostgREST.

Si se repone, el punto a resolver no es este hook —está completo y es correcto— sino el
que hundió al anterior: **una sola fuente de datos.** O la búsqueda, el orden y los
filtros avanzados también viajan al servidor, o la pantalla vuelve a tener dos caminos
que hay que mantener en sincronía.

## El código, tal como estaba

De `074013f9^:src/hooks/services/useServiceQueries.ts`. Se devolvía desde el hook
`useServiceQueries()` junto a `useAllServices`, `useServiceById` y `useServicesByOperator`.

```ts
const usePagedServices = (
  page: number,
  pageSize: number,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    search?: string;
  }
) => {
  return useQuery({
    queryKey: [
      'services', 'paged', page, pageSize,
      filters?.dateFrom, filters?.dateTo, filters?.status, filters?.search,
    ],
    queryFn: async (): Promise<{ services: Service[]; total: number }> => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('services')
        .select(SERVICE_WITH_RELATIONS_SELECT, { count: 'exact' })
        .order('service_date', { ascending: false })
        .range(from, to);

      if (filters?.dateFrom) query = query.gte('service_date', filters.dateFrom);
      if (filters?.dateTo)   query = query.lte('service_date', filters.dateTo);

      if (filters?.status && filters.status !== 'all' && filters.status !== 'with_purchase_order') {
        const statuses = filters.status.split(',') as ServiceStatus[];
        if (statuses.length === 1) {
          query = query.eq('status', statuses[0]);
        } else {
          query = query.in('status', statuses);
        }
      }

      if (filters?.search) {
        const term = filters.search.replace(/[-\s_]/g, '');
        query = query.or(`folio.ilike.%${term}%,license_plate.ilike.%${term}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('❌ [QUERY] Error al obtener servicios paginados:', error);
        throw new Error(error.message);
      }

      const services = (data || []).map(transformToService);
      const total = typeof count === 'number' ? count : services.length;

      return { services, total };
    },
    enabled: page > 0 && pageSize > 0,
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
```

### El cableado que se eliminó

De `074013f9^:src/hooks/services/useServicesPage.ts`:

```ts
const { usePagedServices } = useServiceQueries();

const ITEMS_PER_PAGE = 10;

const isBasicView =
  !advancedFilters &&
  futureParam !== 'true' &&
  !sortField;

const {
  data: pagedData,
  isLoading: loadingPaged,
  refetch: refetchPaged,
} = usePagedServices(currentPage, ITEMS_PER_PAGE, {
  dateFrom: listDateFrom || undefined,
  dateTo:   listDateTo   || undefined,
  status:   (statusFilter !== 'all' && statusFilter !== 'with_purchase_order') ? statusFilter : undefined,
});

const shouldUsePagedData = isBasicView && !searchTerm;
const baseServices = shouldUsePagedData && pagedData?.services ? pagedData.services : services;

// ...

const totalPages = shouldUsePagedData && pagedData
  ? Math.max(1, Math.ceil(pagedData.total / ITEMS_PER_PAGE))
  : Math.ceil(filteredAndSortedServices.length / ITEMS_PER_PAGE || 1);

const paginatedServices = shouldUsePagedData
  ? filteredAndSortedServices
  : filteredAndSortedServices.slice(
      (currentPage - 1) * ITEMS_PER_PAGE,
      currentPage * ITEMS_PER_PAGE
    );
```

## Dependencias

Las tres que usa el hook siguen existiendo en `src/hooks/services/useServiceQueries.ts`,
en el archivo muerto:

| Símbolo | Qué es |
|:---|:---|
| `SERVICE_WITH_RELATIONS_SELECT` | El `select` de PostgREST con cliente, grúa, operador, tipo de servicio y `service_resources`. Usa `clients!services_client_id_fkey` — obligatorio: `services` tiene dos FK a `clients` y sin desambiguar el embed falla. |
| `transformToService` | Mapea la fila cruda de Supabase (snake_case) al tipo `Service` (camelCase). |
| `logger` | `createLogger('ServiceQueries')`. |

Si se repone el hook, conviene traer también esas tres piezas o apuntar a las
equivalentes que hoy usa `useServices()`, no reimplementarlas.
