# TMS Local-First Build Prompt

> **Prompt completo para construir un Sistema de Gestión de Transporte (TMS) desde cero con arquitectura local-first**

---

## 1. Contexto del Proyecto

### Descripción General
Sistema de Gestión de Transporte (TMS) diseñado para empresas de servicios de grúas en Chile. El sistema debe funcionar **100% offline** como modo principal, con sincronización opcional a un backend self-hosted.

### Requisitos Clave
- **Local-First**: Toda la funcionalidad debe estar disponible sin conexión a internet
- **Datos Locales**: IndexedDB como almacenamiento principal
- **Sincronización Opcional**: Supabase Self-Hosted (Docker) para sincronización entre dispositivos
- **PWA**: Instalable en dispositivos móviles y desktop
- **Multi-usuario**: Soporte para diferentes roles (admin, operador, contador)

### Público Objetivo
- Empresas de grúas y transporte pesado
- Operadores en terreno (sin conexión frecuente)
- Personal administrativo
- Contadores y finanzas

---

## 2. Stack Tecnológico Requerido

### Frontend (Obligatorio)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "@tanstack/react-query": "^5.56.2",
    "react-hook-form": "^7.53.0",
    "zod": "^3.23.8",
    "@hookform/resolvers": "^3.9.0",
    "tailwindcss": "^3.4.0",
    "tailwindcss-animate": "^1.0.7",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-select": "^2.1.1",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-popover": "^1.1.1",
    "@radix-ui/react-toast": "^1.2.1",
    "@radix-ui/react-dropdown-menu": "^2.1.1",
    "@radix-ui/react-accordion": "^1.2.0",
    "@radix-ui/react-alert-dialog": "^1.1.1",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-label": "^2.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.4",
    "@radix-ui/react-scroll-area": "^1.1.0",
    "@radix-ui/react-progress": "^1.1.0",
    "lucide-react": "^0.462.0",
    "recharts": "^2.15.4",
    "date-fns": "^4.1.0",
    "date-fns-tz": "^3.2.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "cmdk": "^1.0.0",
    "sonner": "^1.5.0",
    "jspdf": "^3.0.1",
    "jspdf-autotable": "^5.0.2",
    "xlsx": "^0.18.5",
    "papaparse": "^5.5.3",
    "react-day-picker": "^8.10.1",
    "react-dropzone": "^14.3.8",
    "react-signature-canvas": "^1.1.0-alpha.2",
    "embla-carousel-react": "^8.3.0",
    "vaul": "^0.9.3",
    "input-otp": "^1.2.4"
  }
}
```

### Base de Datos Local (Obligatorio)

```typescript
// Usar API nativa de IndexedDB (IDBDatabase)
// NO usar Dexie.js para mantener control total

const DB_NAME = 'TMSLocalDB';
const DB_VERSION = 1;

// Stores principales
const STORES = {
  // Datos maestros
  PROFILES: 'profiles',
  CLIENTS: 'clients',
  CRANES: 'cranes',
  OPERATORS: 'operators',
  SUPPLIERS: 'suppliers',
  
  // Operaciones
  SERVICES: 'services',
  COSTS: 'costs',
  INCOMES: 'incomes',
  INVOICES: 'invoices',
  
  // Inventario
  INVENTORY_ITEMS: 'inventoryItems',
  INVENTORY_MOVEMENTS: 'inventoryMovements',
  INVENTORY_STOCK: 'inventoryStock',
  
  // Sistema
  OFFLINE_ACTIONS: 'offlineActions',
  SYNC_LOG: 'syncLog',
  USER_PROFILE: 'userProfile',
  SETTINGS: 'settings',
  OFFLINE_COUNTER: 'offlineCounter'
};
```

### Backend Opcional (Supabase Self-Hosted)

```yaml
# docker-compose.yml para Supabase Self-Hosted
version: '3.8'

services:
  postgres:
    image: supabase/postgres:15.1.0.117
    ports:
      - '5432:5432'
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - postgres-data:/var/lib/postgresql/data

  supabase-studio:
    image: supabase/studio:latest
    ports:
      - '3000:3000'
    environment:
      SUPABASE_URL: http://kong:8000
      STUDIO_PG_META_URL: http://meta:8080
      SUPABASE_ANON_KEY: ${ANON_KEY}
      SUPABASE_SERVICE_KEY: ${SERVICE_ROLE_KEY}

  kong:
    image: kong:2.8.1
    ports:
      - '8000:8000'
      - '8443:8443'
    environment:
      KONG_DATABASE: 'off'
      KONG_DECLARATIVE_CONFIG: /var/lib/kong/kong.yml

  gotrue:
    image: supabase/gotrue:v2.99.0
    environment:
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@postgres:5432/postgres
      GOTRUE_SITE_URL: ${SITE_URL}
      GOTRUE_JWT_SECRET: ${JWT_SECRET}

  realtime:
    image: supabase/realtime:v2.25.35
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_USER: supabase_admin
      DB_PASSWORD: ${POSTGRES_PASSWORD}

  storage:
    image: supabase/storage-api:v0.40.4
    environment:
      POSTGREST_URL: http://rest:3000
      PGRST_JWT_SECRET: ${JWT_SECRET}
      DATABASE_URL: postgres://supabase_storage_admin:${POSTGRES_PASSWORD}@postgres:5432/postgres

  meta:
    image: supabase/postgres-meta:v0.68.0
    environment:
      PG_META_PORT: 8080
      PG_META_DB_HOST: postgres
      PG_META_DB_PASSWORD: ${POSTGRES_PASSWORD}

volumes:
  postgres-data:
```

---

## 3. Esquema de Base de Datos Completo

### 3.1 Tablas Core

```sql
-- =============================================
-- PERFILES Y AUTENTICACIÓN
-- =============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'operator', 'accountant', 'user')),
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CLIENTES
-- =============================================

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rut TEXT NOT NULL UNIQUE,
  department TEXT NOT NULL, -- Región/Comuna
  address TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  default_payment_term_id UUID REFERENCES payment_terms(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_rut ON clients(rut);
CREATE INDEX idx_clients_name ON clients(name);

-- =============================================
-- GRÚAS
-- =============================================

CREATE TYPE crane_type AS ENUM (
  'Grúa Pluma',
  'Grúa Horquilla', 
  'Camión Pluma',
  'Grúa Articulada',
  'Grúa Telescópica',
  'Manipulador Telescópico'
);

CREATE TABLE cranes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_plate TEXT NOT NULL UNIQUE,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  type crane_type NOT NULL,
  capacity_tons NUMERIC(10,2),
  year INTEGER,
  technical_review_expiry DATE NOT NULL,
  insurance_expiry DATE NOT NULL,
  circulation_permit_expiry DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cranes_license_plate ON cranes(license_plate);
CREATE INDEX idx_cranes_type ON cranes(type);

-- =============================================
-- OPERADORES
-- =============================================

CREATE TABLE operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rut TEXT NOT NULL UNIQUE,
  phone TEXT,
  email TEXT,
  address TEXT,
  license_type TEXT NOT NULL,
  license_expiry DATE NOT NULL,
  contract_type TEXT DEFAULT 'indefinido',
  hire_date DATE,
  base_salary NUMERIC(12,2),
  commission_percentage NUMERIC(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  bank_name TEXT,
  bank_account_type TEXT,
  bank_account_number TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_operators_rut ON operators(rut);
CREATE INDEX idx_operators_name ON operators(name);

-- =============================================
-- PROVEEDORES
-- =============================================

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rut TEXT UNIQUE,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  payment_terms TEXT,
  bank_name TEXT,
  bank_account_type TEXT,
  bank_account_number TEXT,
  category TEXT, -- 'combustible', 'repuestos', 'servicios', 'otros'
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_suppliers_rut ON suppliers(rut);
CREATE INDEX idx_suppliers_category ON suppliers(category);
```

### 3.2 Tablas de Servicios

```sql
-- =============================================
-- TIPOS DE SERVICIO
-- =============================================

CREATE TABLE service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_rate NUMERIC(12,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- TARIFAS POR CLIENTE
-- =============================================

CREATE TABLE service_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES service_types(id) ON DELETE CASCADE,
  hourly_rate NUMERIC(12,2),
  minimum_hours NUMERIC(5,2) DEFAULT 1,
  km_rate NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  valid_from DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(client_id, service_type_id)
);

-- =============================================
-- SERVICIOS PRINCIPALES
-- =============================================

CREATE TYPE service_status AS ENUM (
  'pendiente',
  'confirmado', 
  'en_curso',
  'completado',
  'facturado',
  'cancelado'
);

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE,
  
  -- Cliente y ubicación
  client_id UUID NOT NULL REFERENCES clients(id),
  location TEXT NOT NULL,
  destination TEXT,
  
  -- Fecha y tiempo
  service_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  total_hours NUMERIC(5,2),
  
  -- Recursos asignados
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  
  -- Tipo y descripción
  service_type_id UUID REFERENCES service_types(id),
  description TEXT,
  
  -- Valores
  hourly_rate NUMERIC(12,2),
  km_traveled NUMERIC(10,2),
  km_rate NUMERIC(10,2),
  subtotal NUMERIC(12,2),
  vat NUMERIC(12,2),
  total NUMERIC(12,2),
  
  -- Estado y facturación
  status service_status DEFAULT 'pendiente',
  invoice_id UUID REFERENCES invoices(id),
  
  -- Firma del cliente
  client_signature TEXT,
  client_name_signed TEXT,
  client_rut_signed TEXT,
  signed_at TIMESTAMPTZ,
  
  -- Observaciones
  notes TEXT,
  internal_notes TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_services_folio ON services(folio);
CREATE INDEX idx_services_client ON services(client_id);
CREATE INDEX idx_services_date ON services(service_date);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_services_crane ON services(crane_id);
CREATE INDEX idx_services_operator ON services(operator_id);

-- =============================================
-- INSPECCIONES PRE-SERVICIO
-- =============================================

CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES operators(id),
  
  -- Checklist de equipamiento
  equipment_checklist TEXT[] NOT NULL,
  
  -- Observaciones del vehículo
  vehicle_observations TEXT,
  
  -- Fotos
  photos_before_service TEXT[],
  photos_client_vehicle TEXT[],
  photos_equipment_used TEXT[],
  
  -- Firma
  operator_signature TEXT NOT NULL,
  client_name TEXT,
  client_rut TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CIERRES DE SERVICIO
-- =============================================

CREATE TABLE service_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folio TEXT NOT NULL UNIQUE,
  client_id UUID NOT NULL REFERENCES clients(id),
  
  -- Período
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Totales
  total_services INTEGER DEFAULT 0,
  total_hours NUMERIC(10,2) DEFAULT 0,
  total_km NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(14,2) DEFAULT 0,
  vat NUMERIC(14,2) DEFAULT 0,
  total NUMERIC(14,2) DEFAULT 0,
  
  -- Estado
  status TEXT DEFAULT 'borrador' CHECK (status IN ('borrador', 'cerrado', 'facturado')),
  
  -- Auditoría
  closed_by UUID REFERENCES profiles(id),
  closed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Relación servicios-cierre
CREATE TABLE closure_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  closure_id UUID NOT NULL REFERENCES service_closures(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  UNIQUE(closure_id, service_id)
);
```

### 3.3 Tablas de Costos e Ingresos

```sql
-- =============================================
-- CATEGORÍAS DE COSTOS
-- =============================================

CREATE TABLE cost_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar categorías por defecto
INSERT INTO cost_categories (name, description) VALUES
  ('Gastos de Servicios', 'Costos directos asociados a servicios'),
  ('Mantenimiento', 'Mantenimiento preventivo y correctivo'),
  ('Administrativo', 'Gastos administrativos y de oficina'),
  ('Personal', 'Sueldos, comisiones y beneficios'),
  ('Inventario', 'Compras de inventario y repuestos');

-- =============================================
-- SUBCATEGORÍAS DE COSTOS
-- =============================================

CREATE TABLE cost_subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES cost_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category_id, name)
);

