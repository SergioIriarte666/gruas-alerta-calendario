
DO $$
BEGIN
    -- Add unique constraints safely if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_rut_key' AND conrelid = 'public.clients'::regclass) THEN
        ALTER TABLE public.clients ADD CONSTRAINT clients_rut_key UNIQUE (rut);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cranes_license_plate_key' AND conrelid = 'public.cranes'::regclass) THEN
        ALTER TABLE public.cranes ADD CONSTRAINT cranes_license_plate_key UNIQUE (license_plate);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operators_rut_key' AND conrelid = 'public.operators'::regclass) THEN
        ALTER TABLE public.operators ADD CONSTRAINT operators_rut_key UNIQUE (rut);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_types_name_key' AND conrelid = 'public.service_types'::regclass) THEN
        ALTER TABLE public.service_types ADD CONSTRAINT service_types_name_key UNIQUE (name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_folio_key' AND conrelid = 'public.services'::regclass) THEN
        ALTER TABLE public.services ADD CONSTRAINT services_folio_key UNIQUE (folio);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_folio_key' AND conrelid = 'public.invoices'::regclass) THEN
        ALTER TABLE public.invoices ADD CONSTRAINT invoices_folio_key UNIQUE (folio);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'costs_description_date_key' AND conrelid = 'public.costs'::regclass) THEN
        ALTER TABLE public.costs ADD CONSTRAINT costs_description_date_key UNIQUE (description, date);
    END IF;
END;
$$;

-- Este script agrega datos de prueba. Para evitar errores, se omitirán inserciones si ya existen registros con el mismo RUT o patente.
DO $$
DECLARE
    -- IDs para nuevos clientes
    client1_id uuid := 'a1b2c3d4-e5f6-7890-1234-567890abcdef';
    client2_id uuid := 'b2c3d4e5-f6a1-2345-6789-012345abcdef';
    client3_id uuid := 'c3d4e5f6-a1b2-3456-7890-123456abcdef';
    client4_id uuid := 'd4e5f6a1-b2c3-4567-8901-234567abcdef';
    client5_id uuid := 'e5f6a1b2-c3d4-5678-9012-345678abcdef';

    -- IDs para nuevas grúas
    crane1_id uuid := 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6';
    crane2_id uuid := 'a2b3c4d5-e6f7-a8b9-c0d1-e2f3a4b5c6d7';
    crane3_id uuid := 'b3c4d5e6-f7a8-b9c0-d1e2-f3a4b5c6d7e8';
    crane4_id uuid := 'c4d5e6f7-a8b9-c0d1-e2f3-a4b5c6d7e8f9';
    
    -- IDs para nuevos operadores
    operator1_id uuid := 'd5e6f7a8-b9c0-d1e2-f3a4-b5c6d7e8f9a0';
    operator2_id uuid := 'e6f7a8b9-c0d1-e2f3-a4b5-c6d7e8f9a0b1';
    operator3_id uuid := 'f7a8b9c0-d1e2-f3a4-b5c6-d7e8f9a0b1c2';

    -- IDs para nuevos tipos de servicio
    svctype1_id uuid := 'a8b9c0d1-e2f3-a4b5-c6d7-e8f9a0b1c2d3';
    svctype2_id uuid := 'b9c0d1e2-f3a4-b5c6-d7e8-f9a0b1c2d3e4';
    svctype3_id uuid := 'c0d1e2f3-a4b5-c6d7-e8f9-a0b1c2d3e4f5';

    -- IDs para facturas
    invoice_id_200 uuid := 'e1e2e3e4-e5e6-e7e8-e9e0-e1e2e3e4e5e6';
    invoice_id_201 uuid := 'f1f2f3f4-f5f6-f7f8-f9f0-f1f2f3f4f5f6';
    invoice_id_202 uuid := 'a1a2a3a4-a5a6-a7a8-a9a0-a1a2a3a4a5a6';
    invoice_id_203 uuid := 'b1b2b3b4-b5b6-b7b8-b9b0-b1b2b3b4b5b6';
    invoice_id_204 uuid := 'c1c2c3c4-c5c6-c7c8-c9c0-c1c2c3c4c5c6';

    -- IDs de entidades existentes para mezclar
    existing_client_id uuid;
    existing_crane_id uuid;
    existing_operator_id uuid;
    existing_svctype_id uuid;
    cost_category_id_fuel uuid;
    cost_category_id_maintenance uuid;
    
    -- IDs de servicios para facturar
    service_id_1020 uuid;
    service_id_1021 uuid;
    service_id_1022 uuid;
    service_id_1023 uuid;
    service_id_1026 uuid;

