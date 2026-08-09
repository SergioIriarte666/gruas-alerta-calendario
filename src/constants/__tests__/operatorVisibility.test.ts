import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OPERATOR_COMMERCIAL_SERVICE_STATUSES,
  OPERATOR_HIDDEN_SERVICE_STATUSES,
  OPERATOR_OPERATIONAL_SERVICE_STATUSES,
  OPERATOR_STARTABLE_SERVICE_STATUSES,
  buildOperatorVisibilityFilter,
  isStartableByOperator,
  isVisibleToOperator,
} from '../operatorVisibility';

const readWorkspaceFile = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/** Sin comentarios: el patrón prohibido se documenta ahí a propósito. */
const readCode = (path: string) =>
  readWorkspaceFile(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const MIGRATION = 'supabase/migrations/20260809170000_service_integrity_guards.sql';

const HOY = '2026-08-09';
const MANANA = '2026-08-10';
const JUNIO = '2026-06-15';

describe('visibilidad operacional del portal del operador', () => {
  // Regla del dueño: "si el servicio está en etapa de cotizado u OC, con fecha
  // futura, se debe ver".
  it('un cotizado de hoy o de mañana se ve y se puede iniciar', () => {
    expect(isVisibleToOperator('quoted', HOY, HOY)).toBe(true);
    expect(isVisibleToOperator('quoted', MANANA, HOY)).toBe(true);
    expect(isStartableByOperator('quoted')).toBe(true);
  });

  it('un cotizado con fecha pasada ya no se ve', () => {
    expect(isVisibleToOperator('quoted', JUNIO, HOY)).toBe(false);
  });

  it('la etapa de OC sigue el mismo criterio de fecha', () => {
    for (const status of ['purchase_order_pending', 'with_purchase_order']) {
      expect(isVisibleToOperator(status, MANANA, HOY)).toBe(true);
      expect(isVisibleToOperator(status, JUNIO, HOY)).toBe(false);
      expect(isStartableByOperator(status)).toBe(true);
    }
  });

  it('los operacionales se ven siempre, la fecha no los toca', () => {
    for (const status of OPERATOR_OPERATIONAL_SERVICE_STATUSES) {
      expect(isVisibleToOperator(status, '2025-01-10', HOY)).toBe(true);
      expect(isVisibleToOperator(status, MANANA, HOY)).toBe(true);
    }
  });

  it('un pending antiguo sigue apareciendo', () => {
    expect(isVisibleToOperator('pending', '2025-01-10', HOY)).toBe(true);
  });

  it('los cerrados no se ven ni con fecha futura', () => {
    expect(OPERATOR_HIDDEN_SERVICE_STATUSES).toEqual(['invoiced', 'cancelled', 'failed']);
    for (const status of OPERATOR_HIDDEN_SERVICE_STATUSES) {
      expect(isVisibleToOperator(status, MANANA, HOY)).toBe(false);
    }
  });

  it('la lista es blanca: un estado no clasificado tampoco se ve', () => {
    expect(isVisibleToOperator('partially_invoiced', MANANA, HOY)).toBe(false);
  });

  it('un comercial sin fecha no se muestra: no hay con qué decidir vigencia', () => {
    expect(isVisibleToOperator('quoted', null, HOY)).toBe(false);
    expect(isVisibleToOperator('quoted', MANANA, '')).toBe(false);
  });

  it('lo que ya está en vuelo o cerrado no ofrece "Iniciar"', () => {
    for (const status of ['in_progress', 'inspection_completed', 'completed', 'partially_invoiced']) {
      expect(isStartableByOperator(status)).toBe(false);
    }
  });

  it('sin estado no hay visibilidad ni inicio', () => {
    expect(isVisibleToOperator(null, MANANA, HOY)).toBe(false);
    expect(isVisibleToOperator('', MANANA, HOY)).toBe(false);
    expect(isStartableByOperator(undefined)).toBe(false);
  });

  // La sintaxis anidada se verificó contra la API real: un filtro mal formado
  // devuelve PGRST100 "failed to parse logic tree" antes de tocar RLS.
  it('la cláusula PostgREST anida el and() dentro del or()', () => {
    expect(buildOperatorVisibilityFilter(HOY)).toBe(
      'status.in.(pending,in_progress,inspection_completed,completed),' +
        `and(status.in.(quoted,purchase_order_pending,with_purchase_order),service_date.gte.${HOY})`,
    );
  });
});

describe('contrato con el servidor', () => {
  it('el fetcher del operador no filtra por lista blanca de estados', () => {
    const source = readWorkspaceFile('src/hooks/useOperatorServices.ts');
    // Un `.in('status', [...])` acá es exactamente lo que escondió los 32
    // servicios en 'quoted'.
    expect(source).not.toContain(".in('status'");
    expect(source).toContain('buildOperatorVisibilityFilter');
    // La fecha de corte va en TZ del negocio: el día del navegador mueve el
    // corte segun donde este el telefono.
    expect(source).toContain('getBusinessToday()');
  });

  it('operator_startable_statuses() del servidor coincide con la constante', () => {
    const migration = readWorkspaceFile(MIGRATION);
    const fn = migration.slice(
      migration.indexOf('CREATE OR REPLACE FUNCTION public.operator_startable_statuses'),
      migration.indexOf('COMMENT ON FUNCTION public.operator_startable_statuses'),
    );

    for (const status of OPERATOR_STARTABLE_SERVICE_STATUSES) {
      expect(fn).toContain(`'${status}'`);
    }
    // Todo comercial visible tiene que poder iniciarse, o el operador ve el
    // servicio y no puede hacer nada con el.
    for (const status of OPERATOR_COMMERCIAL_SERVICE_STATUSES) {
      expect(isStartableByOperator(status)).toBe(true);
    }
  });

  it('la tarjeta del operador decide por el helper, no por un literal', () => {
    const source = readWorkspaceFile('src/components/operator/AssignedServiceCard.tsx');
    expect(source).toContain('isStartableByOperator(status)');
    expect(source).not.toContain("if (status === 'pending') {");
  });
});

describe('integridad de services (migración)', () => {
  const migration = () => readWorkspaceFile(MIGRATION);

  it('bloquea la eliminación por estado, hitos y evidencia de terreno', () => {
    const sql = migration();
    expect(sql).toContain("IN ('in_progress', 'inspection_completed', 'completed', 'invoiced')");
    expect(sql).toContain('journey_stage_reached IS NOT NULL');
    expect(sql).toContain('on_site_reached_at IS NOT NULL');
    for (const table of [
      'inspections',
      'service_tracking_links',
      'service_route_metrics',
      'operator_location_sessions',
      'service_stop_events',
    ]) {
      expect(sql).toContain(`FROM public.${table} WHERE service_id`);
    }
  });

  it('valida ANTES de que la cascada borre las filas hijas', () => {
    const sql = migration();
    const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.delete_service_cascade'));
    // Si el assert quedara después del primer DELETE, las inspecciones ya no
    // existirían y el chequeo pasaría siempre.
    expect(fn.indexOf('assert_service_deletable')).toBeLessThan(
      fn.indexOf('DELETE FROM public.inspections'),
    );
  });

  it('el folio sale de una secuencia y los SECURITY DEFINER tienen GRANT', () => {
    const sql = migration();
    expect(sql).toContain('CREATE SEQUENCE IF NOT EXISTS public.services_folio_seq');
    expect(sql).toContain("nextval('public.services_folio_seq')");
    for (const fn of [
      'public.next_service_folio()',
      'public.service_delete_block_reason(uuid)',
      'public.assert_service_deletable(uuid)',
      'public.operator_startable_statuses()',
    ]) {
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION ${fn} TO authenticated`);
    }
  });

  it('audit_log cubre el DELETE de services', () => {
    const sql = migration();
    expect(sql).toContain('AFTER DELETE ON public.services');
    expect(sql).toContain('EXECUTE FUNCTION public.log_audit_changes()');
  });
});

describe('el folio ya no se puede inventar en el cliente', () => {
  it('no queda ningún fallback por timestamp', () => {
    for (const path of [
      'src/hooks/useFolioGenerator.ts',
      'src/hooks/services/useEnhancedFolioGeneration.ts',
    ]) {
      const source = readCode(path);
      // El fallback por timestamp fue el que emitió SRV-826894.
      expect(source).not.toContain('Date.now()');
      expect(source).not.toMatch(/fallbackFolio/);
    }
  });

  it('el folio lo emite el RPC de la secuencia', () => {
    const source = readWorkspaceFile('src/hooks/useFolioGenerator.ts');
    expect(source).toContain("supabase.rpc('next_service_folio')");
  });
});

describe('purga de huérfanos de Storage', () => {
  it('respeta una cuarentena antes de borrar', () => {
    const source = readWorkspaceFile('supabase/functions/purge-storage-orphans/index.ts');
    expect(source).toContain('QUARANTINE_DAYS = 7');
    expect(source).toContain('.lt("detected_at", quarantineCutoff)');
  });
});
