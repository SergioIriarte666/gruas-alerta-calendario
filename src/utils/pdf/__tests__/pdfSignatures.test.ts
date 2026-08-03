import { describe, expect, it } from 'vitest';
import jsPDF from 'jspdf';
import { addDigitalSignatures } from '../pdfSignatures';
import type { InspectionPDFData } from '../pdfTypes';
import type { Service } from '@/types';

const service = (operatorRut?: string) => ({
  id: 'srv-1',
  folio: '3266120-1',
  operator: operatorRut === undefined
    ? { id: 'op-1', name: 'Rodrigo Del Saz' }
    : { id: 'op-1', name: 'Rodrigo Del Saz', rut: operatorRut },
} as unknown as Service);

const render = async (
  inspection: InspectionPDFData['inspection'],
  isFinal: boolean,
  operatorRut: string | undefined = '11.111.111-1',
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  await addDigitalSignatures(
    doc,
    {
      service: service(operatorRut),
      inspection,
      companyData: {
        businessName: 'Grúas 5 Norte',
        rut: '76.123.456-7',
        address: 'Copiapó',
        phone: '+56 9 0000 0000',
        email: 'contacto@gruas5norte.cl',
      },
      isFinal,
    },
    20,
  );
  return (doc.output('blob') as Blob).text();
};

/**
 * El acta del folio 3266120-1 imprimía solo el nombre bajo cada firma: el RUT
 * estaba persistido y nunca llegaba al papel, así que el documento no
 * identificaba a quien firmaba.
 */
describe('addDigitalSignatures', () => {
  it('el acta de pre-servicio imprime el RUT del operador y el de quien entrega', async () => {
    const text = await render(
      {
        operatorName: 'Rodrigo Del Saz',
        clientName: 'Alberto Pino',
        clientRut: '28.906.009-K',
      },
      false,
    );

    expect(text).toContain('RUT 11.111.111-1');
    expect(text).toContain('RUT 28.906.009-K');
  });

  it('el acta de entrega identifica a quien RECIBE, no a quien entregó', async () => {
    const text = await render(
      {
        clientName: 'Alberto Pino',
        clientRut: '28.906.009-K',
        receptionPersonName: 'Marcela Rojas',
        receptionPersonRut: '15.222.333-4',
      },
      true,
    );

    expect(text).toContain('RUT 15.222.333-4');
    expect(text).not.toContain('28.906.009-K');
  });

  it('normaliza el RUT capturado sin puntos', async () => {
    const text = await render(
      { clientName: 'Alberto Pino', clientRut: '28906009k' },
      false,
    );

    expect(text).toContain('RUT 28.906.009-K');
  });

  // Un hueco en blanco hizo creer que el dato no existía en la base. Si falta,
  // el acta lo dice.
  it('dice que el RUT falta en vez de dejar el espacio vacío', async () => {
    const text = await render(
      { operatorName: 'Rodrigo Del Saz', clientName: 'Alberto Pino' },
      false,
      undefined,
    );

    expect(text).toContain('RUT no registrado');
  });
});