-- =============================================
-- COSTOS
-- =============================================

CREATE TABLE costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Clasificación
  category_id UUID NOT NULL REFERENCES cost_categories(id),
  subcategory TEXT,
  
  -- Detalle
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  date DATE NOT NULL,
  
  -- Asociaciones opcionales
  service_id UUID REFERENCES services(id),
  service_folio TEXT,
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  supplier_id UUID REFERENCES suppliers(id),
  maintenance_id UUID REFERENCES crane_maintenance(id),
  
  -- Datos de inventario (si aplica)
  purchase_quantity NUMERIC(10,2),
  purchase_unit_cost NUMERIC(12,2),
  immediate_consumption BOOLEAN DEFAULT false,
  inventory_movement_id UUID REFERENCES inventory_movements(id),
  
  -- Pago
  payment_date DATE,
  payment_batch_id UUID,
  
  -- Centro de costo
  cost_center_id UUID REFERENCES cost_centers(id),
  
  -- Notas
  notes TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_costs_category ON costs(category_id);
CREATE INDEX idx_costs_date ON costs(date);
CREATE INDEX idx_costs_service ON costs(service_id);
CREATE INDEX idx_costs_crane ON costs(crane_id);
CREATE INDEX idx_costs_supplier ON costs(supplier_id);

-- =============================================
-- PIEZAS Y REPUESTOS DE GRÚAS
-- =============================================

CREATE TABLE crane_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crane_id UUID NOT NULL REFERENCES cranes(id),
  
  -- Detalle de la pieza
  part_name TEXT NOT NULL,
  supplier TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  phone TEXT,
  
  -- Valores
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  total_value NUMERIC(14,2),
  
  -- Instalación
  date DATE NOT NULL,
  kilometraje NUMERIC(10,2),
  
  -- Referencias
  cost_id UUID REFERENCES costs(id),
  inventory_movement_id UUID REFERENCES inventory_movements(id),
  
  -- Notas
  notes TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_crane_parts_crane ON crane_parts(crane_id);
CREATE INDEX idx_crane_parts_date ON crane_parts(date);

-- =============================================
-- MANTENIMIENTO DE GRÚAS
-- =============================================

CREATE TABLE crane_maintenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crane_id UUID NOT NULL REFERENCES cranes(id),
  
  -- Tipo y descripción
  maintenance_type TEXT NOT NULL, -- 'preventivo', 'correctivo', 'emergencia'
  description TEXT NOT NULL,
  
  -- Fechas
  scheduled_date DATE,
  completed_date DATE,
  next_maintenance_date DATE,
  
  -- Estado
  status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_progreso', 'completado', 'cancelado')),
  
  -- Costo
  cost NUMERIC(14,2) DEFAULT 0,
  provider TEXT,
  
  -- Kilometraje
  kilometraje NUMERIC(10,2),
  
  -- Notas
  notes TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CATEGORÍAS DE INGRESOS
-- =============================================

CREATE TABLE income_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INGRESOS
-- =============================================

CREATE TABLE incomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Clasificación
  category_id UUID REFERENCES income_categories(id),
  subcategory TEXT,
  
  -- Detalle
  description TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  income_date DATE NOT NULL,
  
  -- Cliente
  client_id UUID REFERENCES clients(id),
  occasional_client_name TEXT,
  
  -- Factura asociada
  invoice_id UUID REFERENCES invoices(id),
  
  -- Método de pago
  payment_method TEXT NOT NULL, -- 'efectivo', 'transferencia', 'cheque', 'tarjeta'
  bank_reference TEXT,
  
  -- Notas
  notes TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_incomes_date ON incomes(income_date);
CREATE INDEX idx_incomes_client ON incomes(client_id);
CREATE INDEX idx_incomes_category ON incomes(category_id);
```

### 3.4 Tablas de Inventario

```sql
-- =============================================
-- CATEGORÍAS DE INVENTARIO
-- =============================================

CREATE TABLE inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- UBICACIONES/BODEGAS
-- =============================================

CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ITEMS DE INVENTARIO
-- =============================================

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT UNIQUE,
  description TEXT,
  
  -- Categoría
  category_id UUID REFERENCES inventory_categories(id),
  
  -- Unidad y costo
  unit_of_measure TEXT NOT NULL DEFAULT 'unidad',
  unit_cost NUMERIC(12,2),
  
  -- Niveles de stock
  minimum_stock NUMERIC(10,2),
  maximum_stock NUMERIC(10,2),
  safety_stock NUMERIC(10,2),
  
  -- Configuración
  is_critical BOOLEAN DEFAULT false,
  has_expiration BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_items_category ON inventory_items(category_id);

-- =============================================
-- STOCK POR UBICACIÓN
-- =============================================

CREATE TABLE inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  
  current_quantity NUMERIC(10,2) NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC(10,2) DEFAULT 0,
  available_quantity NUMERIC(10,2) GENERATED ALWAYS AS (current_quantity - reserved_quantity) STORED,
  
  last_movement_date TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(item_id, location_id)
);

-- =============================================
-- MOVIMIENTOS DE INVENTARIO
-- =============================================

CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Item y ubicación
  item_id UUID NOT NULL REFERENCES inventory_items(id),
  location_id UUID NOT NULL REFERENCES inventory_locations(id),
  
  -- Tipo de movimiento
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'entrada', 'salida', 'ajuste', 'transferencia', 'consumo'
  )),
  
  -- Cantidad y costo
  quantity NUMERIC(10,2) NOT NULL,
  unit_cost NUMERIC(12,2),
  total_cost NUMERIC(14,2),
  
  -- Fecha y referencia
  movement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_document TEXT,
  
  -- Proveedor (para entradas)
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name TEXT,
  
  -- Lote y vencimiento
  batch_number TEXT,
  expiration_date DATE,
  
  -- Asociaciones
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  maintenance_id UUID REFERENCES crane_maintenance(id),
  cost_id UUID REFERENCES costs(id),
  
  -- Estado
  status TEXT DEFAULT 'completado' CHECK (status IN ('pendiente', 'completado', 'anulado')),
  
  -- Motivo
  reason TEXT,
  observations TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inventory_movements_item ON inventory_movements(item_id);
CREATE INDEX idx_inventory_movements_date ON inventory_movements(movement_date);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(movement_type);

-- =============================================
-- CONSUMOS DE INVENTARIO (detalle)
-- =============================================

CREATE TABLE inventory_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL REFERENCES inventory_movements(id) ON DELETE CASCADE,
  crane_id UUID NOT NULL REFERENCES cranes(id),
  
  consumption_date DATE NOT NULL DEFAULT CURRENT_DATE,
  odometer_reading NUMERIC(10,2),
  operation_hours NUMERIC(10,2),
  
  -- Tipo de consumo
  maintenance_type TEXT, -- 'preventivo', 'correctivo', 'operativo'
  work_order_number TEXT,
  
  -- Centro de costo
  cost_center_id UUID REFERENCES cost_centers(id),
  operator_id UUID REFERENCES operators(id),
  
  -- Aprobación
  approved_by UUID REFERENCES profiles(id),
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ALERTAS DE INVENTARIO
-- =============================================

CREATE TABLE inventory_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id UUID REFERENCES inventory_locations(id) ON DELETE CASCADE,
  
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'stock_bajo', 'stock_critico', 'vencimiento_proximo', 'sin_movimiento'
  )),
  
  threshold_value NUMERIC(10,2),
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMPTZ,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.5 Tablas de Facturación

```sql
-- =============================================
-- CONDICIONES DE PAGO
-- =============================================

CREATE TABLE payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  days INTEGER NOT NULL DEFAULT 30,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO payment_terms (name, days) VALUES
  ('Contado', 0),
  ('30 días', 30),
  ('45 días', 45),
  ('60 días', 60);

-- =============================================
-- FACTURAS
-- =============================================

CREATE TYPE invoice_status AS ENUM (
  'borrador',
  'emitida',
  'enviada',
  'pagada',
  'parcial',
  'vencida',
  'anulada'
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación
  folio TEXT NOT NULL UNIQUE,
  numero_fiscal TEXT, -- Número de factura SII
  
  -- Cliente
  client_id UUID NOT NULL REFERENCES clients(id),
  
  -- Fechas
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  payment_date DATE,
  
  -- Valores
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  vat NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  
  -- Pagos
  paid_amount NUMERIC(14,2) DEFAULT 0,
  remaining_amount NUMERIC(14,2) GENERATED ALWAYS AS (total - COALESCE(paid_amount, 0)) STORED,
  
  -- Estado
  status invoice_status DEFAULT 'borrador',
  
  -- Condiciones
  payment_term_id UUID REFERENCES payment_terms(id),
  
  -- Notas
  notes TEXT,
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoices_folio ON invoices(folio);
CREATE INDEX idx_invoices_client ON invoices(client_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- =============================================
-- SERVICIOS EN FACTURA
-- =============================================

CREATE TABLE invoice_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  UNIQUE(invoice_id, service_id)
);

-- =============================================
-- PAGOS
-- =============================================

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  
  amount NUMERIC(14,2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL,
  
  reference TEXT,
  notes TEXT,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ANULACIONES DE FACTURA
-- =============================================

CREATE TABLE invoice_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) UNIQUE,
  
  credit_note_number TEXT NOT NULL,
  cancellation_reason TEXT NOT NULL,
  reason_details TEXT,
  
  -- Datos originales
  original_folio TEXT NOT NULL,
  original_numero_fiscal TEXT,
  original_total NUMERIC(14,2) NOT NULL,
  original_client_id UUID REFERENCES clients(id),
  
  -- Auditoría
  cancelled_by UUID REFERENCES profiles(id),
  cancelled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.6 Tablas de Sistema

```sql
-- =============================================
-- DATOS DE LA EMPRESA
-- =============================================

