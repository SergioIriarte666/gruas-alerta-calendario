import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_SERVICE_COST_MESSAGE,
  describeServiceCostError,
  isDuplicateServiceCostError,
} from '../serviceCostErrors';

const duplicateError = {
  code: '23505',
  message:
    'duplicate key value violates unique constraint "idx_costs_unique_service_entry"',
  details: 'Key (description, amount, date, service_id)=(Viatico, 10000, 2026-07-30, db79aeb9) already exists.',
  hint: null,
};

describe('describeServiceCostError', () => {
  it('traduce la colisión del índice de costo duplicado', () => {
    expect(isDuplicateServiceCostError(duplicateError)).toBe(true);
    expect(describeServiceCostError(duplicateError)).toBe(DUPLICATE_SERVICE_COST_MESSAGE);
  });

  // El nombre del índice puede llegar en details en vez de message según por
  // dónde entre el error.
  it('lo reconoce aunque el nombre venga solo en details', () => {
    expect(
      isDuplicateServiceCostError({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
        details: 'conflicting key on idx_costs_unique_service_entry',
      }),
    ).toBe(true);
  });

  // Otro 23505 del sistema (folio repetido, por ejemplo) no debe disfrazarse de
  // costo duplicado: ese mensaje mandaría a la administrativa a buscar donde no es.
  it('no se apropia de otras violaciones de unicidad', () => {
    expect(
      isDuplicateServiceCostError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "services_folio_key"',
        details: null,
      }),
    ).toBe(false);
  });

  it('ignora errores que no son de unicidad', () => {
    expect(isDuplicateServiceCostError({ code: '23503', message: 'foreign key' })).toBe(false);
    expect(describeServiceCostError(null)).toBeNull();
    expect(describeServiceCostError('boom')).toBeNull();
  });
});
