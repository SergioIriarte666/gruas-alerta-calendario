import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  OPERATOR_HIDDEN_SERVICE_STATUSES,
  OPERATOR_HIDDEN_STATUSES_POSTGREST,
  OPERATOR_STARTABLE_SERVICE_STATUSES,
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

describe('visibilidad operacional del portal del operador', () => {
  // El incidente: 32 servicios en 'quoted' invisibles para su operador.
  it('un servicio cotizado es visible y se puede iniciar', () => {
    expect(isVisibleToOperator('quoted')).toBe(true);
    expect(isStartableByOperator('quoted')).toBe(true);
  });

  it('los demás estados comerciales tampoco esconden el servicio', () => {
    for (const status of ['pending', 'purchase_order_pending', 'with_purchase_order']) {
      expect(isVisibleToOperator(status)).toBe(true);
      expect(isStartableByOperator(status)).toBe(true);
    }
  });

  it('solo esconde lo que ya no se puede trabajar', () => {
    expect(OPERATOR_HIDDEN_SERVICE_STATUSES).toEqual(['invoiced', 'cancelled', 'failed']);
    for (const status of OPERATOR_HIDDEN_SERVICE_STATUSES) {
      expect(isVisibleToOperator(status)).toBe(false);
    }
  });

  it('lo que ya está en vuelo o cerrado no ofrece "Iniciar"', () => {
    for (const status of ['in_progress', 'inspection_completed', 'completed', 'partially_invoiced']) {
      expect(isStartableByOperator(status)).toBe(false);
    }
  });

  it('un servicio en curso sigue siendo visible', () => {
    expect(isVisibleToOperator('in_progress')).toBe(true);
    expect(isVisibleToOperator('inspection_completed')).toBe(true);
    expect(isVisibleToOperator('completed')).toBe(true);
  });

  it('la cláusula PostgREST va entre paréntesis', () => {
    expect(OPERATOR_HIDDEN_STATUSES_POSTGREST).toBe('(invoiced,cancelled,failed)');
  });

  it('sin estado no hay visibilidad ni inicio', () => {
    expect(isVisibleToOperator(null)).toBe(false);
    expect(isVisibleToOperator('')).toBe(false);
    expect(isStartableByOperator(undefined)).toBe(false);
  });
});

describe('contrato con el servidor', () => {
  it('el fetcher del operador no filtra por lista blanca de estados', () => {
    const source = readWorkspaceFile('src/hooks/useOperatorServices.ts');
    // Un `.in('status', [...])` acá es exactamente lo que escondió los 32
    // servicios en 'quoted'.
    expect(source).not.toContain(".in('status'");
    expect(source).toContain('OPERATOR_HIDDEN_STATUSES_POSTGREST');
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
