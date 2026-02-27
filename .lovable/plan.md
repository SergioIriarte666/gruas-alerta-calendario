

# Validacion de RUT del cliente en importadores de Cotizacion y OC

## Problema
Si se sube un PDF de cotizacion u OC en el pipeline de un cliente diferente, el sistema lo procesa sin advertir. Las cotizaciones y ordenes de compra contienen el RUT del cliente emisor/destinatario, por lo que se puede validar automaticamente.

## Solucion

### 1. Edge Functions - Extraer RUT del cliente del PDF

**Archivo: `supabase/functions/parse-quote-pdf/index.ts`**
- Agregar campo `clientRut` al schema de la herramienta `extract_quote`
- Agregar instruccion al prompt del sistema para que extraiga el RUT del cliente (destinatario de la cotizacion)
- Incluir `clientRut` en el resultado devuelto

**Archivo: `supabase/functions/parse-purchase-order-pdf/index.ts`**
- Agregar campo `clientRut` al schema de la herramienta `extract_purchase_order`
- Agregar instruccion al prompt para extraer el RUT del emisor de la OC (la empresa que emite la orden de compra)
- Incluir `clientRut` en el resultado devuelto

Instruccion de prompt agregada en ambos:
```
- Extrae el RUT del cliente/empresa que aparece en el documento (formato XX.XXX.XXX-X o similar).
  En cotizaciones es el destinatario ("Señor(es)", "Cliente", "Razón Social").
  En OC es el emisor de la orden.
```

Nuevo campo en el schema de ambas herramientas:
```json
"clientRut": {
  "type": "string",
  "description": "RUT del cliente/empresa (ej: 76.XXX.XXX-X)"
}
```

### 2. Interfaces TypeScript - Agregar `clientRut`

**Archivo: `src/hooks/vip/useQuotePDFImport.ts`**
- Agregar `clientRut: string` a la interfaz `ParsedQuote`

**Archivo: `src/hooks/vip/usePurchaseOrderPDFImport.ts`**
- Agregar `clientRut: string` a la interfaz `ParsedOC`

### 3. Hooks de importacion - Validar RUT contra cliente actual

En ambos hooks (`useQuotePDFImport` y `usePurchaseOrderPDFImport`), despues de parsear los PDFs y antes del matching:

1. Obtener el RUT del cliente actual (ya se hace con `clientData.rut`)
2. Comparar con el RUT extraido de cada PDF (normalizado: sin puntos, guiones ni espacios)
3. Si no coincide, marcar el PDF como "cliente incorrecto" y mostrarlo como error via `toast.error`
4. Excluir los PDFs con RUT incorrecto del proceso de matching

Logica de validacion (igual en ambos hooks):
```typescript
const normalizeRut = (r: string) => (r || '').replace(/[.\s-]/g, '').toUpperCase();

// Despues de parsear y obtener clientData:
const clientRut = normalizeRut(clientData?.rut || '');

// Filtrar PDFs que no corresponden al cliente
const validParsed = parsedDocs.filter(doc => {
  const docRut = normalizeRut(doc.clientRut);
  if (docRut && clientRut && docRut !== clientRut) {
    toast.error(
      `${doc.fileName}: La cotizacion/OC pertenece a otro cliente (RUT: ${doc.clientRut}). ` +
      `El cliente actual tiene RUT: ${clientData?.rut}`
    );
    return false;
  }
  return true;
});

if (validParsed.length === 0) {
  setState(prev => ({ ...prev, step: 'idle', error: 'Ningun PDF corresponde a este cliente' }));
  return;
}
```

### 4. Archivos a modificar

| Archivo | Cambio |
|---|---|
| `supabase/functions/parse-quote-pdf/index.ts` | Extraer `clientRut` del PDF via IA |
| `supabase/functions/parse-purchase-order-pdf/index.ts` | Extraer `clientRut` del PDF via IA |
| `src/hooks/vip/useQuotePDFImport.ts` | Agregar interfaz + validacion de RUT |
| `src/hooks/vip/usePurchaseOrderPDFImport.ts` | Agregar interfaz + validacion de RUT |

### Resultado esperado
- Al subir un PDF de cotizacion/OC en el pipeline de un cliente incorrecto, se muestra un toast de error indicando que el documento pertenece a otro cliente y se detiene el proceso.
- Si el RUT coincide o no se pudo extraer del PDF, el flujo continua normalmente.

