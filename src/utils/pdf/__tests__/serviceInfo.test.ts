import { describe, expect, it } from 'vitest';
import jsPDF from 'jspdf';
import { addServiceInfo } from '../sections/serviceInfo';
import type { InspectionPDFData } from '../pdfTypes';

describe('addServiceInfo', () => {
  it('continues below the tallest column for in-situ services', () => {
    const doc = new jsPDF();
    const data = {
      isInSitu: true,
      isFinal: true,
      companyData: {
        businessName: 'Grúas 5 Norte',
        rut: '76.769.841-0',
        address: 'Copiapó',
        phone: '+56 9 62380627',
        email: 'asistencia@gruas5norte.cl',
      },
      service: {
        folio: 'TEST-01',
        serviceDate: '2026-07-24',
        origin: 'Copiapó',
        destination: 'Tierra Amarilla',
        licensePlate: 'PPTT-01',
        vehicleBrand: 'Toyota',
        vehicleModel: 'Hilux',
        client: { name: 'Arrendadora S.A.' },
        crane: { licensePlate: 'TLYF-23' },
        operator: { name: 'Sergio Soto' },
      },
      inspection: {},
    } as InspectionPDFData;

    const nextY = addServiceInfo(doc, data, 54);

    expect(nextY).toBeGreaterThan(100);
  });
});
