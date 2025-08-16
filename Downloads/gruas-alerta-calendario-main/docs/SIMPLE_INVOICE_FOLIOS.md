# Folios Simples y Secuenciales para Facturas

Estado: Implementado
Fecha: 2025-08-11
Impacto: Alto (finanzas, UX, reporting)

## Motivo
Los folios largos (ej: FACT-1754758006830000) dificultaban la gestión y lectura. Se implementó un esquema simple y consecutivo: FACT-4000, FACT-4001, FACT-4002, ...

## Cambios en Base de Datos (Migración)
- Tabla company_data:
  - Nueva columna: next_invoice_folio_number INTEGER (contador de facturas)
  - Inicialización a 4000 (y creación de fila por defecto si no existía)
- Funciones SQL:
  - generate_simple_invoice_folio(): entrega y reserva el siguiente folio simple de forma transaccional
  - preview_next_invoice_folio(): muestra el siguiente folio sin reservarlo (para la UI)
  - create_invoice_transaction(p_invoice_data jsonb, p_service_ids uuid[]): crea factura con folio simple, relaciona servicios y marca servicios como invoiced
- Limpieza:
  - DROP FUNCTION IF EXISTS generate_unique_invoice_folio()
  - DROP FUNCTION IF EXISTS validate_invoice_folio_uniqueness(text, uuid)

## Cambios en Frontend
- No se requieren cambios de código adicionales: 
  - La UI ya usa preview_next_invoice_folio para previsualizar folio
  - useInvoiceOperations.createInvoice ya consume create_invoice_transaction(p_invoice_data, p_service_ids) y espera TABLE(invoice_id, invoice_folio)

## Garantías
- Consecutividad sin saltos: el contador se incrementa en la misma transacción; si hay error, todo se revierte.
- Unicidad: doble verificación sobre invoices.folio antes de retornar.
- Compatibilidad: no rompe flujos existentes; solo simplifica el formato del folio.

## Validación
1. Crear nueva factura desde un cierre con N servicios
2. Observar folio: FACT-4000
3. Crear otra factura inmediatamente: FACT-4001
4. Cancelar una creación a propósito (p.ej. romper validación) y reintentar: el número no salta

## Notas de Seguridad
- Las funciones fueron creadas con SECURITY DEFINER y search_path='public'.
- Advertencias del linter existentes previas al cambio; no se introdujeron nuevas advertencias por estas funciones.

## Próximos pasos sugeridos (opcionales)
- Mostrar el “Siguiente folio” en la UI de creación como hint (ya disponible vía preview_next_invoice_folio).
- Permitir configurar el número inicial desde Ajustes (company_data.next_invoice_folio_number).
