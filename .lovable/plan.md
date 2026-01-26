
## Plan: Sistema de Historial de Cambios en Servicios

### Objetivo
Implementar un registro completo de auditoría que capture automáticamente todos los cambios realizados en los servicios, permitiendo visualizar quién modificó qué campo, cuándo, y cuáles fueron los valores anteriores y nuevos.

---

### Componentes del Sistema

#### 1. Nueva Tabla: `service_change_history`
Crear una tabla específica para almacenar el historial de cambios de servicios:

```text
┌────────────────────────────────────────────────────────────────┐
│                    service_change_history                       │
├──────────────────┬──────────────────┬──────────────────────────┤
│ id               │ UUID (PK)        │ Identificador único      │
│ service_id       │ UUID (FK)        │ Referencia al servicio   │
│ service_folio    │ TEXT             │ Folio para referencia    │
│ changed_by       │ UUID (FK)        │ Usuario que hizo cambio  │
│ changed_at       │ TIMESTAMPTZ      │ Fecha/hora del cambio    │
│ change_type      │ TEXT             │ CREATE/UPDATE/DELETE     │
│ field_name       │ TEXT             │ Campo modificado         │
│ old_value        │ TEXT             │ Valor anterior           │
│ new_value        │ TEXT             │ Valor nuevo              │
│ change_context   │ TEXT             │ Contexto (form/batch/api)│
│ change_summary   │ TEXT             │ Resumen legible          │
└──────────────────┴──────────────────┴──────────────────────────┘
```

---

### Arquitectura del Sistema

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         FLUJO DE AUDITORÍA                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌───────────────────┐    ┌──────────────────┐ │
│  │  Frontend    │───▶│  useServiceManager│───▶│   Supabase DB    │ │
│  │  (Formulario)│    │   (Hook)          │    │   (services)     │ │
│  └──────────────┘    └───────────────────┘    └────────┬─────────┘ │
│                                                         │           │
│                                                         ▼           │
│                                              ┌──────────────────┐   │
│                                              │  Trigger SQL     │   │
│                                              │  track_service   │   │
│                                              │  _changes        │   │
│                                              └────────┬─────────┘   │
│                                                       │             │
│                                                       ▼             │
│                                              ┌──────────────────┐   │
│                                              │ service_change   │   │
│                                              │ _history         │   │
│                                              └──────────────────┘   │
│                                                       │             │
│                                                       ▼             │
│  ┌──────────────┐                            ┌──────────────────┐   │
│  │  Modal       │◀───────────────────────────│ useServiceChange │   │
│  │  Detalles    │                            │ History (Hook)   │   │
│  │  (Nueva Tab) │                            └──────────────────┘   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Campos a Trackear

Los siguientes campos serán monitoreados automáticamente:

| Campo | Descripción | Ejemplo de Cambio |
|-------|-------------|-------------------|
| `value` | Valor del servicio | "$500.000 → $600.000" |
| `purchase_order` | Orden de compra | "null → OC-12345" |
| `quote_number` | Número cotización | "COT-001 → COT-002" |
| `status` | Estado del servicio | "pending → completed" |
| `operator_commission` | Comisión operador | "$30.000 → $40.000" |
| `client_covered_amount` | Monto cubierto | "$400.000 → $450.000" |
| `excess_amount` | Excedente | "$100.000 → $150.000" |
| `insured_name` | Nombre asegurado | "Juan → Pedro" |
| `origin` | Origen | "Santiago → Providencia" |
| `destination` | Destino | "Viña → Valparaíso" |
| `observations` | Observaciones | Cambios de texto |

---

### Implementación

#### Paso 1: Migración SQL - Crear tabla e índices

