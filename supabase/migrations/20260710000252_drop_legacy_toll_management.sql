-- El modulo Admin de Tarifas de Peajes (TollManagement) quedo desconectado del
-- calculo real de peajes: useTollCalculationV3 obtiene tarifas oficiales via
-- tollroutes-proxy -> GetAPI calculate-by-path, sin leer estas tablas.
-- route_tolls es una tabla huerfana (FK a toll_stations) sin uso en la app.

DROP VIEW IF EXISTS public.toll_rates_current;
DROP TABLE IF EXISTS public.route_tolls;
DROP TABLE IF EXISTS public.toll_rates;
DROP TABLE IF EXISTS public.toll_stations;
DROP TABLE IF EXISTS public.toll_concessions;
