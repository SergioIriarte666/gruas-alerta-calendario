
# Plan: Verificacion Cruzada de Patente vs Datos del Vehiculo

## Problema
Actualmente, la consulta a la API de patentes solo se ejecuta cuando **no hay marca seleccionada** (`!vehicleBrand`). Si el usuario llena marca, modelo y patente manualmente, no se valida que los datos coincidan con el registro oficial. Esto permite ingresar combinaciones incorrectas como "Chevrolet FRR 1119" con una patente que corresponde a otro vehiculo.

## Solucion
Agregar una verificacion automatica que consulte la API cuando la patente tenga 6+ caracteres, **independientemente** de si ya hay marca/modelo seleccionados. Si los datos de la API no coinciden con lo ingresado, mostrar un banner de advertencia visible (no un dialog bloqueante) directamente en la seccion del vehiculo.

## Cambios en `VehicleSection.tsx`

### 1. Nuevo estado para discrepancias
- Agregar estado `mismatchWarning` que almacene las diferencias encontradas (marca esperada vs ingresada, modelo esperado vs ingresado).

### 2. Modificar la logica de consulta de patente
- Eliminar la condicion `!vehicleBrand` del useEffect que dispara `lookupPatent`.
- Agregar una nueva condicion: si ya hay marca/modelo, no mostrar el dialog de sugerencia sino comparar silenciosamente.
- Usar un nuevo ref `verifiedPlatesRef` para evitar consultas redundantes cuando los datos no cambian.

### 3. Nuevo useEffect de verificacion
- Cuando `patentData` llega y ya hay `vehicleBrand` o `vehicleModel` seleccionados, comparar (case-insensitive) contra los datos de la API.
- Si no coinciden, setear `mismatchWarning` con los detalles de la discrepancia.
- Si coinciden, limpiar el warning.

### 4. Banner visual de advertencia
- Debajo de los 3 campos (marca, modelo, patente), mostrar un banner amarillo/amber con icono `AlertTriangle` cuando exista `mismatchWarning`.
- Mensaje ejemplo: "La patente TLYF-23 esta registrada como **Chevrolet FRR 1119**, pero se ingreso **Toyota Hilux**. Verifique los datos."
- El banner no bloquea el formulario, solo advierte.

### 5. Limpiar warning al cambiar datos
- Si el usuario cambia marca, modelo o patente, resetear el warning y permitir nueva verificacion.

## Flujo del Usuario
1. Usuario selecciona marca "Toyota", modelo "Hilux", ingresa patente "TLYF23"
2. Tras 800ms, se consulta la API
3. API retorna: marca "Chevrolet", modelo "FRR 1119"
4. Se muestra banner: "Segun el registro, la patente TLYF-23 corresponde a Chevrolet FRR 1119. Verifique los datos ingresados."
5. Si datos coinciden, se muestra un check verde indicando verificacion exitosa

## Archivos a Modificar
- `src/components/services/form/VehicleSection.tsx` -- toda la logica y UI