CREATE TABLE company_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  rut TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  logo_url TEXT,
  
  -- Configuración de folios
  folio_format TEXT DEFAULT 'SRV-{YYYY}-{NNNNNN}',
  next_service_folio_number INTEGER DEFAULT 1,
  excess_folio_format TEXT DEFAULT 'EXC-{YYYY}-{NNNNNN}',
  next_excess_folio_number INTEGER DEFAULT 1,
  next_invoice_folio_number INTEGER DEFAULT 1,
  
  -- Configuración de IVA
  vat_percentage NUMERIC(5,2) DEFAULT 19.00,
  
  -- Configuración de alertas
  alert_days INTEGER DEFAULT 30,
  invoice_due_days INTEGER DEFAULT 30,
  
  -- Textos legales
  legal_texts TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CENTROS DE COSTO
-- =============================================

CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES cost_centers(id),
  
  budget_amount NUMERIC(14,2),
  budget_period TEXT, -- 'mensual', 'trimestral', 'anual'
  
  is_active BOOLEAN DEFAULT true,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- EVENTOS DE CALENDARIO
-- =============================================

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  title TEXT NOT NULL,
  description TEXT,
  
  -- Tipo de evento
  type TEXT NOT NULL CHECK (type IN (
    'servicio', 'mantenimiento', 'vencimiento', 'reunion', 'otro'
  )),
  
  -- Fecha y hora
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  -- Estado
  status TEXT DEFAULT 'pendiente' CHECK (status IN (
    'pendiente', 'confirmado', 'en_curso', 'completado', 'cancelado'
  )),
  
  -- Asociaciones
  service_id UUID REFERENCES services(id),
  crane_id UUID REFERENCES cranes(id),
  operator_id UUID REFERENCES operators(id),
  client_id UUID REFERENCES clients(id),
  
  -- Auditoría
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_calendar_events_date ON calendar_events(date);
CREATE INDEX idx_calendar_events_type ON calendar_events(type);

-- =============================================
-- NOTIFICACIONES
-- =============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
  
  -- Referencia
  reference_type TEXT, -- 'service', 'invoice', 'maintenance', etc.
  reference_id UUID,
  
  -- Estado
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- =============================================
-- LOG DE AUDITORÍA
-- =============================================

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES profiles(id),
  timestamp TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);

-- =============================================
-- DOCUMENTOS DE GRÚAS
-- =============================================

CREATE TABLE crane_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crane_id UUID NOT NULL REFERENCES cranes(id) ON DELETE CASCADE,
  
  document_type TEXT NOT NULL, -- 'revision_tecnica', 'seguro', 'permiso', 'otro'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  content_type TEXT,
  
  expiry_date DATE,
  
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ALERTAS DE DOCUMENTOS
-- =============================================

