

# Plan: Corrección de Errores en Carga Masiva de Servicios

## Problemas Detectados

Después de analizar el archivo Excel, el código y la base de datos, identifiqué los siguientes problemas:

### 1. Grúas Inexistentes en la Base de Datos
El archivo Excel contiene patentes de grúas que **no existen** en el sistema:
- **VBPH-58** ✓ (única que existe)
- **VBPH-59** ✗ No existe
- **VBPH-60** ✗ No existe
- **VBPH-61** ✗ No existe
- **VBPH-62** ✗ No existe
- **VBPH-63** ✗ No existe
- **VBPH-64** ✗ No existe
- **VBPH-65** ✗ No existe

**Solución**: Debes crear estas grúas en el sistema antes de cargar los servicios, o modificar el Excel para usar grúas existentes.

### 2. Error de Visualización "N/A" en Mensajes de Error
El mensaje "Grúa no encontrada: N/A" es incorrecto. Debería mostrar la patente real que no se encontró (ej: "Grúa no encontrada: VBPH-59").

**Causa técnica**: El error se genera en `rowMapper.ts` usando el valor de `rowData.craneLicensePlate`, pero hay un problema donde ese valor no está siendo correctamente mapeado desde los headers del Excel.

### 3. Problema con Acentos en Tipo de Servicio
El Excel tiene "Servicios Mecánicos y De Apoyo" con acentos, pero la comparación actual usa `.includes()` sin normalizar caracteres especiales.

**Causa técnica**: La función `findServiceTypeByName` en `entityFinders.ts` no normaliza acentos antes de comparar.

---

## Solución Técnica

### Archivo 1: `src/utils/dataMapper/entityFinders.ts`

**Cambios:**
1. Agregar función auxiliar para normalizar texto (quitar acentos)
2. Modificar `findServiceTypeByName` para normalizar antes de comparar

```typescript
// Nueva función auxiliar
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Quita acentos
};

// Modificar findServiceTypeByName
findServiceTypeByName(name: string): ServiceType | null {
  const cleanName = normalizeText(name);
  return this.serviceTypes.find(serviceType => {
    const typeName = normalizeText(serviceType.name || '');
    return typeName.includes(cleanName) || cleanName.includes(typeName);
  }) || null;
}
```

### Archivo 2: `src/utils/dataMapper/rowMapper.ts`

**Cambios:**
1. Mejorar el mensaje de error para mostrar el valor original de la patente

```typescript
// Línea ~89: Mejorar mensaje de error
errors.push(`Grúa no encontrada: ${rowData.craneLicensePlate || 'valor vacío'}`);
```

### Archivo 3: `src/utils/dataMapper/headerMapping.ts`

**Cambios:**
1. Normalizar los headers al mapear para manejar problemas de acentos/codificación

```typescript
// En mapHeaders(), normalizar los headers antes de buscar en el mapa
const normalizedHeader = header.trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');
```

2. Agregar variaciones de headers sin acentos:
```typescript
'Grua Patente': 'craneLicensePlate',  // Sin tilde en Grúa
'Tipo Servicio': 'serviceType',
```

---

## Acciones Adicionales Requeridas (Por el Usuario)

Antes de cargar los servicios exitosamente, necesitas:

1. **Crear las grúas faltantes** en el módulo de Grúas:
   - VBPH-59
   - VBPH-60
   - VBPH-61
   - VBPH-62
   - VBPH-63
   - VBPH-64
   - VBPH-65

   O modificar el archivo Excel para usar grúas existentes:
   - DCBV-94
   - FYTR-49
   - GHKD-60
   - TDCJ-46
   - TLYF-23
   - VBPH-58

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/utils/dataMapper/entityFinders.ts` | Agregar normalización de acentos |
| `src/utils/dataMapper/rowMapper.ts` | Mejorar mensajes de error |
| `src/utils/dataMapper/headerMapping.ts` | Agregar variaciones de headers sin acentos |

---

## Resultado Esperado

Después de aplicar estos cambios:
1. Los tipos de servicio se encontrarán aunque haya diferencias de acentos
2. Los mensajes de error mostrarán las patentes reales que faltan
3. Los headers del Excel funcionarán aunque tengan o no tengan acentos