BEGIN
    -- Obtener IDs de entidades existentes
    SELECT id INTO existing_client_id FROM clients ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO existing_crane_id FROM cranes ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO existing_operator_id FROM operators ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO existing_svctype_id FROM service_types ORDER BY created_at DESC LIMIT 1;
    SELECT id INTO cost_category_id_fuel FROM cost_categories WHERE name = 'Combustible' LIMIT 1;
    SELECT id INTO cost_category_id_maintenance FROM cost_categories WHERE name = 'Mantenimiento' LIMIT 1;

    -- Insertar datos de la empresa (si no existen)
    INSERT INTO public.company_data (id, business_name, rut, address, phone, email, website, folio_format, invoice_due_days, vat_percentage, alert_days)
    VALUES ('a0b1c2d3-e4f5-a6b7-c8d9-e0f1a2b3c4d5', 'TMS Grúas SPA', '76.123.456-K', 'Avenida Siempreviva 742, Santiago', '+56221234567', 'contacto@tmsgruas.cl', 'https://www.tmsgruas.cl', 'SRV-{number}', 30, 19.0, 30)
    ON CONFLICT (id) DO NOTHING;
    
    -- Insertar nuevos clientes
    INSERT INTO public.clients (id, name, rut, phone, email, address, is_active) VALUES
    (client1_id, 'Constructora XYZ', '76.123.456-7', '+56987654321', 'contacto@constructoraxyz.cl', 'Av. Vitacura 2929, Santiago', true),
    (client2_id, 'Minerals Inc.', '77.234.567-8', '+56212345678', 'ops@mineralsinc.com', 'Panamericana Norte Km 18, Antofagasta', true),
    (client3_id, 'Transportes Veloz', '78.345.678-9', '+56912348765', 'logistica@tveloz.cl', 'Ruta 5 Sur Km 250, Talca', true),
    (client4_id, 'Energías del Sur', '79.456.789-0', '+56451234567', 'proyectos@energisur.cl', 'Av. Alemania 012, Temuco', false),
    (client5_id, 'Agro S.A.', '80.567.890-1', '+56988887777', 'bodega@agrosa.cl', 'Camino a Melipilla 1234, Maipú', true)
    ON CONFLICT (rut) DO NOTHING;

    -- Insertar nuevas grúas
    INSERT INTO public.cranes (id, license_plate, brand, model, type, circulation_permit_expiry, insurance_expiry, technical_review_expiry, is_active) VALUES
    (crane1_id, 'GHJK12', 'Liebherr', 'LTM 1050', 'heavy', (NOW() + interval '6 months')::date, (NOW() + interval '11 months')::date, (NOW() + interval '3 months')::date, true),
    (crane2_id, 'LMNP34', 'Tadano', 'GR-800EX', 'heavy', (NOW() + interval '8 months')::date, (NOW() + interval '2 months')::date, (NOW() + interval '5 months')::date, true),
    (crane3_id, 'QRST56', 'Manitowoc', 'GMK4100L', 'medium', (NOW() + interval '1 months')::date, (NOW() + interval '4 months')::date, (NOW() + interval '9 months')::date, true),
    (crane4_id, 'UVWX78', 'Ford', 'F-150 Grúa', 'taxi', (NOW() - interval '1 months')::date, (NOW() + interval '1 months')::date, (NOW() - interval '2 weeks')::date, false)
    ON CONFLICT (license_plate) DO NOTHING;

    -- Insertar nuevos operadores
    INSERT INTO public.operators (id, name, rut, phone, license_number, exam_expiry, is_active) VALUES
    (operator1_id, 'Carlos Pérez', '15.123.456-7', '+56987651234', 'A5-12345', (NOW() + interval '1 year')::date, true),
    (operator2_id, 'Luisa Martínez', '16.234.567-8', '+56912348765', 'A4-67890', (NOW() + interval '2 years')::date, true),
    (operator3_id, 'Jorge Díaz', '17.345.678-9', '+56955554444', 'A5-54321', (NOW() - interval '2 months')::date, false)
    ON CONFLICT (rut) DO NOTHING;

    -- Insertar nuevos tipos de servicio
    INSERT INTO public.service_types (id, name, description, is_active) VALUES
    (svctype1_id, 'Montaje Industrial', 'Montaje de maquinaria y estructuras pesadas', true),
    (svctype2_id, 'Izar Carga Especial', 'Izar cargas con dimensiones o pesos fuera de lo común', true),
    (svctype3_id, 'Rescate Vehicular Pesado', 'Rescate de camiones y maquinaria pesada', true)
    ON CONFLICT (name) DO NOTHING;

    -- Insertar servicios
    INSERT INTO public.services (folio, request_date, service_date, client_id, vehicle_brand, vehicle_model, license_plate, origin, destination, service_type_id, value, crane_id, operator_id, status, operator_commission, observations) VALUES
    ('SRV-1020', (NOW() - interval '25 days')::date, (NOW() - interval '24 days')::date, client1_id, 'Komatsu', 'PC200', 'N/A', 'Bodega Central', 'Proyecto A', svctype1_id, 850000, crane1_id, operator1_id, 'completed', 85000, 'Servicio completado sin incidentes.'),
    ('SRV-1021', (NOW() - interval '22 days')::date, (NOW() - interval '22 days')::date, client2_id, 'Volvo', 'FH16', 'PPU-9876', 'Puerto Angamos', 'Minera Escondida', svctype2_id, 1200000, crane2_id, operator2_id, 'completed', 120000, ''),
    ('SRV-1022', (NOW() - interval '20 days')::date, (NOW() - interval '19 days')::date, client3_id, 'Caterpillar', 'D8T', 'N/A', 'Fundo El Sauce', 'Fundo El Roble', existing_svctype_id, 450000, existing_crane_id, existing_operator_id, 'completed', 45000, 'Cliente solicitó factura de inmediato.'),
    ('SRV-1023', (NOW() - interval '18 days')::date, (NOW() - interval '18 days')::date, client1_id, 'Mercedes-Benz', 'Actros', 'ABCD-12', 'Centro Logístico', 'Sucursal Norte', existing_svctype_id, 300000, crane3_id, operator1_id, 'completed', 30000, ''),
    ('SRV-1024', (NOW() - interval '15 days')::date, (NOW() - interval '14 days')::date, client4_id, 'Scania', 'R450', 'EFGH-34', 'Puerto San Vicente', 'Parque Eólico', svctype1_id, 950000, crane1_id, operator2_id, 'completed', 95000, 'Cancelado por cliente, se cobra 50%.'),
    ('SRV-1025', (NOW() - interval '15 days')::date, (NOW() - interval '15 days')::date, client4_id, 'Scania', 'R450', 'EFGH-34', 'Puerto San Vicente', 'Parque Eólico', svctype1_id, 950000, crane1_id, operator2_id, 'cancelled', 0, 'Cliente canceló por mal tiempo.'),
    ('SRV-1026', (NOW() - interval '12 days')::date, (NOW() - interval '11 days')::date, client5_id, 'John Deere', 'S780', 'N/A', 'Campo 1', 'Silo Principal', svctype3_id, 600000, crane3_id, existing_operator_id, 'completed', 60000, ''),
    ('SRV-1027', (NOW() - interval '10 days')::date, (NOW() - interval '9 days')::date, COALESCE(existing_client_id, client1_id), 'Ford', 'Cargo', 'IJKL-56', 'Bodega Maipú', 'Bodega Pudahuel', existing_svctype_id, 250000, existing_crane_id, operator1_id, 'completed', 25000, ''),
    ('SRV-1028', (NOW() - interval '8 days')::date, (NOW() - interval '8 days')::date, client1_id, 'Generador', 'G-500', 'N/A', 'Taller', 'Obra Edificio B', svctype1_id, 750000, crane2_id, operator2_id, 'completed', 75000, ''),
    ('SRV-1029', (NOW() - interval '7 days')::date, (NOW() - interval '6 days')::date, client2_id, 'Contenedor 40ft', 'SEAU1234567', 'N/A', 'Puerto Coronel', 'Zona Franca', svctype2_id, 1500000, crane1_id, operator1_id, 'completed', 150000, 'Requiere escolta.'),
    ('SRV-1030', (NOW() - interval '5 days')::date, (NOW() - interval '4 days')::date, client3_id, 'Bus', 'Marcopolo', 'MNOP-78', 'Terminal de Buses', 'Taller Central', svctype3_id, 550000, crane3_id, operator2_id, 'in_progress', 55000, 'Servicio en curso.'),
    ('SRV-1031', (NOW() - interval '3 days')::date, (NOW() - interval '2 days')::date, COALESCE(existing_client_id, client2_id), 'Toyota', 'Hilux', 'QRST-90', 'Faena Minera', 'Taller', existing_svctype_id, 350000, existing_crane_id, existing_operator_id, 'in_progress', 35000, 'En espera de repuestos.'),
    ('SRV-1032', (NOW() - interval '2 days')::date, NOW()::date, client5_id, 'Tractor', 'Massey Ferguson', 'N/A', 'Viña Santa Rita', 'Taller Agrícola', svctype3_id, 400000, crane3_id, operator1_id, 'pending', 40000, 'Confirmado para mañana.'),
    ('SRV-1033', (NOW() - interval '1 day')::date, (NOW() + interval '1 day')::date, client1_id, 'Viga de acero', 'L=12m', 'N/A', 'Aceros AZA', 'Construcción Mall', svctype1_id, 1100000, crane1_id, operator2_id, 'pending', 110000, 'Coordinar con jefe de obra.'),
    ('SRV-1034', (NOW())::date, (NOW() + interval '2 days')::date, client2_id, 'Bomba de agua', 'X-9000', 'N/A', 'Planta 1', 'Planta 2', svctype2_id, 1300000, crane2_id, operator1_id, 'pending', 130000, ''),
    ('SRV-1035', NOW()::date, (NOW() + interval '3 days')::date, client1_id, 'Container Oficina', 'MOD-123', 'N/A', 'Bodega', 'Obra Costanera', existing_svctype_id, 450000, crane3_id, operator2_id, 'pending', 45000, '')
    ON CONFLICT (folio) DO NOTHING;

    -- Insertar costos para algunos servicios
    IF cost_category_id_fuel IS NOT NULL THEN
        INSERT INTO public.costs (date, description, amount, category_id, service_folio) VALUES
        ((NOW() - interval '24 days')::date, 'Combustible SRV-1020', 50000, cost_category_id_fuel, 'SRV-1020'),
        ((NOW() - interval '22 days')::date, 'Combustible SRV-1021', 80000, cost_category_id_fuel, 'SRV-1021'),
        ((NOW() - interval '9 days')::date, 'Combustible SRV-1027', 25000, cost_category_id_fuel, 'SRV-1027'),
        ((NOW() - interval '6 days')::date, 'Combustible SRV-1029', 120000, cost_category_id_fuel, 'SRV-1029')
        ON CONFLICT (description, date) DO NOTHING;
    END IF;
    IF cost_category_id_maintenance IS NOT NULL THEN
        INSERT INTO public.costs (date, description, amount, category_id, crane_id) VALUES
        ((NOW() - interval '15 days')::date, 'Cambio de aceite grúa GHJK12', 150000, cost_category_id_maintenance, crane1_id)
        ON CONFLICT (description, date) DO NOTHING;
    END IF;

    -- Obtener IDs de servicios para facturar
    SELECT id INTO service_id_1020 FROM services WHERE folio = 'SRV-1020' LIMIT 1;
    SELECT id INTO service_id_1021 FROM services WHERE folio = 'SRV-1021' LIMIT 1;
    SELECT id INTO service_id_1022 FROM services WHERE folio = 'SRV-1022' LIMIT 1;
    SELECT id INTO service_id_1023 FROM services WHERE folio = 'SRV-1023' LIMIT 1;
    SELECT id INTO service_id_1026 FROM services WHERE folio = 'SRV-1026' LIMIT 1;

    -- Insertar Facturas
    INSERT INTO public.invoices (id, folio, client_id, issue_date, due_date, subtotal, vat, total, status) VALUES
    (invoice_id_200, 'FAC-200', client1_id, (NOW() - interval '20 days')::date, (NOW() + interval '10 days')::date, 850000, 161500, 1011500, 'sent'),
    (invoice_id_201, 'FAC-201', client2_id, (NOW() - interval '18 days')::date, (NOW() + interval '12 days')::date, 1200000, 228000, 1428000, 'sent'),
    (invoice_id_202, 'FAC-202', client3_id, (NOW() - interval '15 days')::date, (NOW() - interval '5 days')::date, 450000, 85500, 535500, 'overdue'),
    (invoice_id_203, 'FAC-203', client1_id, (NOW() - interval '10 days')::date, (NOW() + interval '20 days')::date, 300000, 57000, 357000, 'draft'),
    (invoice_id_204, 'FAC-204', client5_id, (NOW() - interval '5 days')::date, (NOW() + interval '25 days')::date, 600000, 114000, 714000, 'paid')
    ON CONFLICT (folio) DO NOTHING;
    UPDATE public.invoices SET payment_date = (NOW() - interval '2 days')::date WHERE folio = 'FAC-204';
    
    -- Vincular servicios a facturas
    IF service_id_1020 IS NOT NULL THEN INSERT INTO public.invoice_services (invoice_id, service_id) VALUES (invoice_id_200, service_id_1020) ON CONFLICT (invoice_id, service_id) DO NOTHING; END IF;
    IF service_id_1021 IS NOT NULL THEN INSERT INTO public.invoice_services (invoice_id, service_id) VALUES (invoice_id_201, service_id_1021) ON CONFLICT (invoice_id, service_id) DO NOTHING; END IF;
    IF service_id_1022 IS NOT NULL THEN INSERT INTO public.invoice_services (invoice_id, service_id) VALUES (invoice_id_202, service_id_1022) ON CONFLICT (invoice_id, service_id) DO NOTHING; END IF;
    IF service_id_1023 IS NOT NULL THEN INSERT INTO public.invoice_services (invoice_id, service_id) VALUES (invoice_id_203, service_id_1023) ON CONFLICT (invoice_id, service_id) DO NOTHING; END IF;
    IF service_id_1026 IS NOT NULL THEN INSERT INTO public.invoice_services (invoice_id, service_id) VALUES (invoice_id_204, service_id_1026) ON CONFLICT (invoice_id, service_id) DO NOTHING; END IF;
END $$;