CREATE TABLE document_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crane_id UUID NOT NULL REFERENCES cranes(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  
  alert_days INTEGER DEFAULT 30,
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- CONFIGURACIÓN DE ALERTAS DE FACTURA
-- =============================================

CREATE TABLE invoice_alert_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  
  due_soon_alerts_enabled BOOLEAN DEFAULT true,
  due_soon_days INTEGER DEFAULT 7,
  overdue_alerts_enabled BOOLEAN DEFAULT true,
  
  email_notifications BOOLEAN DEFAULT true,
  push_notifications BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- LOGS DE BACKUP
-- =============================================

CREATE TABLE backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL, -- 'full', 'incremental', 'manual'
  status TEXT NOT NULL, -- 'success', 'failed', 'in_progress'
  file_size_bytes INTEGER,
  error_message TEXT,
  metadata JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3.7 Triggers y Funciones

```sql
-- =============================================
-- FUNCIÓN PARA ACTUALIZAR updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con updated_at
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN 
    SELECT table_name 
    FROM information_schema.columns 
    WHERE column_name = 'updated_at' 
    AND table_schema = 'public'
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    ', t, t, t, t);
  END LOOP;
END;
$$;

-- =============================================
-- FUNCIÓN PARA CALCULAR TOTAL DE SERVICIO
-- =============================================

CREATE OR REPLACE FUNCTION calculate_service_total()
RETURNS TRIGGER AS $$
DECLARE
  vat_rate NUMERIC;
BEGIN
  -- Obtener tasa de IVA
  SELECT COALESCE(vat_percentage, 19) / 100 INTO vat_rate
  FROM company_data LIMIT 1;
  
  -- Calcular subtotal basado en horas
  IF NEW.total_hours IS NOT NULL AND NEW.hourly_rate IS NOT NULL THEN
    NEW.subtotal := NEW.total_hours * NEW.hourly_rate;
  END IF;
  
  -- Agregar costo por km si aplica
  IF NEW.km_traveled IS NOT NULL AND NEW.km_rate IS NOT NULL THEN
    NEW.subtotal := COALESCE(NEW.subtotal, 0) + (NEW.km_traveled * NEW.km_rate);
  END IF;
  
  -- Calcular IVA y total
  NEW.vat := COALESCE(NEW.subtotal, 0) * vat_rate;
  NEW.total := COALESCE(NEW.subtotal, 0) + NEW.vat;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_service_total_trigger
BEFORE INSERT OR UPDATE OF total_hours, hourly_rate, km_traveled, km_rate
ON services
FOR EACH ROW
EXECUTE FUNCTION calculate_service_total();

-- =============================================
-- FUNCIÓN PARA ACTUALIZAR STOCK
-- =============================================

CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Actualizar o crear registro de stock
    INSERT INTO inventory_stock (item_id, location_id, current_quantity, last_movement_date)
    VALUES (
      NEW.item_id, 
      NEW.location_id,
      CASE 
        WHEN NEW.movement_type IN ('entrada', 'ajuste') THEN NEW.quantity
        ELSE -NEW.quantity
      END,
      NEW.movement_date
    )
    ON CONFLICT (item_id, location_id)
    DO UPDATE SET
      current_quantity = inventory_stock.current_quantity + 
        CASE 
          WHEN NEW.movement_type IN ('entrada', 'ajuste') THEN NEW.quantity
          ELSE -NEW.quantity
        END,
      last_movement_date = NEW.movement_date,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_on_movement
AFTER INSERT ON inventory_movements
FOR EACH ROW
WHEN (NEW.status = 'completado')
EXECUTE FUNCTION update_inventory_stock();

-- =============================================
-- FUNCIÓN PARA GENERAR FOLIO DE SERVICIO
-- =============================================

CREATE OR REPLACE FUNCTION generate_service_folio()
RETURNS TRIGGER AS $$
DECLARE
  folio_template TEXT;
  next_number INTEGER;
  new_folio TEXT;
BEGIN
  IF NEW.folio IS NULL OR NEW.folio = '' THEN
    -- Obtener template y número siguiente
    SELECT folio_format, next_service_folio_number 
    INTO folio_template, next_number
    FROM company_data LIMIT 1;
    
    -- Generar folio
    new_folio := folio_template;
    new_folio := REPLACE(new_folio, '{YYYY}', TO_CHAR(CURRENT_DATE, 'YYYY'));
    new_folio := REPLACE(new_folio, '{MM}', TO_CHAR(CURRENT_DATE, 'MM'));
    new_folio := REPLACE(new_folio, '{NNNNNN}', LPAD(next_number::TEXT, 6, '0'));
    new_folio := REPLACE(new_folio, '{NNNNN}', LPAD(next_number::TEXT, 5, '0'));
    new_folio := REPLACE(new_folio, '{NNNN}', LPAD(next_number::TEXT, 4, '0'));
    
    NEW.folio := new_folio;
    
    -- Incrementar contador
    UPDATE company_data 
    SET next_service_folio_number = next_number + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_folio_on_insert
BEFORE INSERT ON services
FOR EACH ROW
EXECUTE FUNCTION generate_service_folio();

-- =============================================
-- FUNCIÓN PARA AUDITORÍA
-- =============================================

CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, operation, old_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), current_setting('app.current_user_id', true)::UUID);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, operation, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(OLD), to_jsonb(NEW), current_setting('app.current_user_id', true)::UUID);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, operation, new_data, user_id)
    VALUES (TG_TABLE_NAME, TG_OP, to_jsonb(NEW), current_setting('app.current_user_id', true)::UUID);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a tablas críticas
CREATE TRIGGER audit_services AFTER INSERT OR UPDATE OR DELETE ON services FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_costs AFTER INSERT OR UPDATE OR DELETE ON costs FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
CREATE TRIGGER audit_inventory_movements AFTER INSERT OR UPDATE OR DELETE ON inventory_movements FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

---

## 4. Módulos del Sistema

### 4.1 Dashboard

```typescript
interface DashboardModule {
  // KPIs principales
  kpis: {
    servicesToday: number;
    servicesThisMonth: number;
    revenueThisMonth: number;
    pendingInvoices: number;
    overdueInvoices: number;
    activeCranes: number;
    activeOperators: number;
  };
  
  // Gráficos
  charts: {
    revenueByMonth: ChartData[];
    servicesByType: ChartData[];
    costsByCategory: ChartData[];
    profitMargin: ChartData[];
  };
  
  // Alertas
  alerts: {
    expiringDocuments: Alert[];
    lowInventory: Alert[];
    overdueInvoices: Alert[];
    pendingMaintenance: Alert[];
  };
  
  // Actividad reciente
  recentActivity: ActivityItem[];
}
```

### 4.2 Servicios

```typescript
interface ServicesModule {
  // Funcionalidades
  features: {
    createService: (data: ServiceFormData) => Promise<Service>;
    updateService: (id: string, data: Partial<Service>) => Promise<Service>;
    deleteService: (id: string) => Promise<void>;
    
    // Estados
    confirmService: (id: string) => Promise<void>;
    startService: (id: string) => Promise<void>;
    completeService: (id: string) => Promise<void>;
    cancelService: (id: string, reason: string) => Promise<void>;
    
    // Inspección
    createInspection: (serviceId: string, data: InspectionData) => Promise<void>;
    
    // Firma
    captureSignature: (serviceId: string, signatureData: SignatureData) => Promise<void>;
    
    // Cierre
    createClosure: (clientId: string, serviceIds: string[]) => Promise<ServiceClosure>;
    
    // Costos
    addServiceCost: (serviceId: string, costData: CostFormData) => Promise<void>;
  };
  
  // Vistas
  views: {
    list: ServiceListView;
    calendar: ServiceCalendarView;
    detail: ServiceDetailView;
    closure: ServiceClosureView;
  };
}
```

### 4.3 Clientes

```typescript
interface ClientsModule {
  features: {
    createClient: (data: ClientFormData) => Promise<Client>;
    updateClient: (id: string, data: Partial<Client>) => Promise<Client>;
    deactivateClient: (id: string) => Promise<void>;
    
    // Tarifas personalizadas
    setCustomRates: (clientId: string, rates: ServiceRate[]) => Promise<void>;
    
    // Historial
    getServiceHistory: (clientId: string) => Promise<Service[]>;
    getInvoiceHistory: (clientId: string) => Promise<Invoice[]>;
    getPaymentHistory: (clientId: string) => Promise<Payment[]>;
    
    // Métricas
    getClientMetrics: (clientId: string) => Promise<ClientMetrics>;
  };
}
```

### 4.4 Grúas

```typescript
interface CranesModule {
  features: {
    createCrane: (data: CraneFormData) => Promise<Crane>;
    updateCrane: (id: string, data: Partial<Crane>) => Promise<Crane>;
    deactivateCrane: (id: string) => Promise<void>;
    
    // Documentos
    uploadDocument: (craneId: string, file: File, type: DocumentType) => Promise<void>;
    getExpiringDocuments: () => Promise<ExpiringDocument[]>;
    
    // Mantenimiento
    scheduleMaintenance: (craneId: string, data: MaintenanceData) => Promise<void>;
    completeMaintenance: (maintenanceId: string) => Promise<void>;
    
    // Piezas
    registerPart: (craneId: string, data: PartData) => Promise<void>;
    getPartHistory: (craneId: string) => Promise<CranePart[]>;
    
    // Costos
    getCraneCosts: (craneId: string, period: DateRange) => Promise<CostSummary>;
    
    // Métricas
    getCraneMetrics: (craneId: string) => Promise<CraneMetrics>;
  };
}
```

### 4.5 Operadores

```typescript
interface OperatorsModule {
  features: {
    createOperator: (data: OperatorFormData) => Promise<Operator>;
    updateOperator: (id: string, data: Partial<Operator>) => Promise<Operator>;
    deactivateOperator: (id: string) => Promise<void>;
    
    // Documentos
    getExpiringLicenses: () => Promise<ExpiringLicense[]>;
    
    // Asignaciones
    getAssignedServices: (operatorId: string) => Promise<Service[]>;
    getAvailability: (date: Date) => Promise<OperatorAvailability[]>;
    
    // Comisiones
    calculateCommissions: (operatorId: string, period: DateRange) => Promise<CommissionReport>;
    
    // Métricas
    getOperatorMetrics: (operatorId: string) => Promise<OperatorMetrics>;
  };
}
```

### 4.6 Inventario

```typescript
interface InventoryModule {
  features: {
    // Items
    createItem: (data: ItemFormData) => Promise<InventoryItem>;
    updateItem: (id: string, data: Partial<InventoryItem>) => Promise<InventoryItem>;
    
    // Movimientos
    registerEntry: (data: EntryMovementData) => Promise<InventoryMovement>;
    registerExit: (data: ExitMovementData) => Promise<InventoryMovement>;
    registerAdjustment: (data: AdjustmentData) => Promise<InventoryMovement>;
    
    // Stock
    getStockByLocation: (locationId?: string) => Promise<StockItem[]>;
    getLowStockItems: () => Promise<LowStockItem[]>;
    
    // Consumos
    registerConsumption: (data: ConsumptionData) => Promise<void>;
    getConsumptionByCrane: (craneId: string) => Promise<ConsumptionReport>;
    
    // Alertas
    configureAlerts: (itemId: string, config: AlertConfig) => Promise<void>;
    getActiveAlerts: () => Promise<InventoryAlert[]>;
    
    // Reportes
    getMovementReport: (filters: MovementFilters) => Promise<MovementReport>;
    getValuationReport: () => Promise<ValuationReport>;
  };
}
```

### 4.7 Costos

```typescript
interface CostsModule {
  features: {
    createCost: (data: CostFormData) => Promise<Cost>;
    updateCost: (id: string, data: Partial<Cost>) => Promise<Cost>;
    deleteCost: (id: string) => Promise<void>;
    
    // Categorías
    getCategories: () => Promise<CostCategory[]>;
    createSubcategory: (categoryId: string, name: string) => Promise<CostSubcategory>;
    
    // Análisis
    getCostsByCategory: (period: DateRange) => Promise<CategoryBreakdown>;
    getCostsByCrane: (period: DateRange) => Promise<CraneBreakdown>;
    getCostsByOperator: (period: DateRange) => Promise<OperatorBreakdown>;
    getCostsByService: (serviceId: string) => Promise<ServiceCosts>;
    
    // Pagos a proveedores
    getPendingPayments: () => Promise<PendingPayment[]>;
    registerPayment: (costIds: string[], paymentData: PaymentData) => Promise<void>;
    
    // Centros de costo
    getCostCenters: () => Promise<CostCenter[]>;
    getCostCenterReport: (centerId: string, period: DateRange) => Promise<CostCenterReport>;
  };
}
```

### 4.8 Ingresos

```typescript
interface IncomesModule {
  features: {
    createIncome: (data: IncomeFormData) => Promise<Income>;
    updateIncome: (id: string, data: Partial<Income>) => Promise<Income>;
    deleteIncome: (id: string) => Promise<void>;
    
    // Categorías
    getCategories: () => Promise<IncomeCategory[]>;
    
    // Análisis
    getIncomesByCategory: (period: DateRange) => Promise<CategoryBreakdown>;
    getIncomesByClient: (period: DateRange) => Promise<ClientBreakdown>;
    getIncomesByPaymentMethod: (period: DateRange) => Promise<PaymentMethodBreakdown>;
    
    // Conciliación
    matchWithInvoice: (incomeId: string, invoiceId: string) => Promise<void>;
    getUnmatchedIncomes: () => Promise<Income[]>;
  };
}
```

### 4.9 Facturación

```typescript
interface InvoicingModule {
  features: {
    // Facturas
    createInvoice: (data: InvoiceFormData) => Promise<Invoice>;
    updateInvoice: (id: string, data: Partial<Invoice>) => Promise<Invoice>;
    emitInvoice: (id: string) => Promise<void>;
    cancelInvoice: (id: string, reason: CancellationReason) => Promise<void>;
    
    // Desde servicios
    createFromServices: (serviceIds: string[]) => Promise<Invoice>;
    createFromClosure: (closureId: string) => Promise<Invoice>;
    
    // Pagos
    registerPayment: (invoiceId: string, data: PaymentData) => Promise<Payment>;
    getPaymentHistory: (invoiceId: string) => Promise<Payment[]>;
    
    // Estados
    getOverdueInvoices: () => Promise<Invoice[]>;
    getDueSoonInvoices: (days: number) => Promise<Invoice[]>;
    
    // Reportes
    getAgingReport: () => Promise<AgingReport>;
    getCollectionReport: (period: DateRange) => Promise<CollectionReport>;
    
    // PDF
    generatePDF: (invoiceId: string) => Promise<Blob>;
    sendByEmail: (invoiceId: string, email: string) => Promise<void>;
  };
}
```

### 4.10 Reportes

```typescript
interface ReportsModule {
  features: {
    // Operacionales
    generateServiceReport: (filters: ServiceFilters) => Promise<ServiceReport>;
    generateCraneUtilization: (period: DateRange) => Promise<UtilizationReport>;
    generateOperatorPerformance: (period: DateRange) => Promise<PerformanceReport>;
    
    // Financieros
    generateProfitLoss: (period: DateRange) => Promise<ProfitLossReport>;
    generateCashFlow: (period: DateRange) => Promise<CashFlowReport>;
    generateRevenueByClient: (period: DateRange) => Promise<ClientRevenueReport>;
    
    // Inventario
    generateStockReport: () => Promise<StockReport>;
    generateMovementHistory: (filters: MovementFilters) => Promise<MovementReport>;
    generateConsumptionAnalysis: (period: DateRange) => Promise<ConsumptionReport>;
    
    // Exportación
    exportToExcel: (reportData: any, filename: string) => Promise<Blob>;
    exportToPDF: (reportData: any, filename: string) => Promise<Blob>;
  };
}
```

### 4.11 Calendario

```typescript
interface CalendarModule {
  features: {
    // Eventos
    createEvent: (data: EventFormData) => Promise<CalendarEvent>;
    updateEvent: (id: string, data: Partial<CalendarEvent>) => Promise<CalendarEvent>;
    deleteEvent: (id: string) => Promise<void>;
    
    // Vistas
    getEventsByDay: (date: Date) => Promise<CalendarEvent[]>;
    getEventsByWeek: (startDate: Date) => Promise<CalendarEvent[]>;
    getEventsByMonth: (year: number, month: number) => Promise<CalendarEvent[]>;
    
    // Filtros
    getEventsByType: (type: EventType) => Promise<CalendarEvent[]>;
    getEventsByCrane: (craneId: string) => Promise<CalendarEvent[]>;
    getEventsByOperator: (operatorId: string) => Promise<CalendarEvent[]>;
    
    // Sincronización
    syncWithServices: () => Promise<void>;
    syncWithMaintenance: () => Promise<void>;
  };
}
```

### 4.12 Configuración

```typescript
interface ConfigurationModule {
  features: {
    // Empresa
    updateCompanyData: (data: CompanyData) => Promise<void>;
    updateLogo: (file: File) => Promise<string>;
    
    // Usuarios
    getUsers: () => Promise<Profile[]>;
    updateUserRole: (userId: string, role: UserRole) => Promise<void>;
    deactivateUser: (userId: string) => Promise<void>;
    
    // Tipos y categorías
    manageServiceTypes: () => ServiceTypesManager;
    manageCostCategories: () => CostCategoriesManager;
    manageIncomeCategories: () => IncomeCategoriesManager;
    
    // Folios
    updateFolioFormat: (type: FolioType, format: string) => Promise<void>;
    
    // Backup
    createBackup: () => Promise<BackupResult>;
    restoreBackup: (file: File) => Promise<RestoreResult>;
    
    // Alertas
    configureAlerts: (settings: AlertSettings) => Promise<void>;
  };
}
```

---

## 5. Funcionalidad Offline Completa

### 5.1 Estructura IndexedDB

```typescript
// src/lib/db/indexedDB.ts

const DB_NAME = 'TMSLocalDB';
const DB_VERSION = 5;

export const STORES = {
  // Datos maestros
  PROFILES: 'profiles',
  CLIENTS: 'clients',
  CRANES: 'cranes',
  OPERATORS: 'operators',
  SUPPLIERS: 'suppliers',
  
  // Operaciones
  SERVICES: 'services',
  SERVICE_TYPES: 'serviceTypes',
  INSPECTIONS: 'inspections',
  SERVICE_CLOSURES: 'serviceClosures',
  
  // Costos e ingresos
  COSTS: 'costs',
  COST_CATEGORIES: 'costCategories',
  INCOMES: 'incomes',
  INCOME_CATEGORIES: 'incomeCategories',
  
  // Inventario
  INVENTORY_ITEMS: 'inventoryItems',
  INVENTORY_MOVEMENTS: 'inventoryMovements',
  INVENTORY_STOCK: 'inventoryStock',
  INVENTORY_LOCATIONS: 'inventoryLocations',
  
  // Facturación
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  PAYMENT_TERMS: 'paymentTerms',
  
  // Grúas
  CRANE_PARTS: 'craneParts',
  CRANE_MAINTENANCE: 'craneMaintenance',
  CRANE_DOCUMENTS: 'craneDocuments',
  
  // Sistema
  CALENDAR_EVENTS: 'calendarEvents',
  NOTIFICATIONS: 'notifications',
  COMPANY_DATA: 'companyData',
  
  // Sincronización
  OFFLINE_ACTIONS: 'offlineActions',
  SYNC_LOG: 'syncLog',
  USER_PROFILE: 'userProfile',
  OFFLINE_COUNTER: 'offlineCounter',
  SETTINGS: 'settings'
} as const;

export interface StoreConfig {
  name: string;
  keyPath: string;
  indexes?: {
    name: string;
    keyPath: string | string[];
    options?: IDBIndexParameters;
  }[];
}

export const STORE_CONFIGS: StoreConfig[] = [
  {
    name: STORES.CLIENTS,
    keyPath: 'id',
    indexes: [
      { name: 'rut', keyPath: 'rut', options: { unique: true } },
      { name: 'name', keyPath: 'name' },
      { name: 'is_active', keyPath: 'is_active' }
    ]
  },
  {
    name: STORES.SERVICES,
    keyPath: 'id',
    indexes: [
      { name: 'folio', keyPath: 'folio', options: { unique: true } },
      { name: 'client_id', keyPath: 'client_id' },
      { name: 'crane_id', keyPath: 'crane_id' },
      { name: 'operator_id', keyPath: 'operator_id' },
      { name: 'service_date', keyPath: 'service_date' },
      { name: 'status', keyPath: 'status' }
    ]
  },
  {
    name: STORES.COSTS,
    keyPath: 'id',
    indexes: [
      { name: 'category_id', keyPath: 'category_id' },
      { name: 'date', keyPath: 'date' },
      { name: 'service_id', keyPath: 'service_id' },
      { name: 'crane_id', keyPath: 'crane_id' },
      { name: 'supplier_id', keyPath: 'supplier_id' }
    ]
  },
  {
    name: STORES.INVENTORY_ITEMS,
    keyPath: 'id',
    indexes: [
      { name: 'sku', keyPath: 'sku', options: { unique: true } },
      { name: 'category_id', keyPath: 'category_id' },
      { name: 'name', keyPath: 'name' }
    ]
  },
  {
    name: STORES.INVENTORY_MOVEMENTS,
    keyPath: 'id',
    indexes: [
      { name: 'item_id', keyPath: 'item_id' },
      { name: 'movement_date', keyPath: 'movement_date' },
      { name: 'movement_type', keyPath: 'movement_type' }
    ]
  },
  {
    name: STORES.INVOICES,
    keyPath: 'id',
    indexes: [
      { name: 'folio', keyPath: 'folio', options: { unique: true } },
      { name: 'client_id', keyPath: 'client_id' },
      { name: 'status', keyPath: 'status' },
      { name: 'due_date', keyPath: 'due_date' }
    ]
  },
  {
    name: STORES.OFFLINE_ACTIONS,
    keyPath: 'id',
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'type', keyPath: 'type' },
      { name: 'entity', keyPath: 'entity' },
      { name: 'synced', keyPath: 'synced' }
    ]
  },
  {
    name: STORES.OFFLINE_COUNTER,
    keyPath: 'type'
  }
];

