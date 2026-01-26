

## Plan: Snapshot Inicial de Servicios Existentes

### Objetivo
Crear un registro inicial en `service_change_history` para todos los servicios existentes, estableciendo el estado actual de cada campo como punto de partida para el historial de cambios.

---

### Estrategia

El snapshot registrará cada servicio con tipo `SNAPSHOT` (agregaremos este tipo) y guardará el valor actual de cada campo trackeado. Esto permitirá:
1. Ver los valores que tenía el servicio al momento del snapshot
2. Tener una referencia base para comparar cambios futuros
3. Identificar claramente qué registros son históricos vs automáticos

---

### Cambios a Realizar

#### 1. Modificar restricción de `change_type`
Agregar `SNAPSHOT` como tipo válido de cambio:

```sql
ALTER TABLE service_change_history 
DROP CONSTRAINT service_change_history_change_type_check;

ALTER TABLE service_change_history 
ADD CONSTRAINT service_change_history_change_type_check 
CHECK (change_type IN ('CREATE', 'UPDATE', 'DELETE', 'SNAPSHOT'));
```

#### 2. Insertar snapshot de todos los servicios
Para cada servicio existente, crear un registro por cada campo con valor no nulo:

```sql
INSERT INTO service_change_history (
  service_id, 
  service_folio, 
  changed_by, 
  changed_at, 
  change_type, 
  field_name, 
  old_value, 
  new_value, 
  change_context, 
  change_summary
)
SELECT 
  s.id,
  s.folio,
  s.created_by,  -- Usar el creador original del servicio
  s.created_at,  -- Usar la fecha de creación original
  'SNAPSHOT',
  'servicio',
  NULL,
  jsonb_build_object(
    'value', s.value,
    'purchase_order', s.purchase_order,
    'quote_number', s.quote_number,
    'status', s.status,
    'operator_commission', s.operator_commission,
    'client_covered_amount', s.client_covered_amount,
    'excess_amount', s.excess_amount,
    'insured_name', s.insured_name,
    'origin', s.origin,
    'destination', s.destination,
    'observations', s.observations,
    'vehicle_brand', s.vehicle_brand,
    'vehicle_model', s.vehicle_model,
    'license_plate', s.license_plate
  )::TEXT,
  'snapshot_inicial',
  'Snapshot inicial - Estado del servicio al momento de activar el historial'
FROM services s
WHERE NOT EXISTS (
  SELECT 1 FROM service_change_history h 
  WHERE h.service_id = s.id
);
```

#### 3. Actualizar componente visual
Modificar `ServiceChangeHistory.tsx` para mostrar el badge de SNAPSHOT con un color distintivo (azul):

```typescript
const getChangeTypeBadge = (changeType: string) => {
  switch (changeType) {
    case 'CREATE':
      return <Badge className="bg-green-100 text-green-800">Creado</Badge>;
    case 'UPDATE':
      return <Badge className="bg-yellow-100 text-yellow-800">Modificado</Badge>;
    case 'DELETE':
      return <Badge className="bg-red-100 text-red-800">Eliminado</Badge>;
    case 'SNAPSHOT':
      return <Badge className="bg-blue-100 text-blue-800">Estado Inicial</Badge>;
    default:
      return <Badge>{changeType}</Badge>;
  }
};
```

#### 4. Formato especial para visualizar snapshot
Los snapshots se mostrarán de forma diferente, mostrando todos los valores en un formato de lista:

```text
┌───────────────────────────────────────────────────────────────┐
│  📸 Estado Inicial                                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  🔵 24/01/2026 09:00 - Juan Pérez                       │  │
│  │  Estado Inicial del Servicio                            │  │
│  │  ├── Valor: $1.200.000                                  │  │
│  │  ├── OC: OC-12345                                       │  │
│  │  ├── Estado: completed                                  │  │
│  │  ├── Origen: Santiago Centro                           │  │
│  │  └── Destino: Viña del Mar                              │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

### Archivos a Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| Migración SQL | Crear | Modificar constraint y ejecutar snapshot |
| `src/components/services/ServiceChangeHistory.tsx` | Modificar | Agregar badge y visualización para SNAPSHOT |
| `src/hooks/useServiceChangeHistory.ts` | Modificar | Agregar tipo SNAPSHOT a la interfaz |

---

### Resultado Esperado

1. Todos los servicios existentes tendrán un registro `SNAPSHOT` con sus valores actuales
2. El historial mostrará "Estado Inicial" como primer registro de cada servicio
3. Los cambios futuros se compararán contra este baseline
4. La fecha del snapshot será la fecha de creación original del servicio

