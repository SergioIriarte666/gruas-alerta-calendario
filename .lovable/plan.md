

## Diagnóstico

El XML del SII usa un **namespace** (`xmlns="http://www.sii.cl/SiiDte"`), lo que hace que `querySelector('DTE')`, `querySelector('Documento')`, etc., **no encuentren ningún elemento**. El parser retorna 0 proveedores y 0 documentos silenciosamente, mostrando "importación completada" sin registrar nada.

Además, la estructura del XML es:
```text
<DTE xmlns="...">        ← raíz con namespace
  <Documento>            ← hijo directo (no hay DTE > DTE)
    <Encabezado>...
```

El parser actual busca `doc.querySelectorAll('DTE')` esperando múltiples DTEs, pero en este XML el `<DTE>` es la raíz misma, y `<Documento>` es hijo directo.

## Plan de corrección

**Archivo: `src/utils/xmlParser/xmlSupplierParser.ts`**

1. **Agregar método para eliminar namespaces** del XML string antes del parsing (estrategia robusta usada en parsers DTE chilenos). Esto se hace con un regex que remueve `xmlns="..."` del string antes de parsearlo.

2. **Ajustar detección de estructura DTE**: Además de buscar elementos `DTE` hijos, verificar si el elemento raíz del documento **es** un `DTE` (caso de archivo con un solo documento). Si `doc.documentElement.localName === 'DTE'`, tratar el propio raíz como el DTE.

3. **Aplicar la misma corrección** en `extractDocumentsFromXML` (línea ~400).

### Cambios específicos:

- Agregar método `private stripNamespaces(xml: string): string` que remueva atributos xmlns.
- En `parseXMLCompleteString` y `parseXMLString`, llamar `stripNamespaces` antes de `parseFromString`.
- En `extractSuppliersFromXML` y `extractDocumentsFromXML`, agregar fallback: si no hay elementos `DTE` hijos, verificar si `doc.documentElement` es un DTE y usarlo directamente.

### Resultado esperado

El XML del SII se parseará correctamente, extrayendo el proveedor "EASY RETAIL S.A." (RUT 76.568.660-1) y el documento Folio 36568897 con monto total.

