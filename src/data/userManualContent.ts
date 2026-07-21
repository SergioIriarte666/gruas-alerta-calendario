export interface ManualSection {
  id: string;
  title: string;
  content: string;
}

export interface ManualChapter {
  id: string;
  number: number;
  title: string;
  color: string;
  softColor: string;
  sections: ManualSection[];
}

export const manualChapters: ManualChapter[] = [
  {
    id: 'cap1',
    number: 1,
    title: 'Introducción al sistema',
    color: 'hsl(var(--primary))',
    softColor: 'hsl(var(--primary) / 0.1)',
    sections: [
      {
        id: 'cap1-1',
        title: 'Acceso al sistema',
        content: `NTMS es accesible desde cualquier navegador web en www.ntms.cl.\n\nPara ingresar al sistema:\n\n1. Abrir el navegador y navegar a www.ntms.cl\n2. Ingresar el correo electrónico registrado\n3. Ingresar la contraseña\n4. Hacer clic en "Iniciar sesión"\n\nSi se olvidó la contraseña, hacer clic en "¿Olvidaste tu contraseña?" e ingresar el correo — se enviará un enlace de recuperación válido por 24 horas.\n\nEl sistema cierra sesión automáticamente tras un período de inactividad por seguridad.`,
      },
      {
        id: 'cap1-2',
        title: 'Roles de usuario',
        content: `NTMS opera con cuatro roles de acceso:\n\nAdmin — acceso total al sistema. Puede configurar, eliminar datos, gestionar usuarios y acceder a todos los módulos financieros.\n\nViewer (Secretaria) — acceso de lectura a todos los módulos del sistema principal. Puede crear servicios y costos pero no eliminar ni modificar configuración.\n\nOperador — acceso exclusivo al portal de operador (/operator). Solo ve sus propios servicios asignados y completa inspecciones de vehículos.\n\nCliente — acceso exclusivo al portal de cliente (/portal). Solo ve los servicios y facturas vinculados a su empresa.`,
      },
      {
        id: 'cap1-3',
        title: 'Dashboard principal',
        content: `El Dashboard es la pantalla principal del sistema y muestra el estado operacional en tiempo real.\n\nMétricas del encabezado:\n- Servicios del día: cantidad de servicios programados o en curso para hoy\n- Pendientes de cotización: servicios sin precio asignado\n- Documentos por vencer: grúas con documentos próximos a vencer (30 días)\n- Ingresos del mes: suma de servicios completados en el mes actual\n\nAlertas activas: panel con alertas críticas del sistema que requieren atención inmediata.\n\nServicios recientes: tabla con los últimos servicios registrados y su estado actual.\n\nEl Dashboard se actualiza en tiempo real — no requiere recargar la página.`,
      },
      {
        id: 'cap1-4',
        title: 'Informe Diario',
        content: `El Informe Diario consolida toda la actividad operacional de una fecha específica en cinco pestañas.\n\nNavegación: usar las flechas de fecha en el encabezado para moverse entre días, o hacer clic en la fecha para abrir el selector de calendario.\n\nPestaña Operaciones: servicios del día con estado, operador asignado y grúa.\n\nPestaña Financiero: ingresos del día, costos registrados y margen bruto.\n\nPestaña Servicios: detalle completo de cada servicio con cliente y folio.\n\nPestaña Proveedores: pagos a proveedores registrados en la fecha.\n\nPestaña Calendario: vista de servicios programados próximos.\n\nExportación: botones "Exportar PDF" y "Exportar Excel" en el encabezado generan el informe del día seleccionado con todos los datos consolidados.`,
      },
    ],
  },
  {
    id: 'cap2',
    number: 2,
    title: 'Operaciones',
    color: 'hsl(var(--success-text))',
    softColor: 'hsl(var(--success-soft))',
    sections: [
      {
        id: 'cap2-1',
        title: 'Servicios',
        content: `El módulo de Servicios es el núcleo operacional del sistema. Registra cada servicio de grúa o asistencia vial desde su creación hasta su cierre.\n\nEstados del servicio:\n- Pendiente: ingresado pero sin operador asignado\n- Programado: con operador y fecha asignados\n- En Progreso: el operador inició la atención\n- Completado: el operador cerró el servicio\n- Cancelado: servicio anulado\n\nVistas disponibles: tabla (desktop) con todas las columnas, vista pipeline (kanban por estado) y vista móvil con tarjetas.\n\nCrear un nuevo servicio (4 pasos):\n1. Datos del cliente y tipo de servicio\n2. Datos del vehículo (con validador de patente vía API oficial — 5 consultas/día)\n3. Asignación de operador, grúa y tarifa\n4. Resumen y confirmación\n\nAl completar el formulario, el sistema genera automáticamente la comisión del operador y registra el gasto de servicio si corresponde.\n\nValidador de patente: al ingresar la patente en el Paso 2, el sistema consulta automáticamente el registro oficial chileno (debounce de 800ms). Si encuentra datos, sugiere autocompletar. Si los datos difieren de lo ingresado, muestra advertencia de discrepancia. Si no hay resultado o se agotaron las consultas del día, permite ingreso manual sin error.`,
      },
      {
        id: 'cap2-2',
        title: 'Clientes',
        content: `El módulo de Clientes gestiona el directorio completo de empresas y personas que contratan servicios.\n\nFicha de cliente — 6 pestañas:\n- Info: datos generales (razón social, RUT, dirección, contacto, logo)\n- Servicios: historial completo de servicios del cliente\n- Facturas: facturas emitidas y sus estados de pago\n- Cierres: períodos de facturación agrupados\n- Órdenes de Compra: OC recibidas con seguimiento\n- Portal: configuración del acceso al portal de cliente\n\nBúsqueda por RUT: el campo de búsqueda acepta RUT y consulta la API del SRE para autocompletar razón social y datos tributarios.\n\nPortal de cliente: se activa manualmente desde la pestaña Portal de la ficha. Solo para clientes con alto flujo de servicios — no aplica para clientes esporádicos. Una vez activado, el cliente puede ingresar a /portal con sus credenciales.`,
      },
      {
        id: 'cap2-3',
        title: 'Calendario',
        content: `El módulo de Calendario muestra los servicios programados y los vencimientos de documentos en una vista mensual.\n\nServicios programados: se visualizan como eventos en la fecha del servicio. Al hacer clic en un evento, se abre el detalle del servicio.\n\nVencimientos de documentos: aparecen marcados en el calendario los vencimientos próximos de licencias de conducir, revisiones técnicas y seguros de las grúas.\n\nNavegación: flechas para moverse entre meses. El mes actual se muestra por defecto con la fecha de hoy resaltada.`,
      },
      {
        id: 'cap2-4',
        title: 'Portal Operador',
        content: `El Portal Operador es una interfaz móvil oscura accesible en /operator, diseñada para uso en terreno desde smartphone.\n\nEl operador solo ve sus propios servicios asignados — no tiene acceso al sistema principal.\n\nFlujo de inspección (7 pasos):\n1. Abrir formulario de inspección desde el servicio asignado\n2. Rellenar información del servicio (hora, lugar, observaciones)\n3. Tomar fotos del vehículo con la cámara del dispositivo\n4. Capturar firma de quien entrega el vehículo (firma digital táctil)\n5. Enviar notificación a la persona que entrega\n6. Registrar salida hacia el destino de entrega\n7. Capturar firma de recepción conforme en destino\n\nAl completar el paso 7, el servicio cambia automáticamente a estado Completado y se genera la comisión del operador.`,
      },
    ],
  },
  {
    id: 'cap3',
    number: 3,
    title: 'Recursos (Flota y Personal)',
    color: 'hsl(var(--info-text))',
    softColor: 'hsl(var(--info-soft))',
    sections: [
      {
        id: 'cap3-1',
        title: 'Grúas',
        content: `El módulo de Grúas gestiona el catálogo completo de equipos de la flota con trazabilidad de documentos, costos y mantención.\n\nSemáforo de documentos: cada grúa muestra un indicador de color en la lista según el estado de sus documentos (verde: todo vigente, amarillo: vencimiento próximo, rojo: documento vencido).\n\nFicha de grúa — 6 pestañas:\n- Resumen: datos generales, patente, año y estado operativo\n- Servicios: historial de servicios realizados con esta grúa\n- Costos: gastos asignados a la grúa por período\n- Piezas: componentes y repuestos vinculados\n- Mantención: historial de intervenciones y próximos mantenimientos\n- Inventario: stock de insumos asignados a la grúa\n\nAlertas automáticas por WhatsApp: cuando un documento (seguro, revisión técnica, permiso de circulación) está a menos de 30 días de vencer, el sistema envía una alerta automática a los administradores.`,
      },
      {
        id: 'cap3-2',
        title: 'Operadores',
        content: `El módulo de Operadores gestiona el personal que opera los equipos.\n\nFicha de operador: nombre, RUT, teléfono, licencia de conducir (clase y vencimiento), porcentaje de comisión, estado activo/inactivo y vinculación a usuario del sistema.\n\nVinculación usuario-operador: para que un operador pueda ingresar al portal (/operator), debe tener una cuenta de usuario con rol "Operador" vinculada a su ficha. Esta vinculación se realiza en Configuración → Usuarios.\n\nAlerta de configuración: si un operador tiene cuenta de usuario pero no está vinculado, o está vinculado pero no tiene cuenta activa, el sistema muestra una alerta visual en su ficha.`,
      },
      {
        id: 'cap3-3',
        title: 'Vehículos',
        content: `El módulo de Vehículos combina tres funcionalidades: catálogo de marcas/modelos, consulta de patentes y consulta de historial.\n\nCatálogo de marcas y modelos: repositorio de referencias de vehículos para autocompletar el formulario de servicios.\n\nConsulta de Patentes: ingresa una patente para consultar el registro oficial chileno. Muestra marca, modelo, año, color y datos técnicos del vehículo. Las últimas 5 búsquedas se muestran como accesos rápidos. Cuota compartida con el formulario de servicios: 5 consultas por día.\n\nHistorial completo por patente: muestra todos los servicios registrados en el sistema para una patente determinada, independientemente del cliente. Exportable a PDF.`,
      },
    ],
  },
  {
    id: 'cap4',
    number: 4,
    title: 'Inventario y Proveedores',
    color: 'hsl(var(--warning-text))',
    softColor: 'hsl(var(--warning-soft))',
    sections: [
      {
        id: 'cap4-1',
        title: 'Bodega (Inventario)',
        content: `El módulo de Bodega centraliza el control de stock de piezas, materiales y consumibles de la flota.\n\nTres pestañas:\n- Stock: catálogo activo de productos con nivel actual, mínimo configurado y estado (Normal / Stock bajo / Sin stock)\n- Movimientos: historial cronológico de entradas, salidas, transferencias y ajustes\n- Reportes: análisis de costo de inventario y proyección de reposición\n\nMétricas del encabezado: total productos activos, cantidad con stock bajo, cantidad sin stock y valor total del inventario.\n\nRegistrar un movimiento (4 tipos): entrada (compra), salida (consumo en mantención), transferencia (entre ubicaciones) y ajuste (corrección). Para salidas, el campo motivo es obligatorio. La opción "Generar costo automático" crea el gasto en el módulo de Costos bajo la categoría Inventario vinculado a la grúa seleccionada.\n\nIntegración con Mantención: al cerrar una orden de mantención, el sistema descuenta automáticamente las piezas usadas del stock.\n\nAlertas de stock mínimo: cuando el stock cae bajo el mínimo configurado, el producto aparece destacado y se activa la alerta.\n\nImportación XML: importa catálogo de productos desde archivo XML compatible con facturas electrónicas del SII.`,
      },
      {
        id: 'cap4-2',
        title: 'Proveedores',
        content: `El módulo de Proveedores centraliza la gestión de empresas que abastecen la operación.\n\nTres pestañas:\n- Pagos: lista de facturas pendientes ordenadas por vencimiento con estados (Pendiente / Vencido / Pagado)\n- Proveedores: directorio completo con datos de contacto y condiciones comerciales\n- Calendario: vista mensual de vencimientos de pago\n\nMétricas: proveedores activos, facturas pendientes (cantidad y monto), vencidas y pagadas este mes.\n\nFicha de proveedor — 4 pestañas: General (datos de contacto), Documentos (facturas emitidas), Pagos (historial de pagos), Inventario y Piezas (movimientos de bodega vinculados).\n\nImportación XML: importa facturas directamente desde XML del SII. El sistema extrae proveedor (por RUT), número de factura, fechas y montos automáticamente.\n\nMarcar factura como pagada: clic en "Pagar" en la fila → confirmar monto, fecha y medio de pago → la factura cambia a estado Pagado.`,
      },
    ],
  },
  {
    id: 'cap5',
    number: 5,
    title: 'Finanzas',
    color: 'hsl(var(--danger-text))',
    softColor: 'hsl(var(--danger-soft))',
    sections: [
      {
        id: 'cap5-1',
        title: 'Costos',
        content: `El módulo de Costos es el registro central de todos los gastos de la operación.\n\nTaxonomía de categorías (4 categorías bloqueadas, no renombrables):\n- Gastos de Servicios: registrados desde el formulario de servicio, auto-pagados\n- Mantenimiento: generado por el módulo de mantención\n- Comisión Operador: generada automáticamente al cerrar servicios\n- Inventario: sincronizada con bodega\n\nCentros de costo: OPER, MANT, SEG, SAL, ADM, IMP. Se asignan automáticamente según la categoría.\n\nRegistrar un costo (4 pasos):\n1. Descripción (la IA sugiere categoría y subcategoría automáticamente)\n2. Monto y estado de pago\n3. Asignación a grúa, operador o servicio\n4. Resumen y confirmación\n\nCostos auto-generados: aparecen marcados como "Auto" y no pueden eliminarse sin permisos especiales.\n\nOpciones de ingreso masivo: formulario rápido (1 paso), importación CSV y importación XML desde facturas del SII.\n\nFiltros: por categoría, subcategoría, período, grúa, operador, servicio, centro de costo y rango de monto. Exportación a Excel.`,
      },
      {
        id: 'cap5-2',
        title: 'Cuentas por Pagar',
        content: `El módulo de Cuentas por Pagar gestiona deudas financieras de mediano y largo plazo: créditos bancarios, leasings y préstamos con cuotas programadas.\n\nDiferencia clave con Proveedores: Proveedores gestiona facturas de insumos (corto plazo). Cuentas por Pagar gestiona deudas estructuradas con cuotas fijas.\n\nCuatro pestañas: Cuotas del Mes (vencimientos del período actual con barra de progreso), Deudas (listado con saldo restante), Calendario (vencimientos futuros), Acreedores (directorio de entidades acreedoras).\n\nCrear una deuda: botón "Nueva Deuda" → nombre, acreedor, monto total, número de cuotas, día de vencimiento y fecha de inicio. El sistema genera automáticamente todas las cuotas.`,
      },
      {
        id: 'cap5-3',
        title: 'Comisiones',
        content: `El módulo de Comisiones gestiona el pago de comisiones a operadores por cada servicio completado.\n\nGeneración automática: al marcar un servicio como Completado, el sistema calcula la comisión según el porcentaje configurado en la ficha del operador y crea el registro automáticamente con estado Pendiente.\n\nVistas: tabla general filtrable por operador, período y estado; vista "Por operador" que agrupa y totaliza.\n\nPagar comisiones — Lote de Pago:\n1. Seleccionar comisiones con checkbox\n2. Botón "Crear Lote de Pago"\n3. Confirmar período, medio de pago y referencia\n4. Las comisiones seleccionadas cambian a estado Pagado\n\nValidación: el botón "Actualizar" compara las comisiones esperadas (según servicios en Supabase) con las visibles. Si hay diferencias, muestra alerta con cantidad faltante.`,
      },
      {
        id: 'cap5-4',
        title: 'Cierres',
        content: `El módulo de Cierres agrupa los servicios de un cliente en un período para preparar la facturación.\n\nFlujo del cierre:\n1. Botón "Nuevo Cierre" → seleccionar cliente y período\n2. El sistema lista todos los servicios completados del cliente sin cierre asignado\n3. Seleccionar servicios a incluir\n4. Revisar resumen y guardar como Abierto o Cerrar (congela el cierre)\n5. Al cerrar, el sistema ofrece generar la factura inmediatamente\n\nEstados: Abierto (en construcción), Cerrado (listo para facturar), Facturado (con factura emitida vinculada).\n\nReporte de cierre: genera PDF del período con detalle de servicios incluidos. Útil como pre-factura para el cliente.`,
      },
      {
        id: 'cap5-5',
        title: 'Facturas',
        content: `El módulo de Facturas gestiona las facturas emitidas a clientes.\n\nCrear una factura: desde un cierre (el sistema pre-completa los datos) o de forma independiente para clientes esporádicos.\n\nEstados: Pendiente (emitida, no cobrada), Pagada (cobro confirmado), Vencida (plazo superado sin pago), Anulada.\n\nMarcar como pagada: botón "Marcar pagada" en la fila → ingresar fecha de pago y referencia → confirmar.\n\nEnvío por email: botón "Enviar por email" desde la ficha de la factura → el sistema envía PDF adjunto al email del cliente.\n\nEliminación protegida: requiere clave de administrador para preservar trazabilidad contable.`,
      },
      {
        id: 'cap5-6',
        title: 'Históricos',
        content: `El módulo de Históricos permite importar y consultar registros financieros anteriores al inicio del uso del sistema.\n\nTres pestañas:\n- Histórico de Ventas: facturas de venta anteriores al sistema, importables desde XML SII o registro manual\n- Histórico de Compras: facturas de compra y gastos históricos\n- Resultados: panel financiero que combina datos históricos con datos del sistema actual\n\nLos históricos son registros de referencia — no generan comisiones ni costos automáticos.`,
      },
      {
        id: 'cap5-7',
        title: 'Cálculo de Viajes',
        content: `Herramienta para estimar el costo operativo de un servicio antes de cotizarlo.\n\nCuatro pestañas:\n- Calculadora: origen, destino, grúa seleccionada y gastos adicionales → costo estimado con desglose\n- Historial: estimaciones guardadas anteriormente\n- Combustible: tabla de precios por tipo de combustible (actualizar semanalmente)\n- Consumos: tasas de consumo por tipo de grúa (litros cada 100 km)\n\nGuardar estimación: archiva el resultado en el historial.\nUsar como referencia: abre el formulario de nuevo servicio pre-completado con el costo estimado.`,
      },
    ],
  },
  {
    id: 'cap6',
    number: 6,
    title: 'Análisis y Reportes',
    color: 'hsl(var(--chart-1))',
    softColor: 'hsl(var(--success-soft))',
    sections: [
      {
        id: 'cap6-1',
        title: 'Proyección de Ingresos',
        content: `El módulo de Proyección de Ingresos analiza la cartera de facturas pendientes para estimar cuánto dinero ingresará y cuándo.\n\nCuatro métricas clave:\n- Total proyectado: suma de facturas dentro del período de análisis (por defecto 30 días)\n- Facturas vencidas: monto total de facturas con plazo superado sin cobrar\n- En proceso de cobro: facturas enviadas con pago parcial o en gestión\n- Tasa de cobro: porcentaje de la cartera abierta efectivamente recuperada\n\nFiltros: período de proyección (días), cliente específico y estado de factura.\n\nGráfico de flujo de caja: barras semanales con cobros confirmados (sólidas) y proyectados (punteados). Clic en una semana filtra la tabla inferior.\n\nTop deudores: ranking de clientes con mayor deuda pendiente. Clic en un cliente filtra la vista completa.\n\nAntigüedad de cartera: clasifica facturas vencidas en rangos: al día, 1–30 días, 31–60 días y más de 60 días vencida.`,
      },
      {
        id: 'cap6-2',
        title: 'Reportes',
        content: `El módulo de Reportes agrega datos de todos los módulos y los presenta en siete dimensiones exportables.\n\nConfigurar período primero: opciones rápidas (hoy, últimos 7 días, este mes, mes anterior, últimos 3 meses, este año) o selector de fecha personalizado. El período aplica a todos los reportes simultáneamente.\n\nSiete pestañas de análisis:\n- Servicios: total, distribución por estado, evolución mensual y comparación con período anterior\n- Ingresos: evolución por mes, ticket promedio e ingresos por tipo de servicio\n- Clientes: ranking por servicios e ingresos, frecuencia y concentración de cartera\n- Operadores: servicios por operador, ingresos generados, comisiones y tasa de completitud\n- Flota: utilización por grúa, servicios, ingresos y nivel de uso (alto/medio/bajo)\n- Finanzas: ingresos totales, costos totales, margen bruto y rentabilidad del período\n- Costos: desglose por categoría, subcategoría y centro de costo\n\nExportar: botón "Exportar" → elegir PDF (con gráficos) o Excel (datos crudos). El PDF incluye el nombre de la empresa configurado en Ajustes.`,
      },
    ],
  },
  {
    id: 'cap7',
    number: 7,
    title: 'Configuración del Sistema',
    color: 'hsl(var(--muted-foreground))',
    softColor: 'hsl(var(--muted))',
    sections: [
      {
        id: 'cap7-1',
        title: 'Tipos de Servicio',
        content: `Catálogo de categorías operativas disponibles al crear un servicio.\n\nCrear: botón "Nuevo Tipo" → nombre, descripción opcional y categoría → guardar.\n\nDesactivar: clic en el ícono de estado en la fila. El tipo queda inactivo y no aparece en el formulario de servicios, pero sus registros históricos se mantienen.\n\nAcceso: menú lateral → Tipos de Servicio.`,
      },
      {
        id: 'cap7-2',
        title: 'Tarifas',
        content: `Pre-configura el precio de un tipo de servicio para un cliente y ruta específicos. Cuando se crea un servicio con esa combinación, el precio se completa automáticamente.\n\nCrear: botón "Nueva Tarifa" → seleccionar cliente, tipo de servicio, origen, destino y monto → guardar.\n\nLas tarifas pueden activarse o desactivarse individualmente. El precio pre-rellenado puede modificarse manualmente en el formulario de servicio.\n\nAcceso: menú lateral → Tarifas.`,
      },
      {
        id: 'cap7-3',
        title: 'Centros de Costo',
        content: `Organiza los gastos en grupos jerárquicos con presupuesto asignable por período.\n\nEstructura jerárquica: árbol de centros con sub-centros expandibles/colapsables.\n\nCentros fijos del sistema (no eliminables): OPER, MANT, SEG, SAL, ADM, IMP.\n\nSemáforo de presupuesto: verde (bajo 80%), amarillo (80–100%), rojo (sobre 100%). Clic en una fila navega al módulo de Costos filtrado por ese centro.\n\nManual de costos: botón que genera PDF con la estructura completa de centros, categorías y subcategorías.\n\nAcceso: menú lateral → Centros de Costo.`,
      },
      {
        id: 'cap7-4',
        title: 'Registros Rápidos',
        content: `Centraliza los registros capturados con el botón flotante (+) disponible en cualquier pantalla del sistema.\n\nCuatro tipos: Servicio, Costo/Gasto, Bodega y Mantenimiento.\n\nCaptura de foto e IA: al adjuntar foto de boleta, la IA extrae monto y descripción automáticamente.\n\nProcesar un registro: clic en "Procesar" → se abre el formulario completo del módulo destino con datos pre-completados → guardar elimina el registro rápido automáticamente.\n\nLos registros rápidos no generan datos en el sistema hasta ser procesados.\n\nAcceso: menú lateral → Registros Rápidos.`,
      },
      {
        id: 'cap7-5',
        title: 'Alertas (WhatsApp)',
        content: `Controla qué notificaciones automáticas se envían por WhatsApp y a qué teléfonos.\n\nAcceso: Configuración → pestaña Alertas.\n\nTeléfonos: hasta dos números de administrador en formato +569XXXXXXXX. El sistema valida el formato en tiempo real.\n\nMensaje de prueba: botón para verificar que la integración con Meta Business esté activa.\n\nNueve alertas configurables con toggle individual:\n- Operador asignado a servicio\n- Servicio completado\n- Retiro de vehículo (al cliente)\n- Documento próximo a vencer\n- Pago pendiente de cliente\n- Servicio creado sin cotización\n- Servicio sin operador (2+ horas)\n- Factura vencida sin pago (7+ días)\n- Resumen semanal (lunes 08:00 — 9 métricas)`,
      },
      {
        id: 'cap7-6',
        title: 'Categorías de Costo',
        content: `Gestiona las categorías y subcategorías de costo no bloqueadas por el sistema.\n\nAcceso: Configuración → pestaña Categorías.\n\nCategorías bloqueadas (no modificables): Gastos de Servicios, Mantenimiento, Comisión Operador, Inventario. Se muestran con candado.\n\nCategorías editables: pueden renombrarse, reordenarse, activarse/desactivarse y recibir nuevas subcategorías.\n\nCrear subcategoría: clic en + en la fila de la categoría → escribir nombre → guardar.\n\nUna subcategoría desactivada no aparece en el formulario de costos pero sus registros históricos se preservan.`,
      },
      {
        id: 'cap7-7',
        title: 'Respaldos',
        content: `Gestión de respaldos integrada en Configuración → Sistema → Gestión de Respaldos.\n\nRespaldo automático: genera archivo JSON con todos los datos según la frecuencia configurada (diario a las 02:00 AM, semanal o mensual).\n\nGenerar respaldo manual: botón "Generar respaldo ahora" → proceso de 10–60 segundos → archivo disponible en el historial para descarga.\n\nHistorial: lista de últimos respaldos con fecha y botón de descarga (JSON).\n\nRespaldo por email: configurar dirección a la que se envía automáticamente el archivo según la frecuencia configurada.`,
      },
      {
        id: 'cap7-8',
        title: 'Usuarios',
        content: `Gestiona las cuentas de acceso al sistema.\n\nAcceso: Configuración → pestaña Usuarios. Solo admin.\n\nCuatro roles: Admin (acceso total), Viewer/Secretaria (lectura y creación), Operador (solo /operator), Cliente (solo /portal).\n\nCrear usuario: botón "Nuevo usuario" → nombre, email y rol → guardar. El sistema envía email de invitación automáticamente.\n\nVincular operador o cliente: al crear/editar usuario con rol Operador o Cliente, seleccionar la ficha correspondiente del directorio. Esta vinculación determina qué datos ve el usuario en su portal.\n\nReenviar invitación: botón "Reenviar" si el usuario no completó el proceso.\n\nDesactivar: toggle de estado → acceso bloqueado inmediatamente, registros históricos preservados.`,
      },
    ],
  },
];
