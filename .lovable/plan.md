

# Plan: Corrección de Fechas en Costos de Servicios

## Problema Identificado

Cuando se crean costos (incluyendo comisiones) para un servicio con fecha pasada, el sistema usa la fecha actual en lugar de la fecha del servicio. Esto causa descuadres en los reportes mensuales.

**Ejemplo del problema:**
- Usuario crea servicio con fecha `2026-01-27`
- Agrega costo de Viáticos → Se guarda con fecha `2026-02-05` (hoy) ❌
- Resultado: El costo aparece en febrero en lugar de enero

## Causa Raíz

En el archivo `src/components/services/form/ServiceCostDetailsSection.tsx`, línea 210:

```typescript
date: costDetail.isExisting && costDetail.date ? costDetail.date : getCurrentChileDateString(),
```

Este código:
1. Para costos **existentes** → Preserva la fecha original ✅
2. Para costos **nuevos** → Usa la fecha actual ❌

El componente no recibe la fecha del servicio como prop, por lo que no puede asignarla a los nuevos costos.

## Verificación de Datos

Se verificó en la base de datos que las **comisiones** creadas por el trigger de BD usan correctamente `NEW.service_date`. El problema está en los costos creados desde el formulario de detalles del servicio.

Ejemplos encontrados en BD con fechas incorrectas:
- Servicio `3145319-1`: Fecha = `2026-02-04`, pero Viáticos = `2026-02-05` ❌
- Servicio `3145319-1`: Fecha = `2026-02-04`, pero Combustible = `2026-02-05` ❌

---

## Solución Propuesta

### Cambios Requeridos

#### 1. Modificar `ServiceCostDetailsSection.tsx`

**Archivo:** `src/components/services/form/ServiceCostDetailsSection.tsx`

**Cambio 1:** Agregar prop `serviceDate` a la interfaz:

```typescript
interface ServiceCostDetailsSectionProps {
  serviceId?: string;
  serviceDate?: string;  // ← NUEVO
  costDetails: ServiceCostDetail[];
  onCostDetailsChange: (costDetails: ServiceCostDetail[]) => void;
  disabled?: boolean;
}
```

**Cambio 2:** Recibir el prop en el componente:

```typescript
export const ServiceCostDetailsSection = ({
  serviceId,
  serviceDate,  // ← NUEVO
  costDetails,
  onCostDetailsChange,
  disabled = false
}: ServiceCostDetailsSectionProps) => {
```

**Cambio 3:** Usar la fecha del servicio en lugar de la fecha actual:

```typescript
// Línea 210 - ANTES:
date: costDetail.isExisting && costDetail.date ? costDetail.date : getCurrentChileDateString(),

// DESPUÉS:
date: costDetail.isExisting && costDetail.date 
  ? costDetail.date 
  : (serviceDate || getCurrentChileDateString()),
```

---

#### 2. Modificar `EnhancedServiceForm.tsx`

**Archivo:** `src/components/services/EnhancedServiceForm.tsx`

**Cambio:** Pasar la fecha del servicio al componente:

```typescript
// Línea 938 - ANTES:
<ServiceCostDetailsSection
  costDetails={formData.costDetails || []}
  onCostDetailsChange={(costs) => setFormData(prev => ({ ...prev, costDetails: costs }))}
  serviceId={service?.id}
  disabled={false}
/>

// DESPUÉS:
<ServiceCostDetailsSection
  costDetails={formData.costDetails || []}
  onCostDetailsChange={(costs) => setFormData(prev => ({ ...prev, costDetails: costs }))}
  serviceId={service?.id}
  serviceDate={formData.serviceDate}  // ← NUEVO
  disabled={false}
/>
```

---

## Archivos a Modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/components/services/form/ServiceCostDetailsSection.tsx` | Agregar prop `serviceDate` y usarlo en la creación de costos |
| 2 | `src/components/services/EnhancedServiceForm.tsx` | Pasar `serviceDate` al componente |

---

## Resultado Esperado

Después de la corrección:
1. Costos nuevos agregados a un servicio usarán la fecha del servicio
2. Costos existentes seguirán preservando su fecha original
3. No habrá descuadres en los reportes mensuales

---

## Nota sobre Datos Históricos

Los datos históricos con fechas incorrectas (principalmente de agosto-septiembre 2025) podrían corregirse con una migración SQL si el usuario lo solicita. Sin embargo, esto no es parte de este plan inmediato.

