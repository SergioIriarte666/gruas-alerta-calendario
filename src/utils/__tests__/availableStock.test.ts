import { describe, it, expect } from 'vitest';
import { sumAvailableStock } from '../availableStock';

describe('sumAvailableStock', () => {
  it('devuelve 0 cuando el producto no tiene filas de existencia', () => {
    expect(sumAvailableStock(null)).toBe(0);
    expect(sumAvailableStock(undefined)).toBe(0);
    expect(sumAvailableStock([])).toBe(0);
  });

  it('usa available_quantity tal cual viene de inventory_stock', () => {
    // Caso "Cadenas Con Rompehielo 2828": entrada de 3 + salida de 1 anulada.
    // La base ya descartó el movimiento anulado; el cliente sólo suma.
    expect(
      sumAvailableStock([
        { current_quantity: 3, reserved_quantity: 0, available_quantity: 3 },
      ]),
    ).toBe(3);
  });

  it('suma todas las ubicaciones del mismo producto', () => {
    expect(
      sumAvailableStock([
        { current_quantity: 3, reserved_quantity: 0, available_quantity: 3 },
        { current_quantity: 5, reserved_quantity: 1, available_quantity: 4 },
      ]),
    ).toBe(7);
  });

  it('descuenta lo reservado cuando available_quantity viene nulo', () => {
    expect(
      sumAvailableStock([{ current_quantity: 10, reserved_quantity: 4, available_quantity: null }]),
    ).toBe(6);
  });
});
