

# Plan: Soporte para VIN en campo de Patente

## Problema
Los vehiculos nuevos no tienen patente, solo VIN (17 caracteres alfanumericos). Actualmente:
- El campo "Patente" en el formulario de servicio auto-consulta la API de patentes chilenas para cualquier input >= 6 caracteres
- La API de GetAPI Chile solo acepta patentes (6 chars), no VINs, y retorna error
- El campo en la pagina de Consulta de Patentes tiene `maxLength={8}`, impidiendo ingresar VINs

## Solucion

### 1. Detectar VIN vs Patente
Crear una funcion utilitaria que distinga entre patente chilena (formato XXXX-99 o XX-XX-99, 6 caracteres alfanumericos) y VIN (17 caracteres alfanumericos):

```text
isChileanPlate(value): true si tiene 6 chars (4 letras + 2 numeros o 2 letras + 2 letras + 2 numeros)
isVIN(value): true si tiene 17 chars alfanumericos
```

### 2. VehicleSection.tsx - No consultar API para VINs
- En el `useEffect` que dispara `lookupPatent` (linea ~146-162), agregar condicion: solo consultar si `isChileanPlate(cleanPlate)` es true
- Esto evita el error "Error al consultar la patente" cuando se ingresa un VIN
- Actualizar el placeholder del input a `"Ej: AB-CD-12 o VIN"`
- Remover o aumentar el `maxLength` para permitir VINs de 17 caracteres (actualmente no tiene maxLength en VehicleSection, solo en PatentLookup)

### 3. PatentLookup.tsx - Permitir VINs mas largos
- Cambiar `maxLength={8}` a `maxLength={20}` en el input de la pagina de Consulta de Patentes
- Solo enviar a la API si es formato de patente chilena; si es VIN, mostrar mensaje informativo indicando que la consulta solo funciona con patentes chilenas

### 4. useVehicleHistory.ts - Historial por VIN
- El historial de vehiculos ya busca por `license_plate` en la tabla `services`, por lo que si se guarda el VIN en ese campo, el historial funcionara automaticamente para VINs tambien

## Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/components/services/form/VehicleSection.tsx` | Agregar deteccion VIN, skip API lookup para VINs, actualizar placeholder |
| `src/components/vehicles/PatentLookup.tsx` | Aumentar maxLength, validar formato antes de consultar API |
| `src/hooks/usePatentLookup.ts` | Agregar validacion de formato en `lookupPatent` para dar mensaje claro si es VIN |

## Resultado esperado
- VINs de 17 caracteres se pueden ingresar sin error
- La API de patentes solo se consulta para patentes chilenas validas (6 chars)
- El historial de vehiculos funciona tanto con patentes como con VINs
- Mensajes claros al usuario cuando ingresa un VIN vs una patente

