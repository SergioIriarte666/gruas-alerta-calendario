# ⚙️ Guía de Configuración - TMS Grúas v2.1.0

## 🎯 Configuración Inicial del Sistema

### 1. Configuración de Empresa
```typescript
// Datos básicos de la empresa
interface CompanyConfig {
  name: string;           // "Grúas Ejemplo S.A."
  ruc: string;           // "12345678-9"
  address: string;       // Dirección completa
  phone: string;         // Teléfono principal
  email: string;         // Email de contacto
  logo_url?: string;     // URL del logo
  website?: string;      // Sitio web
}
```

#### Configurar desde la UI
1. Ir a **Configuración > Empresa**
2. Completar todos los campos obligatorios
3. Subir logo (formato PNG/JPG, max 2MB)
4. Guardar configuración

#### Configurar vía Base de Datos
```sql
-- Insertar datos de empresa
INSERT INTO company_settings (
  name, ruc, address, phone, email, logo_url, website
) VALUES (
  'Grúas Ejemplo S.A.',
  '12345678-9',
  'Av. Principal 123, Ciudad',
  '+56912345678',
  'contacto@gruasejemplo.cl',
  'https://tu-bucket.supabase.co/logo.png',
  'https://gruasejemplo.cl'
);
```

### 2. Configuración de Usuarios y Roles

#### Roles Disponibles
- **`admin`**: Acceso completo al sistema
- **`manager`**: Gestión operativa, sin acceso a configuración crítica
- **`operator`**: Operador de grúas, acceso limitado
- **`client`**: Cliente, solo portal público

#### Crear Usuario Administrador
```sql
-- Crear perfil de administrador
INSERT INTO profiles (
  user_id,
  full_name,
  role,
  permissions,
  is_active
) VALUES (
  'uuid-del-usuario',
  'Administrador Principal',
  'admin',
  '["all"]',
  true
);
```

#### Configurar Permisos Personalizados
```typescript
interface UserPermissions {
  services: ['read', 'write', 'delete'];
  inventory: ['read', 'write'];
  clients: ['read', 'write'];
  reports: ['read'];
  settings: ['read'];
}
```

### 3. Configuración de Inventario

#### Configuración Básica
```typescript
interface InventoryConfig {
  // Alertas automáticas
  low_stock_threshold: number;      // 10 unidades
  critical_stock_threshold: number; // 2 unidades
  overstock_threshold: number;      // 200% del máximo
  
  // Ubicaciones
  enable_multi_location: boolean;   // true para múltiples bodegas
  default_location: string;         // 'bodega-principal'
  
  // Movimientos
  require_approval: boolean;        // true para movimientos grandes
  auto_calculate_costs: boolean;    // true para costeo automático
}
```

#### Configurar Ubicaciones de Inventario
```sql
-- Crear ubicaciones de inventario
INSERT INTO inventory_locations (name, type, is_active) VALUES 
('Bodega Principal', 'warehouse', true),
('Vehículo 001', 'vehicle', true),
('Vehículo 002', 'vehicle', true),
('Almacén Temporal', 'warehouse', true);
```

#### Configurar Categorías de Productos
```sql
-- Crear categorías de inventario
INSERT INTO inventory_categories (name, description, color) VALUES
('Herramientas', 'Herramientas y equipamiento', '#3B82F6'),
('Repuestos', 'Repuestos y componentes', '#EF4444'),
('Combustibles', 'Combustibles y lubricantes', '#F59E0B'),
('Materiales', 'Materiales de construcción', '#10B981');
```

### 4. Configuración de Notificaciones

#### Email (SMTP)
```env
# Configuración SMTP
VITE_SMTP_HOST=smtp.gmail.com
VITE_SMTP_PORT=587
VITE_SMTP_USER=tu-email@gmail.com
VITE_SMTP_PASS=tu-password-app
VITE_SMTP_FROM=noreply@tuempresa.com
```

#### Push Notifications
```typescript
interface PushConfig {
  enabled: boolean;
  service: 'firebase' | 'onesignal';
  api_key: string;
  project_id: string;
}
```

#### Configurar Plantillas de Email
```sql
-- Plantillas de notificación
INSERT INTO notification_templates (type, subject, body_html) VALUES
('low_stock', 
 'Alerta: Stock Bajo - {{item_name}}',
 '<h2>Stock Bajo Detectado</h2><p>El producto {{item_name}} tiene solo {{current_stock}} unidades disponibles.</p>'
),
('service_completed',
 'Servicio Completado - {{service_number}}',
 '<h2>Servicio Finalizado</h2><p>El servicio {{service_number}} ha sido completado exitosamente.</p>'
);
```

### 5. Configuración de Facturación

