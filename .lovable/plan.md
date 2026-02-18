
# Importador de Ordenes de Compra desde PDF

## Resumen

Crear una herramienta que permita subir PDFs de ordenes de compra (como las de SalfaRent), extraer automaticamente el numero de OC y las patentes listadas, y vincularlos con los servicios existentes en el sistema.

## Como funciona

1. El usuario sube uno o varios PDFs de ordenes de compra
2. El sistema envia cada PDF a una Edge Function que extrae el texto
3. Del texto se parsea: numero de OC, patentes, montos
4. Se buscan servicios existentes que coincidan por patente (y opcionalmente por cliente)
5. Se muestra una tabla de preview con los matches encontrados para que el usuario confirme
6. Al confirmar, se actualiza el campo `purchase_order` de cada servicio con el numero de OC

## Flujo del usuario

```text
[Subir PDFs] --> [Procesando...] --> [Vista previa de matches]
                                          |
                                     Patente VHZJ75 --> SRV-1234 (match)
                                     Patente VLSV92 --> SRV-1235 (match)
                                     Patente VLZF95 --> Sin match encontrado
                                          |
                                     [Confirmar] --> Servicios actualizados
```

## Cambios tecnicos

### 1. Edge Function: `parse-purchase-order-pdf`

Nueva edge function en `supabase/functions/parse-purchase-order-pdf/index.ts` que:
- Recibe el PDF como base64 en el body
- Usa una libreria de extraccion de texto de PDF (pdf-parse compatible con Deno)
- Extrae con regex: numero de OC (`N° de OC: XXXX`), patentes (formato chileno `XXXX00`), montos por linea
- Retorna un JSON estructurado con los datos extraidos

### 2. Componente: `PurchaseOrderPDFImporter`

Nuevo componente en `src/components/vip/PurchaseOrderPDFImporter.tsx`:
- Zona de drag & drop para subir PDFs (usa `react-dropzone` ya instalado)
- Muestra progreso de procesamiento
- Tabla de resultados con columnas: Patente | Servicio Match | Estado | OC
- Boton de confirmar para aplicar los cambios
- Sigue los patrones de diseno del modulo de Costos (fonts, badges, toggles)

### 3. Hook: `usePurchaseOrderPDFImport`

Nuevo hook en `src/hooks/vip/usePurchaseOrderPDFImport.ts`:
- Envia PDFs a la edge function
- Busca servicios por patente en la base de datos del cliente
- Gestiona el estado de matching y confirmacion
- Llama a `updateService` para aplicar el numero de OC

### 4. Integracion en VIP Pipeline

Modificar `src/pages/VipClientPipeline.tsx`:
- Agregar el componente `PurchaseOrderPDFImporter` dentro del tab "O.C." (Purchase Orders), junto al `PurchaseOrderManager` existente

### Estructura del JSON extraido del PDF

```text
{
  "ocNumber": "4701665314",
  "date": "2026-02-09",
  "items": [
    { "patente": "VHZJ75", "detail": "TRASLADO DE VEHICULOS", "amount": 15000 },
    { "patente": "VLSV92", "detail": "TRASLADO DE VEHICULOS", "amount": 15000 },
    { "patente": "VLZF95", "detail": "TRASLADO DE VEHICULOS", "amount": 15000 }
  ],
  "totals": { "neto": 45000, "iva": 8550, "total": 53550 }
}
```

### Logica de matching

Los servicios se buscan por:
1. Patente del vehiculo (`license_plate`) - match principal
2. Filtrado por el cliente actual del pipeline VIP
3. Solo servicios sin OC asignada (para evitar duplicados)
4. Preferencia por servicios mas recientes si hay multiples matches

### Archivos nuevos
- `supabase/functions/parse-purchase-order-pdf/index.ts`
- `src/components/vip/PurchaseOrderPDFImporter.tsx`
- `src/hooks/vip/usePurchaseOrderPDFImport.ts`

### Archivos modificados
- `src/pages/VipClientPipeline.tsx` - agregar importador al tab O.C.
