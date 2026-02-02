
export interface ReportColumnConfig {
  visible: boolean;
  width: number;
  label: string;
}

export interface ReportColumnsConfig {
  columns: {
    fecha: ReportColumnConfig;
    folio: ReportColumnConfig;
    cliente: ReportColumnConfig;
    asegurado: ReportColumnConfig;
    cotizacion: ReportColumnConfig;
    oc: ReportColumnConfig;
    factura: ReportColumnConfig;
    tipoServicio: ReportColumnConfig;
    patente: ReportColumnConfig;
    origen: ReportColumnConfig;
    destino: ReportColumnConfig;
    estado: ReportColumnConfig;
    valorBase: ReportColumnConfig;
    valorCustodia: ReportColumnConfig;
    valor: ReportColumnConfig;
  };
}

export type ColumnKey = keyof ReportColumnsConfig['columns'];

export const defaultReportColumnConfig: ReportColumnsConfig = {
  columns: {
    fecha: { visible: true, width: 5, label: 'Fecha' },
    folio: { visible: true, width: 5, label: 'Folio' },
    cliente: { visible: true, width: 10, label: 'Cliente' },
    asegurado: { visible: true, width: 10, label: 'Asegurado' },
    cotizacion: { visible: true, width: 5, label: 'Cotización' },
    oc: { visible: true, width: 4, label: 'OC' },
    factura: { visible: true, width: 4, label: 'Factura' },
    tipoServicio: { visible: true, width: 7, label: 'Tipo Servicio' },
    patente: { visible: true, width: 6, label: 'Patente' },
    origen: { visible: true, width: 10, label: 'Origen' },
    destino: { visible: true, width: 10, label: 'Destino' },
    estado: { visible: true, width: 5, label: 'Estado' },
    valorBase: { visible: true, width: 6, label: 'Servicio' },
    valorCustodia: { visible: true, width: 6, label: 'Custodia' },
    valor: { visible: true, width: 7, label: 'Total' }
  }
};

export const columnOrder: ColumnKey[] = [
  'fecha', 'folio', 'cliente', 'asegurado', 'cotizacion', 'oc', 'factura',
  'tipoServicio', 'patente', 'origen', 'destino', 'estado', 'valorBase', 'valorCustodia', 'valor'
];
