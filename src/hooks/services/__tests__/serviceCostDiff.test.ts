import { describe, expect, it } from 'vitest';
import { planServiceCostChanges, sealPersistedCost } from '../serviceCostDiff';

describe('sealPersistedCost', () => {
  // El bug de producción: al guardar un costo desde el paso 3 se hacían DOS
  // escrituras de estado seguidas (id, luego isExisting) sobre el mismo arreglo
  // capturado en el render. La segunda pisaba a la primera, así que la fila
  // quedaba "(Guardado)" pero con su id temporal. El guardado final decide por
  // id: la reinsertaba y chocaba contra idx_costs_unique_service_entry.
  it('escribe el id real y la bandera en un solo paso', () => {
    const costs = [
      { id: 'temp-1754000000000', description: 'Combustible', amount: 150000, isExisting: false },
      { id: 'temp-1754000000001', description: 'Viatico', amount: 10000, isExisting: false },
    ];

    const sealed = sealPersistedCost(costs, 'temp-1754000000000', '0f9af209-f6b8-4829-801d-35e0a5cdbaaa');

    expect(sealed[0].id).toBe('0f9af209-f6b8-4829-801d-35e0a5cdbaaa');
    expect(sealed[0].isExisting).toBe(true);
    // La otra fila no se toca.
    expect(sealed[1]).toEqual(costs[1]);
  });

  // La prueba que importa: sellado + plan de escritura no debe reinsertar.
  it('un costo sellado entra como UPDATE, nunca como alta', () => {
    const persistedId = '5b7933d7-304c-402e-8dfd-0a8ff5e59882';
    const sealed = sealPersistedCost(
      [{ id: 'temp-1754000000042', description: 'Viatico', amount: 10000 }],
      'temp-1754000000042',
      persistedId,
    );

    const plan = planServiceCostChanges(sealed, [persistedId]);

    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate.map(c => c.id)).toEqual([persistedId]);
  });
});

describe('planServiceCostChanges', () => {
  // El caso que motivó todo: un viático se registra desde Finanzas, después
  // alguien edita el servicio por el wizard para reasignar el operador y guarda.
  // El costo no está en el estado del formulario. Antes eso lo borraba.
  it('un costo que el formulario no menciona no se toca', () => {
    const costoDesdeFinanzas = 'cost-viatico';
    const formCosts = [
      { id: 'cost-combustible', description: 'Combustible', amount: 153126 },
    ];

    const plan = planServiceCostChanges(formCosts, ['cost-combustible', costoDesdeFinanzas]);

    const mencionados = [...plan.toUpdate, ...plan.toInsert, ...plan.skipped].map(c => c.id);
    expect(mencionados).not.toContain(costoDesdeFinanzas);
    expect(plan.toUpdate).toHaveLength(1);
    expect(plan.toInsert).toHaveLength(0);
  });

  it('actualiza por id lo que ya existe e inserta solo lo nuevo', () => {
    const formCosts = [
      { id: 'cost-1', description: 'Peaje', amount: 4200 },
      { id: 'temp-1722180000000', description: 'Viático', amount: 15000 },
    ];

    const plan = planServiceCostChanges(formCosts, ['cost-1']);

    expect(plan.toUpdate.map(c => c.id)).toEqual(['cost-1']);
    expect(plan.toInsert.map(c => c.id)).toEqual(['temp-1722180000000']);
  });

  // Un id que el formulario cree vivo pero que ya no está en la base (otra
  // pestaña lo borró) tiene que entrar como alta: un UPDATE no encontraría fila
  // y el costo se perdería en silencio, que es justo lo que se está corrigiendo.
  it('trata como alta un id que ya no existe en la base', () => {
    const formCosts = [{ id: 'cost-borrado-en-otra-pestana', description: 'Peaje', amount: 4200 }];

    const plan = planServiceCostChanges(formCosts, []);

    expect(plan.toInsert.map(c => c.id)).toEqual(['cost-borrado-en-otra-pestana']);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it('descarta filas incompletas sin escribirlas', () => {
    const formCosts = [
      { id: 'temp-1', description: '', amount: 5000 },
      { id: 'temp-2', description: 'Sin monto', amount: 0 },
      { id: 'temp-3', description: '   ', amount: 100 },
      { id: 'temp-4', description: 'Válido', amount: 100 },
    ];

    const plan = planServiceCostChanges(formCosts, []);

    expect(plan.skipped.map(c => c.id)).toEqual(['temp-1', 'temp-2', 'temp-3']);
    expect(plan.toInsert.map(c => c.id)).toEqual(['temp-4']);
  });

  it('sin costos en el formulario no planifica ninguna escritura', () => {
    const plan = planServiceCostChanges([], ['cost-1', 'cost-2']);

    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.skipped).toHaveLength(0);
  });
});
