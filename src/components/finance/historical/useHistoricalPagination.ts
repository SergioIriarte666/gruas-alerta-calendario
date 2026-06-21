import { useEffect, useMemo, useState } from 'react';

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface UseHistoricalPaginationOptions {
  /** Cambiar cualquiera de estos valores reinicia la paginación a la página 1. */
  resetKey: string;
}

/**
 * Paginación local (client-side). Limitación conocida: las tablas históricas
 * cargan todos los registros filtrados en memoria (no hay paginación server-side
 * en este módulo todavía); este hook solo corta la porción visible para no
 * renderizar miles de filas a la vez.
 */
export function useHistoricalPagination({ resetKey }: UseHistoricalPaginationOptions) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  useEffect(() => {
    setPage(1);
  }, [resetKey, pageSize]);

  const paginate = useMemo(() => {
    return <T,>(items: T[]) => {
      const start = (page - 1) * pageSize;
      return items.slice(start, start + pageSize);
    };
  }, [page, pageSize]);

  const getRangeLabel = (total: number) => {
    if (total === 0) return '0 de 0';
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}-${end} de ${total}`;
  };

  const getTotalPages = (total: number) => Math.max(1, Math.ceil(total / pageSize));

  return {
    page,
    pageSize,
    setPage,
    setPageSize,
    paginate,
    getRangeLabel,
    getTotalPages,
  };
}
