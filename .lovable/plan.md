

# Manejo de Clientes No Encontrados en la Importación de Facturas

## Situación

Los archivos CSV/XLSX del sistema de facturación contienen RUT y RAZÓN SOCIAL de cada cliente. Al importar, se busca el cliente por RUT en la tabla `clients`. Hay tres escenarios posibles:

## Escenarios y Solución Propuesta

| Escenario | Qué pasa | Acción |
|---|---|---|
| **Cliente existe por RUT** | Match directo | Se asigna el `client_id` automáticamente |
| **Cliente NO existe** | RUT no encontrado en `clients` | Se muestra en el preview para que el usuario decida |
| **RUT ambiguo** | Mismo RUT, múltiples departamentos | Se muestra para selección manual |

## Opciones para clientes no encontrados

En el paso de preview (antes de confirmar la importación), el importador mostrará una sección de **"Clientes no encontrados"** con estas opciones por cada cliente:

1. **Crear automáticamente**: El importador crea el cliente con los datos disponibles del CSV (RUT, Razón Social) y campos mínimos. El usuario puede completar datos (email, teléfono, dirección) después.

2. **Asignar a cliente existente**: Dropdown para seleccionar manualmente un cliente ya registrado (útil si el nombre cambió o el RUT tiene formato diferente).

3. **Ignorar**: Las facturas de ese cliente no se importan.

## Flujo del Importador

```text
1. Subir archivo CSV/XLSX
2. Parsear y mostrar preview
   ├── Facturas con cliente encontrado ✅ (listas para importar)
   ├── Clientes no encontrados ⚠️
   │   ├── [Crear cliente] → crea con RUT + nombre del CSV
   │   ├── [Asignar existente] → selector de clientes
   │   └── [Ignorar] → excluye esas facturas
   └── Duplicados detectados 🔄 (ya importadas, se omiten)
3. Confirmar importación
```

## Datos para crear clientes automáticamente

Del CSV se extraen:
- `rut` → del campo RUT
- `name` → del campo RAZÓN SOCIAL  
- `department` → "General" (default)
- `is_active` → true
- `billing_type` → "standard"

Los campos como email, teléfono y dirección quedarían vacíos para completar después.

## Implementación

Todo esto se incluye dentro del componente `InvoiceHistoryImport.tsx` y el parser `invoiceHistoryParser.ts` que ya están planificados. No requiere cambios adicionales en la base de datos — usa la tabla `clients` existente y la función `createClient` del hook `useClients`.

