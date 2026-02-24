export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance_km: number;
  estimated_time_hours: number;
  consumption_factor: number;
  route_type: string;
  difficulty_level: string;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TollStation {
  id: string;
  name: string;
  location: string;
  highway: string | null;
  km_marker: number | null;
  operator_company: string | null;
  payment_methods: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TollRate {
  id: string;
  toll_station_id: string;
  vehicle_category: string;
  rate_amount: number;
  currency: string;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RouteToll {
  id: string;
  route_id: string;
  toll_station_id: string;
  sequence_order: number;
  is_optional: boolean;
  created_at: string;
  toll_stations?: TollStation;
}

export interface FuelPrice {
  id: string;
  fuel_type: string;
  price_per_liter: number;
  currency: string;
  price_date: string;
  region: string | null;
  source: string | null;
  is_current: boolean;
  created_at: string;
  updated_by: string | null;
}

export interface CraneConsumptionRate {
  id: string;
  crane_type: string;
  base_consumption_per_km: number;
  loaded_consumption_factor: number;
  towing_consumption_factor: number;
  fuel_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TransportCostEstimate {
  fuelCost: {
    baseLitersPerKm: number;
    rendimientoKmL: number;
    routeDistance: number;
    consumptionFactor: number;
    currentFuelPrice: number;
    totalLiters: number;
    totalCost: number;
  };
  tollCosts: {
    tolls: Array<{ name: string; amount: number }>;
    craneTolls: number;
    vehicleTolls: number;
    totalTolls: number;
  };
  additionalCosts: {
    operatorPerDiem: number;
    vehicleWear: number;
    total: number;
  };
  totalEstimate: number;
}

export type CraneTypeLabel = {
  value: string;
  label: string;
};

export const CRANE_TYPE_LABELS: CraneTypeLabel[] = [
  { value: 'light', label: 'Liviana' },
  { value: 'medium', label: 'Mediana' },
  { value: 'heavy', label: 'Pesada' },
  { value: 'horquilla', label: 'Horquilla' },
  { value: 'taxi', label: 'Taxi' },
];
