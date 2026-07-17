export interface FindicIndicator {
  codigo: string;
  nombre: string;
  unidad_medida: string;
  fecha: string;
  valor: number;
}

export interface FindicSummary {
  version: string;
  fecha: string;
  uf: FindicIndicator;
  dolar: FindicIndicator;
  utm: FindicIndicator;
  euro: FindicIndicator;
  libra_cobre: FindicIndicator;
}

export interface EconomicIndicators {
  uf: FindicIndicator;
  dolar: FindicIndicator;
  utm: FindicIndicator;
  euro: FindicIndicator;
  libra_cobre: FindicIndicator;
  fecha: string;
}
