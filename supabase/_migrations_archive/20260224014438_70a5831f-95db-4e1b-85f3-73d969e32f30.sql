
-- =============================================
-- FASE 1: Sistema de Costos de Transporte
-- 6 tablas nuevas con RLS + datos seed
-- =============================================

-- 1. Maestro de Rutas
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  distance_km NUMERIC NOT NULL DEFAULT 0,
  estimated_time_hours NUMERIC NOT NULL DEFAULT 0,
  consumption_factor NUMERIC NOT NULL DEFAULT 1.0,
  route_type TEXT NOT NULL DEFAULT 'highway',
  difficulty_level TEXT NOT NULL DEFAULT 'normal',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "routes_auth_only" ON public.routes
  FOR ALL USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- 2. Maestro de Peajes
CREATE TABLE public.toll_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  highway TEXT,
  km_marker NUMERIC,
  operator_company TEXT,
  payment_methods TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.toll_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "toll_stations_auth_only" ON public.toll_stations
  FOR ALL USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- 3. Tarifas de Peaje por categoría
CREATE TABLE public.toll_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toll_station_id UUID NOT NULL REFERENCES public.toll_stations(id) ON DELETE CASCADE,
  vehicle_category TEXT NOT NULL,
  rate_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'CLP',
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.toll_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "toll_rates_auth_only" ON public.toll_rates
  FOR ALL USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- 4. Relación Ruta-Peajes (N:M)
CREATE TABLE public.route_tolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  toll_station_id UUID NOT NULL REFERENCES public.toll_stations(id) ON DELETE CASCADE,
  sequence_order INTEGER NOT NULL DEFAULT 1,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.route_tolls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "route_tolls_auth_only" ON public.route_tolls
  FOR ALL USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- 5. Histórico de Precios de Combustible
CREATE TABLE public.fuel_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_type TEXT NOT NULL DEFAULT 'diesel',
  price_per_liter NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CLP',
  price_date DATE NOT NULL DEFAULT CURRENT_DATE,
  region TEXT DEFAULT 'Nacional',
  source TEXT DEFAULT 'manual',
  is_current BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.fuel_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fuel_prices_auth_only" ON public.fuel_prices
  FOR ALL USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- 6. Tasas de Consumo por Tipo de Grúa
CREATE TABLE public.crane_consumption_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crane_type TEXT NOT NULL,
  base_consumption_per_km NUMERIC NOT NULL,
  loaded_consumption_factor NUMERIC NOT NULL DEFAULT 1.3,
  towing_consumption_factor NUMERIC NOT NULL DEFAULT 1.5,
  fuel_type TEXT NOT NULL DEFAULT 'diesel',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crane_consumption_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crane_consumption_rates_auth_only" ON public.crane_consumption_rates
  FOR ALL USING (auth.role() = 'authenticated'::text)
  WITH CHECK (auth.role() = 'authenticated'::text);

-- =============================================
-- Triggers para updated_at
-- =============================================
CREATE TRIGGER update_routes_updated_at
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_toll_stations_updated_at
  BEFORE UPDATE ON public.toll_stations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_toll_rates_updated_at
  BEFORE UPDATE ON public.toll_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crane_consumption_rates_updated_at
  BEFORE UPDATE ON public.crane_consumption_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Datos Seed: Consumo por tipo de grúa
-- =============================================
INSERT INTO public.crane_consumption_rates (crane_type, base_consumption_per_km, loaded_consumption_factor, towing_consumption_factor, fuel_type) VALUES
  ('light', 0.25, 1.2, 1.3, 'diesel'),
  ('medium', 0.35, 1.3, 1.5, 'diesel'),
  ('heavy', 0.45, 1.4, 1.6, 'diesel'),
  ('horquilla', 0.30, 1.2, 1.4, 'diesel'),
  ('taxi', 0.20, 1.1, 1.2, 'diesel');

-- Seed: Precio inicial de diesel
INSERT INTO public.fuel_prices (fuel_type, price_per_liter, price_date, region, source, is_current) VALUES
  ('diesel', 780, CURRENT_DATE, 'Nacional', 'manual', true);
