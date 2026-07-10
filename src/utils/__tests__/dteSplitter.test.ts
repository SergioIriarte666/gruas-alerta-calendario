import { describe, expect, it } from 'vitest';
import { splitDteXmlString } from '@/utils/xml/dteSplitter';

const buildDte = (tipoDte: string, folio: string, issueDate: string) => `
<DTE version="1.0">
  <Documento ID="T${tipoDte}F${folio}">
    <Encabezado>
      <IdDoc>
        <TipoDTE>${tipoDte}</TipoDTE>
        <Folio>${folio}</Folio>
        <FchEmis>${issueDate}</FchEmis>
      </IdDoc>
      <Emisor><RUTEmisor>11111111-1</RUTEmisor><RznSoc>Proveedor</RznSoc></Emisor>
      <Receptor><RUTRecep>22222222-2</RUTRecep><RznSocRecep>Cliente</RznSocRecep></Receptor>
      <Totales><MntTotal>1000</MntTotal></Totales>
    </Encabezado>
  </Documento>
</DTE>`;

describe('splitDteXmlString', () => {
  it('separa un SetDTE en archivos individuales por factura', () => {
    const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<SetDTE>
  ${buildDte('33', '6734292', '2026-07-09')}
  ${buildDte('34', '25', '2026-07-08')}
  ${buildDte('33', '6161', '2026-07-08')}
  ${buildDte('33', '6157', '2026-07-07')}
</SetDTE>`;

    const result = splitDteXmlString(xml);

    expect(result.errors).toEqual([]);
    expect(result.documents).toHaveLength(4);
    expect(result.documents.map(doc => doc.fileName)).toEqual([
      'Factura_T33_F6734292_2026-07-09.xml',
      'Factura_T34_F25_2026-07-08.xml',
      'Factura_T33_F6161_2026-07-08.xml',
      'Factura_T33_F6157_2026-07-07.xml',
    ]);
    expect(result.documents[0].content).toContain('<SetDTE>');
    expect(result.documents[0].content).toContain('<Folio>6734292</Folio>');
    expect(result.documents[0].content).not.toContain('<Folio>25</Folio>');
  });

  it('devuelve error si el XML no contiene documentos DTE', () => {
    const result = splitDteXmlString('<root><item>sin DTE</item></root>');

    expect(result.documents).toHaveLength(0);
    expect(result.errors).toEqual(['No se encontraron facturas DTE en el XML']);
  });
});