```sql
-- Crear tabla de historial
CREATE TABLE public.service_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  service_folio TEXT NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  change_type TEXT NOT NULL CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE')),
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  change_context TEXT DEFAULT 'manual',
  change_summary TEXT
);

-- Índices para performance
CREATE INDEX idx_service_change_history_service_id ON service_change_history(service_id);
CREATE INDEX idx_service_change_history_changed_at ON service_change_history(changed_at DESC);
CREATE INDEX idx_service_change_history_field_name ON service_change_history(field_name);

-- Habilitar RLS
ALTER TABLE service_change_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view change history" ON service_change_history
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert" ON service_change_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

#### Paso 2: Trigger SQL para captura automática

```sql
CREATE OR REPLACE FUNCTION track_service_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_field_labels JSONB := '{
    "value": "Valor del Servicio",
    "purchase_order": "Orden de Compra",
    "quote_number": "Número de Cotización",
    "status": "Estado",
    "operator_commission": "Comisión Operador",
    "client_covered_amount": "Monto Cubierto Cliente",
    "excess_amount": "Excedente",
    "insured_name": "Nombre Asegurado",
    "origin": "Origen",
    "destination": "Destino",
    "observations": "Observaciones",
    "vehicle_brand": "Marca Vehículo",
    "vehicle_model": "Modelo Vehículo",
    "license_plate": "Patente"
  }';
  v_field_name TEXT;
  v_old_value TEXT;
  v_new_value TEXT;
  v_label TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO service_change_history (service_id, service_folio, changed_by, change_type, field_name, new_value, change_summary)
    VALUES (NEW.id, NEW.folio, v_user_id, 'CREATE', 'servicio', NULL, 'Servicio creado');
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Comparar campos clave
    FOREACH v_field_name IN ARRAY ARRAY['value', 'purchase_order', 'quote_number', 'status', 
      'operator_commission', 'client_covered_amount', 'excess_amount', 'insured_name',
      'origin', 'destination', 'observations', 'vehicle_brand', 'vehicle_model', 'license_plate'] LOOP
      
      EXECUTE format('SELECT ($1).%I::TEXT, ($2).%I::TEXT', v_field_name, v_field_name) 
        INTO v_old_value, v_new_value USING OLD, NEW;
      
      IF v_old_value IS DISTINCT FROM v_new_value THEN
        v_label := COALESCE(v_field_labels->>v_field_name, v_field_name);
        
        INSERT INTO service_change_history (service_id, service_folio, changed_by, change_type, field_name, old_value, new_value, change_summary)
        VALUES (NEW.id, NEW.folio, v_user_id, 'UPDATE', v_field_name, v_old_value, v_new_value, 
          format('%s: %s → %s', v_label, COALESCE(v_old_value, 'vacío'), COALESCE(v_new_value, 'vacío')));
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    INSERT INTO service_change_history (service_id, service_folio, changed_by, change_type, field_name, old_value, change_summary)
    VALUES (OLD.id, OLD.folio, v_user_id, 'DELETE', 'servicio', OLD.folio, 'Servicio eliminado');
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_track_service_changes
AFTER INSERT OR UPDATE OR DELETE ON services
FOR EACH ROW EXECUTE FUNCTION track_service_changes();
```

---

#### Paso 3: Hook React `useServiceChangeHistory`

Crear hook para obtener el historial:

```typescript
// src/hooks/useServiceChangeHistory.ts
export interface ServiceChangeEntry {
  id: string;
  serviceId: string;
  serviceFolio: string;
  changedBy: string | null;
  changerName: string | null;
  changerEmail: string | null;
  changedAt: string;
  changeType: 'CREATE' | 'UPDATE' | 'DELETE';
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changeSummary: string | null;
}

export const useServiceChangeHistory = (serviceId: string | null) => {
  // Query al historial con JOIN a profiles para nombres
};
```

---

#### Paso 4: Componente `ServiceChangeHistory.tsx`

Nuevo componente visual siguiendo el patrón del módulo de Costos:

```text
┌───────────────────────────────────────────────────────────────┐
│  📋 Historial de Cambios                    12 cambios       │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  🟢 26/01/2026 10:30 - Juan Pérez                            │
│  ├── Valor: $500.000 → $600.000                              │
│  └── Orden de Compra: (vacío) → OC-12345                     │
│                                                               │
│  🟡 25/01/2026 15:20 - María García                          │
│  └── Estado: pending → completed                             │
│                                                               │
│  🔵 24/01/2026 09:00 - Sistema                               │
│  └── Servicio creado                                         │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

Características:
- Agrupación por fecha y usuario
- Badges de colores por tipo de cambio (CREATE/UPDATE/DELETE)
- Valores formateados (moneda, estados legibles)
- Scroll infinito o paginación

---

#### Paso 5: Integrar nueva Tab en ServiceDetailsModal

Agregar una nueva tab "Cambios" al modal de detalles de servicios:

```tsx
<Tabs defaultValue="general">
  <TabsList className="grid w-full grid-cols-4">  {/* Cambiar a 4 columnas */}
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="costs">Costos</TabsTrigger>
    <TabsTrigger value="history">Historial</TabsTrigger>
    <TabsTrigger value="changes">Cambios</TabsTrigger>  {/* Nueva */}
  </TabsList>
  
  {/* ... tabs existentes ... */}
  
  <TabsContent value="changes">
    <ServiceChangeHistory serviceId={serviceData.id} />
  </TabsContent>
</Tabs>
```

---

### Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `supabase/migrations/XXXX_service_change_history.sql` | Crear | Tabla, trigger, índices y RLS |
| `src/hooks/useServiceChangeHistory.ts` | Crear | Hook para obtener historial |
| `src/components/services/ServiceChangeHistory.tsx` | Crear | Componente visual del historial |
| `src/components/services/ServiceDetailsModal.tsx` | Modificar | Agregar nueva tab "Cambios" |
| `src/integrations/supabase/types.ts` | Actualizar | Se actualizará automáticamente |

---

### Resultado Esperado

1. **Auditoría Automática**: Cada cambio en servicios se registra automáticamente vía trigger
2. **Trazabilidad Completa**: Se conoce quién, cuándo, y qué cambió
3. **Visualización Clara**: Nueva tab en detalles muestra historial ordenado cronológicamente
4. **Campos Críticos**: Value, OC, cotización, estado, comisiones, excedente trackeados
5. **Performance**: Índices optimizados para consultas rápidas
6. **Consistencia**: Sigue patrones visuales del módulo de Costos