#### Configuración Regional
```typescript
interface BillingConfig {
  // Formato de números
  currency: 'CLP' | 'USD' | 'EUR';     // CLP para Chile
  tax_rate: number;                     // 19% IVA en Chile
  
  // Numeración
  invoice_prefix: string;               // 'FAC-'
  invoice_start_number: number;         // 1000
  
  // Formatos
  date_format: 'DD/MM/YYYY' | 'MM/DD/YYYY'; // DD/MM/YYYY para Chile
  number_format: 'es-CL' | 'en-US';         // es-CL para Chile
}
```

#### Configurar Series de Facturación
```sql
-- Series de documentos
INSERT INTO billing_series (type, prefix, current_number, format) VALUES
('invoice', 'FAC-', 1000, 'FAC-{{YYYY}}-{{NNNN}}'),
('quote', 'COT-', 100, 'COT-{{YYYY}}-{{NNNN}}'),
('receipt', 'REC-', 500, 'REC-{{YYYY}}-{{NNNN}}');
```

### 6. Configuración de Grúas y Vehículos

#### Configurar Tipos de Grúas
```sql
-- Tipos y capacidades de grúas
INSERT INTO crane_types (name, max_capacity, description) VALUES
('Grúa Móvil 25T', 25000, 'Grúa móvil de 25 toneladas'),
('Grúa Torre', 50000, 'Grúa torre para construcción'),
('Grúa Todo Terreno', 40000, 'Grúa todo terreno 40T');
```

#### Configurar Vehículos
```sql
-- Registrar vehículos de la flota
INSERT INTO vehicles (plate, brand, model, year, crane_type_id, is_active) VALUES
('ABC-123', 'Mercedes-Benz', 'Atego 1725', 2020, 1, true),
('DEF-456', 'Volvo', 'FH16', 2019, 2, true),
('GHI-789', 'Scania', 'R580', 2021, 3, true);
```

### 7. Configuración del Portal de Clientes

#### Configuración Básica
```typescript
interface ClientPortalConfig {
  // Acceso
  allow_self_registration: boolean;    // false - solo invitación
  require_email_verification: boolean; // true
  
  // Funcionalidades
  show_service_history: boolean;       // true
  allow_new_requests: boolean;         // true
  show_invoices: boolean;              // true
  allow_invoice_download: boolean;     // true
  
  // Restricciones
  max_file_upload_mb: number;          // 10MB
  allowed_file_types: string[];        // ['pdf', 'jpg', 'png']
}
```

#### Configurar RLS para Clientes
```sql
-- Política de seguridad para clientes
CREATE POLICY "Clients can only see their own data" ON services
FOR SELECT USING (
  client_id IN (
    SELECT client_id FROM profiles 
    WHERE user_id = auth.uid()
  )
);
```

### 8. Configuración de Backups y Seguridad

#### Backup Automático
```typescript
interface BackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  retention_days: number;            // 30 días
  include_files: boolean;           // true para incluir archivos
  notification_email: string;      // Email de notificación
}
```

#### Configuración de Seguridad
```typescript
interface SecurityConfig {
  // Sesiones
  session_timeout_minutes: number;     // 480 (8 horas)
  max_failed_attempts: number;         // 5
  lockout_duration_minutes: number;    // 30
  
  // Passwords
  min_password_length: number;         // 8
  require_special_chars: boolean;      // true
  require_numbers: boolean;            // true
  password_expiry_days: number;        // 90
}
```

## 📝 Scripts de Configuración Automatizada

### Script de Configuración Inicial
```bash
#!/bin/bash
# setup-initial-config.sh

echo "🚀 Configurando TMS Grúas v2.1.0..."

# 1. Variables de entorno
cp .env.example .env.local
echo "✅ Archivo .env.local creado"

# 2. Base de datos
npx supabase db reset
echo "✅ Base de datos inicializada"

# 3. Datos de prueba (opcional)
# npm run seed:demo
# echo "✅ Datos de demo insertados"

echo "🎉 Configuración inicial completada"
echo "👉 Siguiente paso: npm run dev"
```

### Configuración Masiva vía SQL
```sql
-- Configuración completa del sistema
BEGIN;

-- Empresa
INSERT INTO company_settings (...) VALUES (...);

-- Usuarios iniciales
INSERT INTO profiles (...) VALUES (...);

-- Configuración de inventario
INSERT INTO inventory_config (...) VALUES (...);

-- Configuración de facturación
INSERT INTO billing_config (...) VALUES (...);

COMMIT;
```

## 🔍 Validación de Configuración

### Checklist de Configuración
- [ ] Datos de empresa completados
- [ ] Usuario administrador creado
- [ ] Ubicaciones de inventario configuradas
- [ ] Tipos de grúas registrados
- [ ] Series de facturación definidas
- [ ] Notificaciones funcionando
- [ ] Portal de clientes accesible
- [ ] Backups programados

### Test de Configuración
```bash
# Ejecutar tests de configuración
npm run test:config

# Verificar conectividad
npm run test:connectivity

# Validar permisos
npm run test:permissions
```

---

*Siguiente: [🎯 Primeros Pasos](first-steps.md)*