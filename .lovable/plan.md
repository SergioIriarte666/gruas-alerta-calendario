

## Plan: Reordenar Sección "Registro del Vehículo"

### Objetivo
Mover la sección "Registro del Vehículo" (Kilometraje, Combustible, Llaves, Documentación) para que aparezca **entre** "Detalles del Servicio" e "Inventario del Vehículo".

### Orden Actual
1. Detalles del Servicio
2. Inventario del Vehículo
3. **Registro del Vehículo** ← Posición actual
4. Set Fotográfico
5. Observaciones y Firmas

### Nuevo Orden Propuesto
1. Detalles del Servicio
2. **Registro del Vehículo** ← Nueva posición
3. Inventario del Vehículo
4. Set Fotográfico
5. Observaciones y Firmas

### Cambios a Realizar

#### Archivo: `src/components/operator/InspectionFormSections.tsx`

Reorganizar el orden de los componentes dentro del JSX:

```text
ANTES:
<>
  <VehicleEquipmentChecklist />
  <Card>Registro del Vehículo</Card>
  <PhotographicSet />
  <Card>Observaciones y Firmas</Card>
</>

DESPUÉS:
<>
  <Card>Registro del Vehículo</Card>     ← Mover primero
  <VehicleEquipmentChecklist />           ← Segundo
  <PhotographicSet />
  <Card>Observaciones y Firmas</Card>
</>
```

### Flujo Visual Resultante

| Paso | Sección | Descripción |
|------|---------|-------------|
| 1 | Detalles del Servicio | Información del folio, cliente, origen/destino |
| 2 | Registro del Vehículo | Kilometraje, combustible, llaves, documentación |
| 3 | Inventario del Vehículo | Checklist de equipamiento (35 items alfabéticos) |
| 4 | Set Fotográfico | Captura de fotos por categoría |
| 5 | Observaciones y Firmas | Notas finales y firmas digitales |

### Impacto
- **UI del Operador**: Flujo más lógico - primero registrar datos básicos del vehículo, luego el inventario detallado
- **Sin breaking changes**: Solo reordenamiento visual, no afecta datos ni validaciones
- **PDF**: El PDF mantiene su propia estructura independiente

### Archivos Afectados
| Archivo | Cambio |
|---------|--------|
| `src/components/operator/InspectionFormSections.tsx` | Reordenar bloques JSX |