// Inicialización de la base de datos
export async function initDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      STORE_CONFIGS.forEach(config => {
        if (!db.objectStoreNames.contains(config.name)) {
          const store = db.createObjectStore(config.name, { 
            keyPath: config.keyPath 
          });

          config.indexes?.forEach(index => {
            store.createIndex(index.name, index.keyPath, index.options);
          });
        }
      });

      // Crear stores simples
      Object.values(STORES).forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      });
    };
  });
}
```

### 5.2 Interface de Acciones Offline

```typescript
// src/types/offline.ts

export interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: string;
  entityId: string;
  data: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
  synced: boolean;
  syncedAt?: number;
  error?: string;
  // Para relaciones
  dependencies?: {
    entity: string;
    localId: string;
    remoteId?: string;
  }[];
}

export interface OfflineCounter {
  type: string; // 'service', 'invoice', 'closure', etc.
  prefix: string;
  lastNumber: number;
  pendingSync: string[]; // Folios generados offline pendientes de sync
}

export interface SyncStatus {
  isOnline: boolean;
  lastSyncAt: Date | null;
  pendingActions: number;
  isSyncing: boolean;
  syncProgress: number;
  lastError: string | null;
}

export interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'last_write_wins' | 'manual';
  action: OfflineAction;
  serverData: any;
  clientData: any;
  resolvedData?: any;
}
```

### 5.3 Hook de Almacenamiento Offline

```typescript
// src/hooks/useOfflineStorage.ts

import { useState, useEffect, useCallback } from 'react';
import { initDatabase, STORES } from '@/lib/db/indexedDB';
import type { OfflineAction, OfflineCounter } from '@/types/offline';

