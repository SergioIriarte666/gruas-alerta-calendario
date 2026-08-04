/**
 * Armador unico de los montos del informe de servicios.
 *
 * Excel y PDF pintan formatos distintos pero deben informar exactamente los
 * mismos numeros: ambos pasan por aqui. Si un export necesita otra cifra, se
 * agrega aqui, nunca recalculando en el generador.
 */
import { getCoveredAmount, getExcessAmount, getTotalAmount } from '../serviceAmounts';

export interface ServiceReportAmounts {
  /** Monto que se le cobra al cliente principal (aseguradora). */
  covered: number;
  /** Excedente a cargo del tercero. 0 si el servicio no tiene excedente. */
  excess: number;
  /** Valor total del servicio (cubierto + excedente). */
  total: number;
  /** Razon social del tercero que paga el excedente. Vacio si no aplica. */
  excessPayer: string;
}

export interface ServiceReportTotals {
  totalCubierto: number;
  totalExcedente: number;
  totalGeneral: number;
}

const resolveExcessPayer = (service: any, excess: number): string => {
  const name =
    service?.thirdPartyClient?.name ||
    service?.thirdPartyClientName ||
    service?.third_party_client?.name;

  if (name) return name;
  return excess > 0 ? 'Por definir' : '';
};

export const buildServiceReportAmounts = (service: any): ServiceReportAmounts => {
  const excess = getExcessAmount(service);
  return {
    covered: getCoveredAmount(service),
    excess,
    total: getTotalAmount(service),
    excessPayer: resolveExcessPayer(service, excess),
  };
};

export const computeServiceReportTotals = (services: any[]): ServiceReportTotals => {
  const list = Array.isArray(services) ? services : [];
  return {
    totalCubierto: list.reduce((acc, s) => acc + getCoveredAmount(s), 0),
    totalExcedente: list.reduce((acc, s) => acc + getExcessAmount(s), 0),
    totalGeneral: list.reduce((acc, s) => acc + getTotalAmount(s), 0),
  };
};
