

# Plan: Actualización integral del Manual de Usuario a v2.3.0

## Alcance
Actualizar `docs/user-manual.md` (actualmente v2.2.0, 2899 líneas, 24 secciones) incorporando **todas** las mejoras y módulos nuevos acumulados desde la última versión documentada, sin perder contenido vigente.

## Cambios por sección

### Encabezado / Novedades v2.3.0 (sección 1)
Nueva sección "Novedades v2.3.0" listando:
- **Auto-SKU en importación XML** (formato `SKU-YYYYMMDD-XXXX`) + backfill
- **Sincronización triangular Costos ↔ Pagos a Proveedores ↔ Facturas**
- **Importador XML unificado tipo Wizard** (modal 1600px) con detección de duplicados en 3 niveles, asociación a costos existentes y fallback por RUT
- **Resiliencia v4 de importación XML** con vínculo atómico
- **Nota de Crédito obligatoria** para anular facturas
- **Protección de eliminación** con prompt "ELIMINAR"
- **Sistema de comisiones rediseñado** (tabla `costs` como fuente única, flag `commission_exempt`)
- **Cuentas por Pagar** unificadas (deudas, créditos, intereses, cuotas)
- **Ventas Históricas SII** (importación CSV/XLSX con prefijo HIST-)
- **Aislamiento Histórico vs Activo** en finanzas
- **Conciliación inteligente sin auto-asignación** (manual, prioridad por vencimiento)
- **Cálculo de antigüedad y vencidas** por saldo
- **Permisos granulares por módulo** por usuario
- **Panel de Emergencia** para administradores
- **Calculadora de Viajes** con Mapbox + GetAPI (peajes, ruta)
- **Verificación RUT multi-proveedor** (SRE/Ruts.info) y formateo global
- **Pipeline VIP con OCR fuzzy matching** para OC/Cotizaciones
- **Bitácora técnica de grúas v3** con kilometraje e integración financiera
- **Subcontratación de servicios** vinculada a proveedores de inventario
- **Sistema de auditoría** (`created_by`) en todos los módulos
- **Resumen de pendientes al iniciar sesión** (modal proactivo)
- **Notificaciones WhatsApp** vía Meta Cloud API
- **Reportes integrales automáticos** vía Resend + pg_cron
- **Autocompletado inteligente** en campos de texto libre
- **Quick Records con auto-extracción** (OpenAI gpt-4o-mini)
- **Calendario hub multi-fuente** (servicios, mantenciones, eventos remotos)
- **Operaciones por lote** y duplicación de servicios
- **Log de auditoría de servicios** (history table)
- **Sistema de tarifas** con jerarquía cliente→tipo→default
- **Tema accesibilidad violeta** (sin verde) — alto contraste
- **PWA offline v5** (IndexedDB) con CRUD completo
- **Diseño responsivo** mobile-first (tablas → cards)

### Secciones modificadas

| Sección | Cambios |
|---|---|
| 4. Servicios | Subsección "Subcontratación", "Log de Auditoría", "Operaciones por Lote y Duplicación", "Sistema de Tarifas Automáticas" |
| 5. Cierres | Sincronización forzada con facturas, protección de estados intermedios |
| 6. Grúas | Bitácora Técnica v3 (mantenciones + financiero + km) |
| 7. Operadores | Flag `commission_exempt`, comisiones desde `costs` |
| 10. Inventario | Auto-SKU XML, valoración solo desde entradas, Multi-item badge, importación XML unificada con duplicados/fallback RUT |
| 11. Proveedores | Pestañas Pagos/Proveedores/Calendario, sincronización triangular, importador XML wizard, conciliación con costos existentes, calendario de pagos con TZ Chile |
| 12. VIP | OCR fuzzy matching para OC/Cotizaciones |
| 13. Facturación | Anulación con NC obligatoria, protección "ELIMINAR", descripción opcional, antigüedad por saldo, conciliación automática al crear como pagada, historial SII |
| 16. Financiero | Cuentas por Pagar, Histórico vs Activo, comisiones overhaul, conciliación sin auto-asignación, restricción de escritura solo admin |
| 17. Reportes | Reportes integrales automáticos por email, filtro Departamento, métricas con TZ Chile |
| 18. Admin | Panel de Emergencia, permisos granulares, RUT multi-proveedor |
| 19. Configuración | Notificaciones WhatsApp Meta, configuración regional Chile |
| 20. Portal Cliente | Sin cambios mayores (revisar) |
| 21. Móvil/PWA | Offline v5 (IndexedDB), Quick Records con OCR, GPS |

### Secciones nuevas
- **25. Calculadora de Viajes** — Mapbox + GetAPI (peajes, distancia, costo estimado)
- **26. Importador XML Unificado** — wizard, duplicados, fallback RUT, asociación a costos
- **27. Accesibilidad y Diseño** — esquema violeta, alto contraste, responsive, PWA
- **28. Auditoría y Seguridad** — RLS, `created_by`, restricción admin en finanzas, log de servicios

### Actualizaciones transversales
- Cambiar versión: v2.2.0 → **v2.3.0** en título, intro y referencias
- Actualizar Tabla de Contenidos con nuevas secciones (25–28)
- Refrescar "Características Principales" con módulos nuevos
- Mantener mismo tono y formato (markdown, emojis ✅, tablas, viñetas)

## Método de implementación
Por extensión del archivo (~2899 → ~3500 líneas). Editaré por bloques con `code--line_replace` (cambios quirúrgicos en secciones existentes) y `code--write` solo si reescribo el archivo completo. Preferencia por edición incremental para preservar contenido.

## Lo que NO se toca
- Código de la aplicación (solo documentación)
- Otros archivos `.md` (CHANGELOG, docs internos)
- Memorias

## Resultado
Manual v2.3.0 completo, alineado con el estado real del sistema, con 28 secciones cubriendo todas las funcionalidades hasta abril 2026.

