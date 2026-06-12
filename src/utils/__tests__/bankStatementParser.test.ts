import { describe, expect, it } from 'vitest';
import { parseBankStatementPdfTextLines } from '../bankStatementParser';

describe('parseBankStatementPdfTextLines', () => {
  it('parsea movimientos de cartola PDF real con contexto antes y despues de la linea de fecha', () => {
    const movements = parseBankStatementPdfTextLines([
      'Detalle movimientos',
      'FECHA CARGO ABONO DESCRIPCIÓN SALDO N° DOC SUCURSAL',
      '00760473812 PAGO F4168 OPER.',
      '01/06/2026 $ 2.380.000 $ 5.573.115 003500260',
      'G5N CENTRALES',
      'Compra COPEC APP',
      '01/06/2026 $ -300.000 $ 5.009.110 0000000OX O.Gerencia',
      'EMPRESA',
      '77078150-7 transferencia',
      '03/06/2026 $ 7.181.947 $ 12.917.017 003500000 M.Dinero',
      'AUXILIA C',
      'Saldos diarios',
      'FECHA SALDO',
      '03/06/2026 $ 12.917.017',
    ]);

    expect(movements).toHaveLength(3);

    expect(movements[0]).toMatchObject({
      transactionDate: '2026-06-01',
      amount: 2380000,
      referenceId: '00760473812',
      description: 'PAGO F4168 OPER. G5N CENTRALES',
      payerName: 'G5N CENTRALES',
      currency: 'CLP',
    });

    expect(movements[1]).toMatchObject({
      transactionDate: '2026-06-01',
      amount: -300000,
      referenceId: '0000000OX',
      description: 'Compra COPEC APP EMPRESA',
      payerName: 'EMPRESA',
    });

    expect(movements[2]).toMatchObject({
      transactionDate: '2026-06-03',
      amount: 7181947,
      referenceId: '77078150-7',
      description: 'transferencia AUXILIA C',
      payerName: 'AUXILIA C',
    });
  });
});