export const useOfflineStorage = () => {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initDatabase()
      .then(database => {
        setDb(database);
        setIsReady(true);
      })
      .catch(console.error);
  }, []);

  // CRUD genérico
  const getAll = useCallback(async <T>(storeName: string): Promise<T[]> => {
    if (!db) throw new Error('Database not ready');
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const getById = useCallback(async <T>(storeName: string, id: string): Promise<T | undefined> => {
    if (!db) throw new Error('Database not ready');
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const getByIndex = useCallback(async <T>(
    storeName: string, 
    indexName: string, 
    value: IDBValidKey
  ): Promise<T[]> => {
    if (!db) throw new Error('Database not ready');
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const put = useCallback(async <T extends { id: string }>(
    storeName: string, 
    data: T
  ): Promise<void> => {
    if (!db) throw new Error('Database not ready');
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const remove = useCallback(async (storeName: string, id: string): Promise<void> => {
    if (!db) throw new Error('Database not ready');
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  const clear = useCallback(async (storeName: string): Promise<void> => {
    if (!db) throw new Error('Database not ready');
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }, [db]);

  // Acciones offline
  const addOfflineAction = useCallback(async (
    action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries' | 'synced'>
  ): Promise<string> => {
    const fullAction: OfflineAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
      maxRetries: 3,
      synced: false
    };
    
    await put(STORES.OFFLINE_ACTIONS, fullAction);
    return fullAction.id;
  }, [put]);

  const getPendingActions = useCallback(async (): Promise<OfflineAction[]> => {
    const actions = await getAll<OfflineAction>(STORES.OFFLINE_ACTIONS);
    return actions
      .filter(a => !a.synced)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [getAll]);

  const markActionSynced = useCallback(async (actionId: string): Promise<void> => {
    const action = await getById<OfflineAction>(STORES.OFFLINE_ACTIONS, actionId);
    if (action) {
      action.synced = true;
      action.syncedAt = Date.now();
      await put(STORES.OFFLINE_ACTIONS, action);
    }
  }, [getById, put]);

  // Generación de folios offline
  const generateOfflineFolio = useCallback(async (
    type: 'service' | 'invoice' | 'closure' | 'excess'
  ): Promise<string> => {
    const prefixes: Record<string, string> = {
      service: 'SRV-OFF',
      invoice: 'FAC-OFF',
      closure: 'CIE-OFF',
      excess: 'EXC-OFF'
    };
    
    let counter = await getById<OfflineCounter>(STORES.OFFLINE_COUNTER, type);
    
    if (!counter) {
      counter = {
        type,
        prefix: prefixes[type],
        lastNumber: 0,
        pendingSync: []
      };
    }
    
    counter.lastNumber += 1;
    const year = new Date().getFullYear();
    const folio = `${counter.prefix}-${year}-${String(counter.lastNumber).padStart(6, '0')}`;
    counter.pendingSync.push(folio);
    
    await put(STORES.OFFLINE_COUNTER, counter);
    
    return folio;
  }, [getById, put]);

  // Cache de datos para offline
  const cacheData = useCallback(async (
    storeName: string, 
    data: any[]
  ): Promise<void> => {
    if (!db) return;
    
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    // Limpiar y agregar nuevos datos
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });
    
    for (const item of data) {
      await new Promise<void>((resolve, reject) => {
        const addRequest = store.add({
          ...item,
          _cachedAt: Date.now()
        });
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });
    }
  }, [db]);

  return {
    db,
    isReady,
    stores: STORES,
    
    // CRUD
    getAll,
    getById,
    getByIndex,
    put,
    remove,
    clear,
    
    // Offline actions
    addOfflineAction,
    getPendingActions,
    markActionSynced,
    
    // Folio generation
    generateOfflineFolio,
    
    // Cache
    cacheData
  };
};
```

### 5.4 Hook de Estado de Red

```typescript
// src/hooks/useNetworkStatus.ts

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  effectiveType: string | null;
  downlink: number | null;
  rtt: number | null;
}

export const useNetworkStatus = () => {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    effectiveType: null,
    downlink: null,
    rtt: null
  });

  const updateNetworkInfo = useCallback(() => {
    const connection = (navigator as any).connection;
    
    setStatus({
      isOnline: navigator.onLine,
      effectiveType: connection?.effectiveType || null,
      downlink: connection?.downlink || null,
      rtt: connection?.rtt || null
    });
  }, []);

  useEffect(() => {
    updateNetworkInfo();

    window.addEventListener('online', updateNetworkInfo);
    window.addEventListener('offline', updateNetworkInfo);

    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', updateNetworkInfo);
    }

    return () => {
      window.removeEventListener('online', updateNetworkInfo);
      window.removeEventListener('offline', updateNetworkInfo);
      
      if (connection) {
        connection.removeEventListener('change', updateNetworkInfo);
      }
    };
  }, [updateNetworkInfo]);

  return status;
};
```

---

## 6. Sistema de Sincronización (Opcional)

### 6.1 Interface del Motor de Sincronización

```typescript
// src/services/SyncEngine.ts

import { supabase } from '@/integrations/supabase/client';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import type { OfflineAction, ConflictResolution, SyncStatus } from '@/types/offline';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  conflicts: ConflictResolution[];
  errors: string[];
}

export interface RemoteChanges {
  entity: string;
  changes: {
    created: any[];
    updated: any[];
    deleted: string[];
  };
  lastSync: Date;
}

export class SyncEngine {
  private storage: ReturnType<typeof useOfflineStorage>;
  private lastSyncTimestamp: number = 0;

  constructor(storage: ReturnType<typeof useOfflineStorage>) {
    this.storage = storage;
  }

  // Obtener cambios locales pendientes
  async getLocalChanges(): Promise<OfflineAction[]> {
    return this.storage.getPendingActions();
  }

  // Enviar cambios al servidor
  async pushChanges(actions: OfflineAction[]): Promise<SyncResult> {
    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      conflicts: [],
      errors: []
    };

    for (const action of actions) {
      try {
        const syncResult = await this.syncAction(action);
        
        if (syncResult.conflict) {
          result.conflicts.push(syncResult.conflict);
        } else if (syncResult.success) {
          await this.storage.markActionSynced(action.id);
          result.synced++;
        } else {
          result.failed++;
          result.errors.push(syncResult.error || 'Unknown error');
        }
      } catch (error) {
        result.failed++;
        result.errors.push((error as Error).message);
      }
    }

    result.success = result.failed === 0 && result.conflicts.length === 0;
    return result;
  }

  // Sincronizar una acción individual
  private async syncAction(action: OfflineAction): Promise<{
    success: boolean;
    conflict?: ConflictResolution;
    error?: string;
  }> {
    const table = this.entityToTable(action.entity);

    switch (action.type) {
      case 'CREATE':
        const { error: createError } = await supabase
          .from(table)
          .insert(action.data);
        
        if (createError) {
          return { success: false, error: createError.message };
        }
        return { success: true };

      case 'UPDATE':
        // Verificar conflictos
        const { data: serverData } = await supabase
          .from(table)
          .select('*')
          .eq('id', action.entityId)
          .single();

        if (serverData && serverData.updated_at > new Date(action.timestamp).toISOString()) {
          // Hay un conflicto
          return {
            success: false,
            conflict: {
              strategy: 'last_write_wins',
              action,
              serverData,
              clientData: action.data
            }
          };
        }

        const { error: updateError } = await supabase
          .from(table)
          .update(action.data)
          .eq('id', action.entityId);
        
        if (updateError) {
          return { success: false, error: updateError.message };
        }
        return { success: true };

      case 'DELETE':
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', action.entityId);
        
        if (deleteError) {
          return { success: false, error: deleteError.message };
        }
        return { success: true };

      default:
        return { success: false, error: 'Unknown action type' };
    }
  }

  // Obtener cambios del servidor
  async pullChanges(lastSync: Date): Promise<RemoteChanges[]> {
    const entities = [
      'clients', 'cranes', 'operators', 'suppliers',
      'services', 'costs', 'invoices'
    ];

    const changes: RemoteChanges[] = [];

    for (const entity of entities) {
      const table = this.entityToTable(entity);
      
      // Obtener registros actualizados
      const { data: updated } = await supabase
        .from(table)
        .select('*')
        .gte('updated_at', lastSync.toISOString());

      changes.push({
        entity,
        changes: {
          created: updated?.filter(r => new Date(r.created_at) >= lastSync) || [],
          updated: updated?.filter(r => new Date(r.created_at) < lastSync) || [],
          deleted: [] // Requiere soft delete o tabla de auditoría
        },
        lastSync: new Date()
      });
    }

    return changes;
  }

  // Resolver conflictos
  async resolveConflicts(conflicts: ConflictResolution[]): Promise<void> {
    for (const conflict of conflicts) {
      let resolvedData: any;

      switch (conflict.strategy) {
        case 'server_wins':
          resolvedData = conflict.serverData;
          break;
        case 'client_wins':
          resolvedData = conflict.clientData;
          break;
        case 'last_write_wins':
          const serverTime = new Date(conflict.serverData.updated_at).getTime();
          const clientTime = conflict.action.timestamp;
          resolvedData = serverTime > clientTime ? conflict.serverData : conflict.clientData;
          break;
        case 'manual':
          resolvedData = conflict.resolvedData;
          break;
      }

      if (resolvedData) {
        // Actualizar local
        await this.storage.put(
          this.entityToStore(conflict.action.entity),
          resolvedData
        );

        // Actualizar servidor
        await supabase
          .from(this.entityToTable(conflict.action.entity))
          .upsert(resolvedData);
      }
    }
  }

  // Sincronización completa
  async fullSync(): Promise<SyncResult> {
    const localChanges = await this.getLocalChanges();
    const pushResult = await this.pushChanges(localChanges);

    if (pushResult.conflicts.length > 0) {
      await this.resolveConflicts(pushResult.conflicts);
    }

    const lastSync = new Date(this.lastSyncTimestamp || 0);
    const remoteChanges = await this.pullChanges(lastSync);

    // Aplicar cambios remotos localmente
    for (const change of remoteChanges) {
      const store = this.entityToStore(change.entity);
      
      for (const item of [...change.changes.created, ...change.changes.updated]) {
        await this.storage.put(store, item);
      }

      for (const id of change.changes.deleted) {
        await this.storage.remove(store, id);
      }
    }

    this.lastSyncTimestamp = Date.now();
    return pushResult;
  }

  private entityToTable(entity: string): string {
    const mapping: Record<string, string> = {
      clients: 'clients',
      cranes: 'cranes',
      operators: 'operators',
      suppliers: 'suppliers',
      services: 'services',
      costs: 'costs',
      invoices: 'invoices',
      inventoryItems: 'inventory_items',
      inventoryMovements: 'inventory_movements'
    };
    return mapping[entity] || entity;
  }

  private entityToStore(entity: string): string {
    const { STORES } = this.storage;
    const mapping: Record<string, string> = {
      clients: STORES.CLIENTS,
      cranes: STORES.CRANES,
      operators: STORES.OPERATORS,
      suppliers: STORES.SUPPLIERS,
      services: STORES.SERVICES,
      costs: STORES.COSTS,
      invoices: STORES.INVOICES
    };
    return mapping[entity] || entity;
  }
}
```

### 6.2 Hook de Sincronización

```typescript
// src/hooks/useSync.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEngine, SyncResult } from '@/services/SyncEngine';
import { useOfflineStorage } from './useOfflineStorage';
import { useNetworkStatus } from './useNetworkStatus';
import type { SyncStatus } from '@/types/offline';

export const useSync = () => {
  const storage = useOfflineStorage();
  const { isOnline } = useNetworkStatus();
  
  const [status, setStatus] = useState<SyncStatus>({
    isOnline,
    lastSyncAt: null,
    pendingActions: 0,
    isSyncing: false,
    syncProgress: 0,
    lastError: null
  });

  const syncEngineRef = useRef<SyncEngine | null>(null);

  useEffect(() => {
    if (storage.isReady) {
      syncEngineRef.current = new SyncEngine(storage);
    }
  }, [storage.isReady]);

  // Actualizar estado online
  useEffect(() => {
    setStatus(prev => ({ ...prev, isOnline }));
  }, [isOnline]);

  // Contar acciones pendientes
  useEffect(() => {
    const updatePendingCount = async () => {
      if (storage.isReady) {
        const pending = await storage.getPendingActions();
        setStatus(prev => ({ ...prev, pendingActions: pending.length }));
      }
    };

    updatePendingCount();
    const interval = setInterval(updatePendingCount, 30000);
    return () => clearInterval(interval);
  }, [storage.isReady]);

  // Sincronizar manualmente
  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (!syncEngineRef.current || !isOnline) {
      return null;
    }

    setStatus(prev => ({ ...prev, isSyncing: true, lastError: null }));

    try {
      const result = await syncEngineRef.current.fullSync();
      
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncAt: new Date(),
        pendingActions: prev.pendingActions - result.synced
      }));

      return result;
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastError: (error as Error).message
      }));
      return null;
    }
  }, [isOnline]);

  // Auto-sync cuando vuelve online
  useEffect(() => {
    if (isOnline && status.pendingActions > 0) {
      sync();
    }
  }, [isOnline, status.pendingActions, sync]);

  return {
    status,
    sync,
    isReady: storage.isReady && syncEngineRef.current !== null
  };
};
```

---

## 7. Configuración PWA

### 7.1 Manifest.json

```json
{
  "name": "TMS - Sistema de Gestión de Transporte",
  "short_name": "TMS",
  "description": "Sistema de gestión para empresas de grúas y transporte",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1a1a2e",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide",
      "label": "Dashboard principal"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Vista móvil"
    }
  ],
  "shortcuts": [
    {
      "name": "Nuevo Servicio",
      "short_name": "Servicio",
      "url": "/services/new",
      "icons": [{ "src": "/icons/service.png", "sizes": "96x96" }]
    },
    {
      "name": "Nuevo Costo",
      "short_name": "Costo",
      "url": "/costs/new",
      "icons": [{ "src": "/icons/cost.png", "sizes": "96x96" }]
    }
  ],
  "categories": ["business", "productivity", "utilities"]
}
```

### 7.2 Service Worker

```typescript
// public/sw.js

const CACHE_NAME = 'tms-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - Network First strategy
self.addEventListener('fetch', (event) => {
  // Solo manejar requests GET
  if (event.request.method !== 'GET') return;

  // Ignorar requests de Supabase (API)
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cachear respuesta exitosa
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en cache
        return caches.match(event.request).then((response) => {
          return response || caches.match('/');
        });
      })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

async function syncOfflineActions() {
  // Enviar mensaje al cliente para que sincronice
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_REQUIRED' });
  });
}

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  
  const options = {
    body: data.body || 'Nueva notificación',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Ver' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'TMS', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
```

---

## 8. Estructura de Carpetas Recomendada

```
tms-local-first/
├── public/
│   ├── icons/
│   │   ├── icon-72x72.png
│   │   ├── icon-96x96.png
│   │   ├── icon-128x128.png
│   │   ├── icon-144x144.png
│   │   ├── icon-152x152.png
│   │   ├── icon-192x192.png
│   │   ├── icon-384x384.png
│   │   └── icon-512x512.png
│   ├── screenshots/
│   ├── manifest.json
│   ├── sw.js
│   └── favicon.ico
│
├── src/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...
│   │   │
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── MobileNav.tsx
│   │   │   └── Footer.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── DashboardKPIs.tsx
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── ServicesByTypeChart.tsx
│   │   │   ├── AlertsPanel.tsx
│   │   │   └── RecentActivity.tsx
│   │   │
│   │   ├── services/
│   │   │   ├── ServiceList.tsx
│   │   │   ├── ServiceForm.tsx
│   │   │   ├── ServiceCard.tsx
│   │   │   ├── ServiceDetail.tsx
│   │   │   ├── ServiceCalendar.tsx
│   │   │   ├── ServiceClosure.tsx
│   │   │   ├── InspectionForm.tsx
│   │   │   └── SignatureCapture.tsx
│   │   │
│   │   ├── clients/
│   │   │   ├── ClientList.tsx
│   │   │   ├── ClientForm.tsx
│   │   │   ├── ClientDetail.tsx
│   │   │   ├── ClientRates.tsx
│   │   │   └── ClientMetrics.tsx
│   │   │
│   │   ├── cranes/
│   │   │   ├── CraneList.tsx
│   │   │   ├── CraneForm.tsx
│   │   │   ├── CraneDetail.tsx
│   │   │   ├── CraneParts.tsx
│   │   │   ├── CraneMaintenance.tsx
│   │   │   ├── CraneDocuments.tsx
│   │   │   └── CraneMetrics.tsx
│   │   │
│   │   ├── operators/
│   │   │   ├── OperatorList.tsx
│   │   │   ├── OperatorForm.tsx
│   │   │   ├── OperatorDetail.tsx
│   │   │   ├── OperatorSchedule.tsx
│   │   │   └── OperatorCommissions.tsx
│   │   │
│   │   ├── inventory/
│   │   │   ├── InventoryList.tsx
│   │   │   ├── ItemForm.tsx
│   │   │   ├── MovementForm.tsx
│   │   │   ├── StockTable.tsx
│   │   │   ├── ConsumptionForm.tsx
│   │   │   ├── AlertsConfig.tsx
│   │   │   └── InventoryReports.tsx
│   │   │
│   │   ├── costs/
│   │   │   ├── CostList.tsx
│   │   │   ├── CostForm.tsx
│   │   │   ├── CostDetail.tsx
│   │   │   ├── CategoryManager.tsx
│   │   │   ├── CostAnalysis.tsx
│   │   │   └── SupplierPayments.tsx
│   │   │
│   │   ├── incomes/
│   │   │   ├── IncomeList.tsx
│   │   │   ├── IncomeForm.tsx
│   │   │   └── IncomeAnalysis.tsx
│   │   │
│   │   ├── invoices/
│   │   │   ├── InvoiceList.tsx
│   │   │   ├── InvoiceForm.tsx
│   │   │   ├── InvoiceDetail.tsx
│   │   │   ├── InvoicePreview.tsx
│   │   │   ├── PaymentForm.tsx
│   │   │   └── AgingReport.tsx
│   │   │
│   │   ├── reports/
│   │   │   ├── ReportSelector.tsx
│   │   │   ├── ServiceReport.tsx
│   │   │   ├── FinancialReport.tsx
│   │   │   ├── InventoryReport.tsx
│   │   │   └── ExportButtons.tsx
│   │   │
│   │   ├── calendar/
│   │   │   ├── CalendarView.tsx
│   │   │   ├── EventForm.tsx
│   │   │   └── DayView.tsx
│   │   │
│   │   ├── settings/
│   │   │   ├── CompanySettings.tsx
│   │   │   ├── UserManagement.tsx
│   │   │   ├── CategorySettings.tsx
│   │   │   ├── FolioSettings.tsx
│   │   │   ├── BackupRestore.tsx
│   │   │   └── AlertSettings.tsx
│   │   │
│   │   ├── pwa/
│   │   │   ├── InstallPrompt.tsx
│   │   │   ├── OfflineIndicator.tsx
│   │   │   ├── SyncStatus.tsx
│   │   │   └── UpdatePrompt.tsx
│   │   │
│   │   └── common/
│   │       ├── DataTable.tsx
│   │       ├── SearchInput.tsx
│   │       ├── DateRangePicker.tsx
│   │       ├── FileUpload.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── EmptyState.tsx
│   │
│   ├── hooks/
│   │   ├── useOfflineStorage.ts
│   │   ├── useNetworkStatus.ts
│   │   ├── useSync.ts
│   │   ├── usePWAInstall.ts
│   │   ├── usePWACapabilities.ts
│   │   │
│   │   ├── useServices.ts
│   │   ├── useClients.ts
│   │   ├── useCranes.ts
│   │   ├── useOperators.ts
│   │   ├── useSuppliers.ts
│   │   ├── useInventory.ts
│   │   ├── useCosts.ts
│   │   ├── useIncomes.ts
│   │   ├── useInvoices.ts
│   │   ├── useCalendarEvents.ts
│   │   ├── useNotifications.ts
│   │   │
│   │   ├── useDebounce.ts
│   │   ├── useLocalStorage.ts
│   │   └── useMediaQuery.ts
│   │
│   ├── services/
│   │   ├── SyncEngine.ts
│   │   ├── OfflineService.ts
│   │   ├── PDFService.ts
│   │   ├── ExportService.ts
│   │   └── NotificationService.ts
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   ├── indexedDB.ts
│   │   │   ├── migrations.ts
│   │   │   └── seeds.ts
│   │   │
│   │   ├── utils.ts
│   │   ├── constants.ts
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── calculations.ts
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── services.ts
│   │   ├── clients.ts
│   │   ├── cranes.ts
│   │   ├── operators.ts
│   │   ├── inventory.ts
│   │   ├── costs.ts
│   │   ├── invoices.ts
│   │   └── offline.ts
│   │
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Services.tsx
│   │   ├── ServiceDetail.tsx
│   │   ├── Clients.tsx
│   │   ├── ClientDetail.tsx
│   │   ├── Cranes.tsx
│   │   ├── CraneDetail.tsx
│   │   ├── Operators.tsx
│   │   ├── OperatorDetail.tsx
│   │   ├── Inventory.tsx
│   │   ├── Costs.tsx
│   │   ├── Incomes.tsx
│   │   ├── Invoices.tsx
│   │   ├── InvoiceDetail.tsx
│   │   ├── Reports.tsx
│   │   ├── Calendar.tsx
│   │   ├── Settings.tsx
│   │   ├── Login.tsx
│   │   └── NotFound.tsx
│   │
│   ├── contexts/
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── OfflineContext.tsx
│   │
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
│
├── supabase/
│   ├── config.toml
│   ├── seed.sql
│   └── migrations/
│       └── 00001_initial_schema.sql
│
├── docker/
│   ├── docker-compose.yml
│   └── .env.example
│
├── docs/
│   ├── README.md
│   ├── architecture/
│   ├── api/
│   └── guides/
│
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 9. Prioridades de Implementación

### Fase 1: Core Local (MVP) - 4-6 semanas

1. **Semana 1-2: Infraestructura**
   - Setup proyecto (Vite + React + TypeScript)
   - Configurar Tailwind + shadcn/ui
   - Implementar IndexedDB base
   - Layout principal y navegación

2. **Semana 3-4: Entidades Core**
   - CRUD Clientes
   - CRUD Grúas
   - CRUD Operadores
   - Validaciones y formularios

3. **Semana 5-6: Servicios**
   - CRUD Servicios con folio offline
   - Estados de servicio
   - Captura de firma
   - Inspección pre-servicio

### Fase 2: PWA + Offline Completo - 3-4 semanas

1. **Semana 7-8: PWA**
   - Manifest.json
   - Service Worker
   - Prompt de instalación
   - Indicadores de estado offline

2. **Semana 9-10: Offline Actions**
   - Cola de acciones offline
   - Generación de folios offline
   - Cache de datos maestros
   - Sincronización básica

### Fase 3: Módulos Financieros - 4-5 semanas

1. **Semana 11-12: Costos**
   - CRUD Costos con categorías
   - Asociación a servicios/grúas
   - Análisis por categoría

2. **Semana 13-14: Ingresos y Facturación**
   - CRUD Ingresos
   - Generación de facturas
   - Pagos y estados

3. **Semana 15: Reportes**
   - Dashboard con KPIs
   - Reportes básicos
   - Exportación Excel/PDF

### Fase 4: Inventario y Avanzado - 3-4 semanas

1. **Semana 16-17: Inventario**
   - Items y categorías
   - Movimientos entrada/salida
   - Stock por ubicación
   - Alertas de stock bajo

2. **Semana 18-19: Sincronización**
   - SyncEngine completo
   - Resolución de conflictos
   - Supabase Self-Hosted setup

### Fase 5: Polish y Optimización - 2-3 semanas

1. **Semana 20-21: UX y Performance**
   - Optimización de queries
   - Lazy loading
   - Animaciones
   - Accesibilidad

2. **Semana 22: Testing y Deploy**
   - Tests unitarios críticos
   - Tests E2E básicos
   - Documentación
   - Deploy inicial

---

## 10. Consideraciones Especiales Chile

### 10.1 Validación de RUT

```typescript
// src/lib/validators.ts

export function validateRUT(rut: string): boolean {
  // Limpiar RUT
  const cleanRUT = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  
  if (cleanRUT.length < 8 || cleanRUT.length > 9) {
    return false;
  }
  
  const body = cleanRUT.slice(0, -1);
  const dv = cleanRUT.slice(-1);
  
  // Calcular dígito verificador
  let sum = 0;
  let multiplier = 2;
  
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  
  const expectedDV = 11 - (sum % 11);
  let calculatedDV: string;
  
  if (expectedDV === 11) calculatedDV = '0';
  else if (expectedDV === 10) calculatedDV = 'K';
  else calculatedDV = expectedDV.toString();
  
  return dv === calculatedDV;
}

export function formatRUT(rut: string): string {
  const cleanRUT = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  
  if (cleanRUT.length < 2) return cleanRUT;
  
  const body = cleanRUT.slice(0, -1);
  const dv = cleanRUT.slice(-1);
  
  // Formatear con puntos y guión
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `${formattedBody}-${dv}`;
}
```

### 10.2 Cálculo de IVA (19%)

```typescript
// src/lib/calculations.ts

const VAT_RATE = 0.19; // 19% IVA Chile

export interface TaxCalculation {
  subtotal: number;
  vat: number;
  total: number;
}

export function calculateWithVAT(subtotal: number): TaxCalculation {
  const vat = Math.round(subtotal * VAT_RATE);
  const total = subtotal + vat;
  
  return { subtotal, vat, total };
}

export function calculateFromTotal(total: number): TaxCalculation {
  const subtotal = Math.round(total / (1 + VAT_RATE));
  const vat = total - subtotal;
  
  return { subtotal, vat, total };
}

// Formatear moneda CLP (sin decimales)
export function formatCLP(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}
```

### 10.3 Zona Horaria y Formato de Fecha

```typescript
// src/lib/formatters.ts

import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

const TIMEZONE = 'America/Santiago';

export function formatDate(date: Date | string, pattern = 'dd/MM/yyyy'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const zonedDate = toZonedTime(dateObj, TIMEZONE);
  return format(zonedDate, pattern, { locale: es });
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

export function formatDateLong(date: Date | string): string {
  return formatDate(date, "d 'de' MMMM 'de' yyyy");
}

export function getChileNow(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

export function toChileISO(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
}
```

### 10.4 Formato de Folios SII

```typescript
// src/lib/folio.ts

export interface FolioConfig {
  prefix: string;
  yearFormat: 'YYYY' | 'YY';
  numberPadding: number;
  separator: string;
}

export const FOLIO_CONFIGS: Record<string, FolioConfig> = {
  service: {
    prefix: 'SRV',
    yearFormat: 'YYYY',
    numberPadding: 6,
    separator: '-'
  },
  invoice: {
    prefix: 'FAC',
    yearFormat: 'YYYY',
    numberPadding: 8,
    separator: '-'
  },
  closure: {
    prefix: 'CIE',
    yearFormat: 'YYYY',
    numberPadding: 6,
    separator: '-'
  },
  excess: {
    prefix: 'EXC',
    yearFormat: 'YYYY',
    numberPadding: 6,
    separator: '-'
  }
};

export function generateFolio(
  type: keyof typeof FOLIO_CONFIGS,
  number: number,
  date: Date = new Date()
): string {
  const config = FOLIO_CONFIGS[type];
  const year = config.yearFormat === 'YYYY' 
    ? date.getFullYear().toString()
    : date.getFullYear().toString().slice(-2);
  
  const paddedNumber = number.toString().padStart(config.numberPadding, '0');
  
  return `${config.prefix}${config.separator}${year}${config.separator}${paddedNumber}`;
}

export function parseFolio(folio: string): {
  type: string;
  year: number;
  number: number;
} | null {
  const parts = folio.split('-');
  if (parts.length !== 3) return null;
  
  return {
    type: parts[0],
    year: parseInt(parts[1]),
    number: parseInt(parts[2])
  };
}
```

---

## 11. Sistema de Cálculo de Costos de Transporte

### 11.1 Maestro de Rutas

```typescript
// src/types/transport.ts

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance_km: number;
  estimated_time_minutes: number;
  toll_ids: string[];
  is_active: boolean;
  notes?: string;
}

export interface Toll {
  id: string;
  name: string;
  location: string;
  cost: number;
  direction: 'ida' | 'vuelta' | 'ambos';
  is_active: boolean;
}

export interface FuelPrice {
  id: string;
  fuel_type: 'diesel' | 'bencina_93' | 'bencina_95' | 'bencina_97';
  price_per_liter: number;
  effective_date: string;
  supplier?: string;
}
```

### 11.2 Calculadora de Costos

```typescript
// src/services/TransportCostCalculator.ts

export interface TransportCostInput {
  route?: Route;
  distance_km: number;
  crane_id: string;
  include_return: boolean;
  tolls?: Toll[];
  fuel_price?: FuelPrice;
}

export interface TransportCostResult {
  fuel_cost: number;
  toll_cost: number;
  total_cost: number;
  breakdown: {
    distance_km: number;
    fuel_consumption_liters: number;
    fuel_price_per_liter: number;
    toll_items: { name: string; cost: number }[];
  };
}

export class TransportCostCalculator {
  // Consumo promedio por tipo de grúa (litros/100km)
  private static FUEL_CONSUMPTION: Record<string, number> = {
    'Grúa Pluma': 25,
    'Grúa Horquilla': 15,
    'Camión Pluma': 20,
    'Grúa Articulada': 22,
    'Grúa Telescópica': 28,
    'Manipulador Telescópico': 18
  };

  static calculate(input: TransportCostInput, craneType: string): TransportCostResult {
    const distance = input.include_return ? input.distance_km * 2 : input.distance_km;
    const consumption100km = this.FUEL_CONSUMPTION[craneType] || 20;
    const fuelConsumption = (distance / 100) * consumption100km;
    const fuelPrice = input.fuel_price?.price_per_liter || 1000;
    const fuelCost = Math.round(fuelConsumption * fuelPrice);

    const tollItems: { name: string; cost: number }[] = [];
    let tollCost = 0;

    if (input.tolls) {
      for (const toll of input.tolls) {
        if (toll.direction === 'ambos' || toll.direction === 'ida') {
          tollItems.push({ name: `${toll.name} (ida)`, cost: toll.cost });
          tollCost += toll.cost;
        }
        if (input.include_return && (toll.direction === 'ambos' || toll.direction === 'vuelta')) {
          tollItems.push({ name: `${toll.name} (vuelta)`, cost: toll.cost });
          tollCost += toll.cost;
        }
      }
    }

    return {
      fuel_cost: fuelCost,
      toll_cost: tollCost,
      total_cost: fuelCost + tollCost,
      breakdown: {
        distance_km: distance,
        fuel_consumption_liters: Math.round(fuelConsumption * 100) / 100,
        fuel_price_per_liter: fuelPrice,
        toll_items: tollItems
      }
    };
  }
}
```

---

## 12. Patrones de Código Ejemplo

### 12.1 Hook de Entidad con Soporte Offline

```typescript
// src/hooks/useServices.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineStorage } from './useOfflineStorage';
import { useNetworkStatus } from './useNetworkStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Service, ServiceFormData } from '@/types/services';

export const useServices = () => {
  const queryClient = useQueryClient();
  const storage = useOfflineStorage();
  const { isOnline } = useNetworkStatus();

  // Fetch services
  const { data: services, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      if (isOnline) {
        const { data, error } = await supabase
          .from('services')
          .select(`
            *,
            clients(id, name, rut),
            cranes(id, license_plate, type),
            operators(id, name)
          `)
          .order('service_date', { ascending: false });

        if (error) throw error;

        // Cache para offline
        if (storage.isReady) {
          await storage.cacheData(storage.stores.SERVICES, data);
        }

        return data;
      } else {
        // Usar datos cacheados
        return storage.getAll<Service>(storage.stores.SERVICES);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Create service
  const createMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      if (isOnline) {
        const { data: newService, error } = await supabase
          .from('services')
          .insert(data)
          .select()
          .single();

        if (error) throw error;
        return newService;
      } else {
        // Generar folio offline
        const folio = await storage.generateOfflineFolio('service');
        const offlineService: Service = {
          ...data,
          id: crypto.randomUUID(),
          folio,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Guardar localmente
        await storage.put(storage.stores.SERVICES, offlineService);

        // Agregar a cola de sincronización
        await storage.addOfflineAction({
          type: 'CREATE',
          entity: 'services',
          entityId: offlineService.id,
          data: offlineService
        });

        return offlineService;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    }
  });

  // Update service
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Service> }) => {
      if (isOnline) {
        const { data: updated, error } = await supabase
          .from('services')
          .update(data)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        return updated;
      } else {
        const existing = await storage.getById<Service>(storage.stores.SERVICES, id);
        if (!existing) throw new Error('Service not found');

        const updated = { ...existing, ...data, updated_at: new Date().toISOString() };
        await storage.put(storage.stores.SERVICES, updated);

        await storage.addOfflineAction({
          type: 'UPDATE',
          entity: 'services',
          entityId: id,
          data: updated
        });

        return updated;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    }
  });

  return {
    services,
    isLoading,
    createService: createMutation.mutateAsync,
    updateService: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending
  };
};
```

### 12.2 Componente de Formulario

```typescript
// src/components/services/ServiceForm.tsx

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { useServices } from '@/hooks/useServices';
import { useClients } from '@/hooks/useClients';
import { useCranes } from '@/hooks/useCranes';
import { useOperators } from '@/hooks/useOperators';

const serviceSchema = z.object({
  client_id: z.string().min(1, 'Seleccione un cliente'),
  crane_id: z.string().optional(),
  operator_id: z.string().optional(),
  service_date: z.date({ required_error: 'Seleccione una fecha' }),
  location: z.string().min(1, 'Ingrese la ubicación'),
  description: z.string().optional(),
  hourly_rate: z.number().min(0).optional()
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ServiceForm({ onSuccess, onCancel }: ServiceFormProps) {
  const { createService, isCreating } = useServices();
  const { clients } = useClients();
  const { cranes } = useCranes();
  const { operators } = useOperators();

  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      service_date: new Date(),
      location: ''
    }
  });

  const onSubmit = async (data: ServiceFormData) => {
    try {
      await createService({
        ...data,
        service_date: format(data.service_date, 'yyyy-MM-dd'),
        status: 'pendiente'
      });
      onSuccess();
    } catch (error) {
      console.error('Error creating service:', error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Cliente */}
        <FormField
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un cliente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} - {client.rut}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Fecha */}
        <FormField
          control={form.control}
          name="service_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha del Servicio</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      className="w-full pl-3 text-left font-normal"
                    >
                      {field.value ? (
                        format(field.value, 'PPP', { locale: es })
                      ) : (
                        <span>Seleccione una fecha</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    locale={es}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Ubicación */}
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ubicación</FormLabel>
              <FormControl>
                <Input placeholder="Dirección del servicio" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Grúa */}
        <FormField
          control={form.control}
          name="crane_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Grúa (Opcional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione una grúa" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {cranes?.filter(c => c.is_active).map((crane) => (
                    <SelectItem key={crane.id} value={crane.id}>
                      {crane.license_plate} - {crane.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Operador */}
        <FormField
          control={form.control}
          name="operator_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Operador (Opcional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un operador" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {operators?.filter(o => o.is_active).map((operator) => (
                    <SelectItem key={operator.id} value={operator.id}>
                      {operator.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Botones */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Servicio
          </Button>
        </div>
      </form>
    </Form>
  );
}
```

---

## 13. Notas Finales

### Requisitos del Sistema
- Node.js 18+
- npm o bun
- Docker (para Supabase Self-Hosted)
- Navegador moderno con soporte IndexedDB

### Comando de Inicio

```bash
# Instalar dependencias
npm install

# Desarrollo
npm run dev

# Build producción
npm run build

# Supabase Self-Hosted
cd docker && docker-compose up -d
```

### Recursos Adicionales
- [Documentación React](https://react.dev/)
- [Documentación Tailwind CSS](https://tailwindcss.com/)
- [Documentación shadcn/ui](https://ui.shadcn.com/)
- [Documentación Supabase](https://supabase.com/docs)
- [IndexedDB API](https://developer.mozilla.org/es/docs/Web/API/IndexedDB_API)
- [PWA Guidelines](https://web.dev/progressive-web-apps/)

---

*Documento generado para construcción de TMS Local-First*
*Versión: 1.0*
*Fecha: Enero 2026*
