# MANUAL DE USUARIO VISUAL TMS GRÚAS
*Sistema de Gestión de Servicios de Grúa - Versión 2.0.0*

---

## ÍNDICE

1. [Introducción y Acceso al Sistema](#1-introducción-y-acceso-al-sistema)
2. [Portal Administrativo](#2-portal-administrativo)
3. [Portal del Operador](#3-portal-del-operador)
4. [Portal del Cliente](#4-portal-del-cliente)
5. [Funcionalidades Responsive](#5-funcionalidades-responsive)
6. [Flujos de Trabajo Principales](#6-flujos-de-trabajo-principales)
7. [Características Técnicas](#7-características-técnicas)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. INTRODUCCIÓN Y ACCESO AL SISTEMA

### 1.1 Pantalla de Autenticación (`/auth`)

**Descripción de la Pantalla:**
La pantalla de autenticación presenta un diseño moderno con fondo de imagen y overlay, optimizada para todos los dispositivos.

**Elementos Principales:**
- **Tabs de navegación:** "Iniciar Sesión" y "Registrarse"
- **Formulario de Login:** Campos de email y contraseña
- **Formulario de Registro:** Email, contraseña y confirmación
- **Botones de acción:** Con estados de carga
- **Diseño responsive:** Se adapta automáticamente a móviles y tablets

**Proceso de Login:**
1. Ingrese su email corporativo
2. Ingrese su contraseña
3. Haga clic en "Iniciar Sesión"
4. El sistema redirige automáticamente según su rol

**Proceso de Registro:**
1. Seleccione la tab "Registrarse"
2. Complete email y contraseña
3. Confirme su contraseña
4. Haga clic en "Crear Cuenta"
5. Verifique su email (si está habilitado)

### 1.2 Roles de Usuario

**🔧 Administrador:**
- Acceso completo al sistema
- Gestión de usuarios, configuraciones y datos maestros
- Reportes y análisis avanzados

**⚙️ Operador:**
- Vista móvil optimizada
- Gestión de servicios asignados
- Inspecciones digitales

**👤 Cliente:**
- Portal personalizado
- Solicitud de servicios
- Consulta de historial y facturas

**👁️ Viewer:**
- Solo lectura de información
- Acceso a reportes básicos
- Sin permisos de modificación

---

## 2. PORTAL ADMINISTRATIVO

### 2.1 Dashboard Principal (`/dashboard`)

**Vista General:**
El dashboard principal presenta una vista completa de las métricas clave del negocio con diseño responsive que se adapta a cualquier dispositivo.

**Elementos de la Pantalla:**

**📊 Tarjetas de Métricas (Fila Superior):**
- **Ingresos del Mes:** Muestra total facturado con indicador de crecimiento
- **Servicios Realizados:** Contador de servicios completados
- **Servicios Próximos:** Servicios programados para los próximos días
- **Facturas Vencidas:** Alertas de facturas pendientes de pago

**📈 Gráficos Interactivos:**
- **Gráfico de Ingresos:** Evolución mensual de ingresos
- **Distribución de Servicios:** Por tipo y estado
- **Rendimiento por Operador:** Servicios completados por operador

**🔔 Panel de Alertas:**
- Documentos próximos a vencer
- Mantenimientos programados
- Servicios retrasados
- Notificaciones del sistema

**Navegación Móvil:**
En dispositivos móviles, las tarjetas se apilan verticalmente y los gráficos se optimizan para touch.

### 2.2 Gestión de Servicios (`/services`)

**Funcionalidades Principales:**

**📋 Lista de Servicios:**
- **Vista de Tabla (Desktop):** Columnas ordenables con toda la información
- **Vista de Tarjetas (Móvil):** Diseño optimizado para pantallas pequeñas
- **Filtros Avanzados:** Por fecha, estado, cliente, operador, tipo de servicio
- **Búsqueda Instantánea:** Por folio, cliente o detalles del servicio

**➕ Crear Nuevo Servicio:**

**Paso 1: Información Básica**
1. Seleccione el tipo de servicio
2. Elija la fecha de solicitud y servicio
3. Ingrese el folio (auto-generado por defecto)

**Paso 2: Información del Cliente**
1. Busque o seleccione el cliente
2. Complete datos adicionales si es necesario

**Paso 3: Detalles del Vehículo**
1. Marca, modelo y patente del vehículo
2. Ubicación de origen y destino
3. Observaciones especiales

**Paso 4: Recursos Asignados**
1. Seleccione la grúa disponible
2. Asigne el operador responsable
3. Configure valores y comisiones

**Paso 5: Confirmación**
1. Revise todos los datos ingresados
2. Confirme la creación del servicio
3. El sistema genera automáticamente el folio

**🔍 Vista de Detalles del Servicio:**
- **Información Completa:** Todos los datos del servicio
- **Timeline de Estados:** Historial de cambios de estado
- **Documentos Asociados:** PDFs de inspección, facturas
- **Edición Rápida:** Campos editables directamente
- **Acciones Disponibles:** Cambiar estado, generar documentos, eliminar

**Estados del Servicio:**
- 🟡 **Pendiente:** Servicio creado, esperando ejecución
- 🔵 **En Progreso:** Operador realizando el servicio
- 🟢 **Completado:** Servicio finalizado exitosamente
- 🔴 **Cancelado:** Servicio cancelado
- 💰 **Facturado:** Incluido en factura generada

### 2.3 Calendario Integrado (`/calendar`)

**Vista de Calendario:**
- **Vista Mensual:** Overview completo de servicios programados
- **Vista Semanal:** Detalle de la semana actual
- **Vista Diaria:** Horarios específicos del día

**Tipos de Eventos:**
- 🚛 **Servicios Programados:** Servicios con fecha y hora específica
- 🔧 **Mantenimientos:** Mantenimientos de grúas programados
- 📅 **Eventos Personalizados:** Reuniones, capacitaciones, etc.

**Crear Evento:**
1. Haga clic en la fecha deseada
2. Seleccione el tipo de evento
3. Complete los detalles (título, descripción, participantes)
4. Asigne recursos si es necesario (grúa, operador)
5. Guarde el evento

**Funcionalidades Avanzadas:**
- **Drag & Drop:** Mueva eventos entre fechas
- **Filtros por Recurso:** Ver solo eventos de una grúa u operador
- **Sincronización:** Eventos se sincronizan con servicios automáticamente
- **Notificaciones:** Recordatorios automáticos de eventos próximos

### 2.4 Gestión de Clientes (`/clients`)

**Lista de Clientes:**
- **Búsqueda Avanzada:** Por RUT, nombre, departamento, email
- **Filtros:** Clientes activos/inactivos, por departamento
- **Vista Responsiva:** Tabla en desktop, tarjetas en móvil
- **Ordenamiento:** Por cualquier columna

**Crear/Editar Cliente:**

**Información Básica:**
1. **RUT:** Número de identificación único
2. **Nombre:** Razón social o nombre completo
3. **Departamento:** Área o división del cliente

**Información de Contacto:**
1. **Email:** Email principal para comunicaciones
2. **Teléfono:** Número de contacto
3. **Dirección:** Dirección física completa

**Configuraciones:**
1. **Estado:** Activo/Inactivo
2. **Usuario Asociado:** Vinculación con cuenta de usuario
3. **Observaciones:** Notas adicionales

**Vista de Detalle del Cliente:**
- **Historial de Servicios:** Todos los servicios solicitados
- **Facturación:** Resumen de facturación y pagos
- **Estadísticas:** Servicios por mes, tipo más frecuente
- **Documentos:** Facturas y reportes asociados

### 2.5 Gestión de Operadores (`/operators`) - Solo Administradores

**Lista de Operadores:**
- **Información Completa:** Nombre, RUT, licencia, vencimientos
- **Estados:** Activo/Inactivo con indicadores visuales
- **Alertas:** Licencias próximas a vencer
- **Búsqueda:** Por nombre, RUT o número de licencia

**Crear/Editar Operador:**

**Datos Personales:**
1. **Nombre Completo:** Nombre y apellidos
2. **RUT:** Número de identificación
3. **Teléfono:** Número de contacto

**Información Profesional:**
1. **Número de Licencia:** Licencia de operador de grúa
2. **Fecha de Vencimiento:** Vencimiento del examen/licencia
3. **Certificaciones:** Documentos adicionales

**Configuraciones de Sistema:**
1. **Usuario Asociado:** Vinculación con cuenta de sistema
2. **Estado:** Activo/Inactivo
3. **Permisos:** Tipos de grúa que puede operar

**Gestión de Vencimientos:**
- **Alertas Automáticas:** 30, 15 y 7 días antes del vencimiento
- **Renovación:** Proceso de actualización de fechas
- **Historial:** Registro de renovaciones anteriores

### 2.6 Gestión de Grúas (`/cranes`)

**Inventario de Grúas:**
- **Vista Completa:** Marca, modelo, patente, tipo, estado
- **Indicadores de Estado:** Disponible, en servicio, mantenimiento
- **Filtros:** Por tipo, estado, próximos vencimientos
- **Búsqueda:** Por patente, marca o modelo

**Crear/Editar Grúa:**

**Información del Vehículo:**
1. **Marca y Modelo:** Fabricante y modelo específico
2. **Patente:** Número de placa único
3. **Tipo de Grúa:** Liviana, mediana, pesada, taxi, otro

**Documentación Legal:**
1. **Permiso de Circulación:** Fecha de vencimiento
2. **Seguro:** Fecha de vencimiento de póliza
3. **Revisión Técnica:** Fecha de próxima revisión

**Estado y Configuración:**
1. **Estado:** Activa/Inactiva
2. **Disponibilidad:** Para asignación de servicios
3. **Observaciones:** Notas especiales o restricciones

**Gestión de Documentos:**
- **Subida de Archivos:** PDFs de documentos legales
- **Alertas de Vencimiento:** Notificaciones automáticas
- **Historial:** Registro de renovaciones y mantenimientos

**Mantenimientos:**
- **Programación:** Mantenimientos preventivos y correctivos
- **Costos:** Registro de gastos asociados
- **Historial:** Todas las intervenciones realizadas

### 2.7 Tipos de Servicio (`/service-types`) - Solo Administradores

**Configuración de Tipos:**
- **Lista Completa:** Todos los tipos de servicio disponibles
- **Estados:** Activos/Inactivos
- **Precios Base:** Tarifa estándar por tipo

**Crear/Editar Tipo de Servicio:**

**Información Básica:**
1. **Nombre:** Denominación del tipo de servicio
2. **Descripción:** Detalle de qué incluye el servicio
3. **Precio Base:** Tarifa estándar (opcional)

**Requisitos del Servicio:**
1. **Grúa Requerida:** ☑️ Sí / ☐ No
2. **Operador Requerido:** ☑️ Sí / ☐ No
3. **Origen Requerido:** ☑️ Sí / ☐ No
4. **Destino Requerido:** ☑️ Sí / ☐ No

**Información del Vehículo:**
1. **Marca Requerida:** ☑️ Sí / ☐ No
2. **Modelo Requerido:** ☑️ Sí / ☐ No
3. **Patente Requerida:** ☑️ Sí / ☐ No
4. **Información Opcional:** ☑️ Campos no obligatorios

**Configuraciones Adicionales:**
1. **Orden de Compra:** ☑️ Requerida / ☐ Opcional
2. **Estado:** Activo/Inactivo
3. **Validaciones:** Reglas especiales del tipo

### 2.8 Cierres de Servicio (`/closures`)

**¿Qué son los Cierres?**
Los cierres son agrupaciones de servicios por período para facilitar la facturación masiva a clientes.

**Lista de Cierres:**
- **Información del Cierre:** Folio, período, cliente, total
- **Estados:** Abierto, Cerrado, Facturado
- **Filtros:** Por fecha, cliente, estado
- **Búsqueda:** Por folio o cliente

**Crear Nuevo Cierre:**

**Paso 1: Configuración Básica**
1. **Folio:** Número único del cierre (auto-generado)
2. **Fecha Desde:** Inicio del período a incluir
3. **Fecha Hasta:** Final del período a incluir
4. **Cliente:** Seleccionar cliente específico (opcional)

**Paso 2: Selección de Servicios**
1. El sistema muestra servicios completados en el período
2. Seleccione los servicios a incluir en el cierre
3. Revise totales calculados automáticamente
4. Confirme la selección

**Paso 3: Generación**
1. El sistema crea el cierre con los servicios seleccionados
2. Calcula el total automáticamente
3. Genera el documento del cierre
4. Queda listo para facturación

**Gestionar Cierre Existente:**
- **Ver Detalles:** Servicios incluidos y totales
- **Modificar:** Agregar o quitar servicios (solo si está abierto)
- **Cerrar:** Finalizar para proceder a facturación
- **Generar Factura:** Crear factura desde el cierre

### 2.9 Facturación (`/invoices`)

**Lista de Facturas:**
- **Información Completa:** Folio, cliente, fecha, total, estado
- **Estados Visuales:** Borrador, Enviada, Pagada, Vencida, Cancelada
- **Filtros Avanzados:** Por estado, fecha, cliente, rango de montos
- **Búsqueda:** Por folio, número fiscal o cliente

**Estados de Factura:**
- 📝 **Borrador:** Factura creada, pendiente de envío
- 📤 **Enviada:** Enviada al cliente, pendiente de pago
- ✅ **Pagada:** Pago recibido y confirmado
- ⏰ **Vencida:** Pasada la fecha de vencimiento sin pago
- ❌ **Cancelada:** Factura anulada

**Crear Factura Desde Cierre:**
1. Seleccione un cierre cerrado
2. El sistema pre-llena los datos del cierre
3. Configure fecha de emisión y vencimiento
4. Agregue notas adicionales si es necesario
5. Genere la factura

**Crear Factura Manual:**
1. Seleccione el cliente
2. Configure fechas de emisión y vencimiento
3. Agregue servicios individuales
4. Configure totales y porcentajes
5. Genere la factura

**Gestión de Facturas:**
- **Ver Detalles:** Información completa y servicios incluidos
- **Modificar:** Solo facturas en estado borrador
- **Marcar como Pagada:** Registrar pago recibido
- **Descargar PDF:** Documento listo para envío
- **Reenviar:** Envío por email al cliente
- **Cancelar:** Anular factura si es necesario

**Configuración de Facturación:**
- **Datos de la Empresa:** Logo, datos fiscales, textos legales
- **Numeración:** Formato de folios y números fiscales
- **Vencimientos:** Días de vencimiento por defecto
- **Porcentajes:** IVA y otros impuestos

### 2.10 Control de Costos (`/costs`)

**¿Qué son los Costos?**
Registro de todos los gastos operacionales relacionados con servicios, grúas, operadores y centros de costo.

**Lista de Costos:**
- **Información Completa:** Fecha, descripción, categoría, monto
- **Filtros:** Por fecha, categoría, centro de costo, grúa, operador
- **Totales:** Suma automática por período y categoría
- **Búsqueda:** Por descripción o folio de servicio

**Registrar Nuevo Costo:**

**Información Básica:**
1. **Fecha:** Fecha del gasto
2. **Descripción:** Detalle específico del gasto
3. **Monto:** Valor del gasto en pesos

**Categorización:**
1. **Categoría:** Combustible, Mantenimiento, Operación, etc.
2. **Subcategoría:** Clasificación más específica
3. **Centro de Costo:** Asignación presupuestaria

**Asignación de Recursos:**
1. **Grúa:** Grúa relacionada (opcional)
2. **Operador:** Operador relacionado (opcional)
3. **Servicio:** Servicio específico (opcional)
4. **Folio de Servicio:** Referencia cruzada

**Observaciones:**
1. **Notas:** Información adicional del gasto
2. **Documentos:** Adjuntar comprobantes (opcional)

**Categorías Predefinidas:**
- 🚛 **Combustible:** Gas oil, bencina, etc.
- 🔧 **Mantenimiento:** Reparaciones y mantenciones
- 👤 **Personal:** Sueldos, viáticos, capacitaciones
- 📋 **Administrativo:** Oficina, seguros, permisos
- 🛠️ **Repuestos:** Piezas y componentes
- 📱 **Comunicaciones:** Teléfono, internet, radio
- 🚗 **Transporte:** Movilización, peajes, estacionamientos

**Análisis de Costos:**
- **Por Grúa:** Costos totales por vehículo
- **Por Operador:** Gastos asociados a cada operador
- **Por Servicio:** Costos directos e indirectos por servicio
- **Tendencias:** Evolución de costos en el tiempo
- **Rentabilidad:** Comparación ingresos vs costos

### 2.11 Reportes (`/reports`)

**Dashboard de Reportes:**
Centraliza todos los análisis y métricas del negocio en gráficos interactivos y exportables.

**📊 Métricas Financieras:**

**Ingresos y Rentabilidad:**
- **Ingresos por Período:** Evolución mensual/anual
- **Ingresos por Cliente:** Ranking de clientes más importantes
- **Ingresos por Tipo de Servicio:** Distribución por categoría
- **Rentabilidad:** Ingresos vs costos por período

**Análisis de Facturación:**
- **Facturas por Estado:** Pagadas, vencidas, pendientes
- **Días Promedio de Pago:** Tiempo de cobro por cliente
- **Cartera Vencida:** Montos y antigüedad de deuda

**📈 Métricas Operacionales:**

**Servicios:**
- **Servicios por Período:** Cantidad y evolución
- **Servicios por Estado:** Distribución de estados
- **Servicios por Operador:** Productividad individual
- **Servicios por Grúa:** Utilización de flota

**Eficiencia:**
- **Tiempo Promedio por Servicio:** Por tipo y operador
- **Disponibilidad de Flota:** % de tiempo activo por grúa
- **Utilización de Operadores:** Servicios por operador/día

**🚛 Métricas de Flota:**

**Disponibilidad:**
- **Estado de Grúas:** Disponible, en servicio, mantenimiento
- **Utilización:** Horas de trabajo vs disponibles
- **Mantenimientos:** Programados vs realizados

**Costos Operacionales:**
- **Costos por Grúa:** Mantenimiento, combustible, operación
- **Costos por Kilómetro:** Eficiencia operacional
- **Análisis de Rentabilidad:** Ingresos vs costos por grúa

**👥 Métricas de Personal:**

**Productividad:**
- **Servicios por Operador:** Cantidad y calidad
- **Comisiones Pagadas:** Por operador y período
- **Evaluación de Desempeño:** Métricas de calidad

**📱 Funcionalidades de Exportación:**

**Formatos Disponibles:**
- **Excel:** Datos tabulares para análisis
- **PDF:** Reportes formatados para presentación
- **CSV:** Datos para importar en otros sistemas

**Configuración de Reportes:**
- **Períodos Personalizados:** Desde/hasta fechas específicas
- **Filtros Avanzados:** Por cliente, operador, grúa, tipo
- **Agrupaciones:** Por día, semana, mes, año
- **Comparaciones:** Período actual vs anterior

**Automatización:**
- **Reportes Programados:** Envío automático por email
- **Alertas:** Notificaciones cuando métricas superan umbrales
- **Dashboard Personalizado:** Cada usuario ve sus métricas relevantes

### 2.12 Configuración (`/settings`) - Solo Administradores

**Gestión de la Empresa:**

**Datos Corporativos:**
1. **Razón Social:** Nombre legal de la empresa
2. **RUT:** Identificación fiscal
3. **Dirección:** Dirección legal completa
4. **Contacto:** Teléfono y email corporativo
5. **Sitio Web:** URL del sitio web (opcional)

**Configuración de Documentos:**
1. **Logo:** Imagen corporativa para documentos
2. **Textos Legales:** Términos y condiciones para facturas
3. **Formato de Folios:** Plantilla para numeración (ej: SRV-{number})
4. **Número Inicial:** Próximo número de folio a usar

**Configuración Fiscal:**
1. **Porcentaje IVA:** Porcentaje de IVA aplicable
2. **Días de Vencimiento:** Días para vencimiento de facturas
3. **Días de Alerta:** Días antes de vencimiento para alertar

**Gestión de Usuarios:**

**Lista de Usuarios del Sistema:**
- **Información Completa:** Nombre, email, rol, estado
- **Filtros:** Por rol, estado activo/inactivo
- **Búsqueda:** Por nombre o email

**Crear Nuevo Usuario:**
1. **Email:** Dirección de correo electrónico
2. **Nombre Completo:** Nombre y apellidos
3. **Rol:** Administrador, Operador, Cliente, Viewer
4. **Cliente Asociado:** Si es rol Cliente, seleccionar cliente

**Gestión de Roles:**
- **Administrador:** Acceso completo al sistema
- **Operador:** Vista móvil y gestión de servicios asignados
- **Cliente:** Portal de cliente con servicios y facturas
- **Viewer:** Solo lectura de información

**Configuraciones del Sistema:**

**Notificaciones:**
1. **Email:** Activar/desactivar notificaciones por email
2. **Push:** Notificaciones en navegador
3. **Alertas de Documentos:** Vencimientos y renovaciones
4. **Recordatorios:** Mantenimientos y servicios

**Seguridad:**
1. **Modo Mantenimiento:** Activar para actualizaciones
2. **Backup Automático:** Configurar respaldos automáticos
3. **Retención de Datos:** Tiempo de conservación de registros
4. **Actualizaciones:** Notificaciones de nuevas versiones

**Configuraciones Operacionales:**
1. **Alertas de Servicio:** Recordatorios de servicios próximos
2. **Alertas de Facturas:** Notificaciones de vencimientos
3. **Configuración de Calendario:** Horarios de trabajo, feriados

---

## 3. PORTAL DEL OPERADOR

### 3.1 Dashboard Móvil (`/operator`)

**Diseño Optimizado para Móviles:**
El portal del operador está específicamente diseñado para uso en smartphones y tablets, con interfaz táctil intuitiva.

**Vista Principal:**
- **Servicios de Hoy:** Lista de servicios asignados para el día actual
- **Estado Actual:** Indicador del servicio en progreso
- **Navegación Rápida:** Accesos directos a funciones principales
- **Información Personal:** Datos del operador logueado

**Servicios Asignados:**
- **Vista de Tarjetas:** Cada servicio en una tarjeta independiente
- **Información Esencial:** Cliente, ubicación, horario, tipo
- **Estados Visuales:** Pendiente, en progreso, completado
- **Acciones Rápidas:** Iniciar, completar, ver detalles

**Funcionalidades Principales:**
1. **Iniciar Servicio:** Cambiar estado a "En Progreso"
2. **Completar Servicio:** Finalizar y requerir inspección
3. **Ver Detalles:** Información completa del servicio
4. **Navegar:** Integración con mapas para ubicaciones
5. **Contactar:** Llamada directa al cliente

**Navegación Optimizada:**
- **Menú Hamburguesa:** Acceso a todas las funciones
- **Botones Grandes:** Fáciles de tocar con dedos
- **Gestos:** Swipe para acciones rápidas
- **Modo Offline:** Funcionalidad básica sin conexión

### 3.2 Inspección de Servicios (`/operator/service/:id/inspection`)

**¿Qué es la Inspección Digital?**
Proceso digitalizado para documentar el estado del vehículo, verificar equipos y obtener conformidad del cliente.

**Proceso de Inspección Paso a Paso:**

**Paso 1: Información del Cliente**
1. **Datos del Cliente:** Verificar nombre y RUT
2. **Editar si es Necesario:** Corregir datos incorrectos
3. **Confirmar Identidad:** Validar que coincida con el solicitante

**Paso 2: Fotografías del Servicio**

**Fotos Antes del Servicio:**
1. Toque el botón "📷 Tomar Foto"
2. Capture el estado inicial del vehículo
3. Tome múltiples ángulos si es necesario
4. Las fotos se guardan automáticamente

**Fotos del Vehículo del Cliente:**
1. Documente daños preexistentes
2. Capture detalles importantes
3. Asegure buena iluminación
4. Incluya patente y VIN si es visible

**Fotos del Equipo Utilizado:**
1. Fotografíe la grúa y accesorios
2. Muestre el proceso de carga/descarga
3. Documente el estado final
4. Capture la entrega al cliente

**Paso 3: Lista de Verificación de Equipos**
- ☑️ **Grúa en buen estado:** Verificar funcionamiento
- ☑️ **Accesorios completos:** Cadenas, ganchos, cinchas
- ☑️ **Documentos al día:** Permisos y certificaciones
- ☑️ **Equipo de seguridad:** Cascos, chalecos, señalización
- ☑️ **Herramientas necesarias:** Según tipo de servicio

**Paso 4: Observaciones del Vehículo**
1. **Campo de Texto Libre:** Describa el estado del vehículo
2. **Daños Observados:** Detalle cualquier daño preexistente
3. **Condiciones Especiales:** Modificaciones, accesorios
4. **Recomendaciones:** Sugerencias para el cliente

**Paso 5: Firma Digital del Cliente**
1. **Entregue el dispositivo al cliente**
2. **Explique que está firmando la conformidad**
3. **El cliente firma en la pantalla táctil**
4. **Guarde la firma automáticamente**

**Paso 6: Finalización**
1. **Revise toda la información ingresada**
2. **Verifique que todas las fotos estén claras**
3. **Confirme que la firma se guardó correctamente**
4. **Toque "Completar Inspección"**

**Generación Automática de Documentos:**
- **PDF de Inspección:** Se genera automáticamente
- **Envío por Email:** Al cliente y oficina
- **Almacenamiento:** En el historial del servicio
- **Código QR:** Para verificación posterior

**Funcionalidades Avanzadas:**
- **Modo Offline:** Funciona sin conexión a internet
- **Sincronización:** Sube datos cuando hay conexión
- **Backup Local:** Copia de seguridad en el dispositivo
- **Geolocalización:** Registra ubicación GPS automáticamente

---

## 4. PORTAL DEL CLIENTE

### 4.1 Dashboard del Cliente (`/portal/dashboard`)

**Vista Personalizada:**
Cada cliente ve únicamente su información y servicios, con diseño limpio y funcional.

**Elementos Principales:**

**📊 Resumen de Actividad:**
- **Servicios Este Mes:** Cantidad de servicios solicitados
- **Último Servicio:** Fecha y estado del servicio más reciente
- **Facturas Pendientes:** Montos pendientes de pago
- **Próximos Servicios:** Servicios programados

**🚀 Accesos Rápidos:**
- **Solicitar Servicio:** Botón prominente para nueva solicitud
- **Ver Mis Servicios:** Acceso directo al historial
- **Mis Facturas:** Consulta de facturas y pagos
- **Contacto:** Información de contacto directo

**📈 Gráficos Personalizados:**
- **Servicios por Mes:** Evolución de solicitudes
- **Tipos de Servicio:** Distribución por categoría
- **Facturación:** Montos mensuales

**🔔 Notificaciones:**
- **Servicios Completados:** Confirmaciones de finalización
- **Facturas Nuevas:** Aviso de facturas generadas
- **Recordatorios:** Servicios próximos o pagos pendientes

### 4.2 Mis Servicios (`/portal/services`)

**Historial Completo:**
Vista de todos los servicios solicitados por el cliente, con filtros y búsqueda.

**Información Mostrada:**
- **Folio:** Número único del servicio
- **Fecha:** Fecha de solicitud y ejecución
- **Tipo:** Categoría del servicio
- **Estado:** Estado actual con indicadores visuales
- **Vehículo:** Marca, modelo y patente
- **Valor:** Monto del servicio

**Estados Visibles para el Cliente:**
- 🟡 **Pendiente:** Servicio aceptado, esperando ejecución
- 🔵 **En Progreso:** Operador ejecutando el servicio
- 🟢 **Completado:** Servicio finalizado exitosamente
- 🔴 **Cancelado:** Servicio cancelado

**Filtros Disponibles:**
- **Por Fecha:** Rango de fechas específico
- **Por Estado:** Solo servicios en estado específico
- **Por Tipo:** Solo cierto tipo de servicio
- **Por Vehículo:** Servicios de una patente específica

**Detalles del Servicio:**
1. **Información Completa:** Todos los datos del servicio
2. **Timeline:** Historial de cambios de estado
3. **Documentos:** PDFs de inspección disponibles para descarga
4. **Fotos:** Galería de fotos del servicio (si disponible)
5. **Observaciones:** Notas del operador

**Acciones Disponibles:**
- **Ver Detalles:** Información completa del servicio
- **Descargar PDF:** Documento de inspección
- **Solicitar Similar:** Crear nuevo servicio con datos similares
- **Calificar Servicio:** Sistema de calificación (si implementado)

### 4.3 Solicitar Servicio (`/portal/request-service`)

**Formulario Simplificado:**
Proceso optimizado para que el cliente pueda solicitar servicios de manera rápida e intuitiva.

**Paso 1: Tipo de Servicio**
1. **Selección Visual:** Iconos y descripciones claras
2. **Tipos Disponibles:** Solo tipos habilitados para el cliente
3. **Información Automática:** Precio base si está configurado

**Paso 2: Información del Vehículo**

**Datos del Vehículo:**
1. **Marca:** Lista desplegable de marcas disponibles
2. **Modelo:** Se filtra según la marca seleccionada
3. **Patente:** Campo libre para ingreso
4. **Observaciones:** Detalles adicionales del vehículo

**Ubicaciones:**
1. **Origen:** Dirección de recogida
2. **Destino:** Dirección de entrega
3. **Mapas Integrados:** Selección visual si está disponible
4. **Referencias:** Puntos de referencia adicionales

**Paso 3: Programación**
1. **Fecha Preferida:** Calendario para seleccionar fecha
2. **Hora Preferida:** Horario deseado (si disponible)
3. **Flexibilidad:** Indicar si puede ser en horarios alternativos
4. **Urgencia:** Nivel de prioridad del servicio

**Paso 4: Información Adicional**
1. **Orden de Compra:** Si es requerida por el tipo de servicio
2. **Observaciones Especiales:** Detalles importantes para el operador
3. **Contacto Alternativo:** Otra persona para coordinar
4. **Instrucciones Especiales:** Acceso, horarios, etc.

**Paso 5: Confirmación**
1. **Resumen Completo:** Revisión de todos los datos
2. **Términos y Condiciones:** Aceptación de términos
3. **Envío de Solicitud:** Confirmación final
4. **Número de Referencia:** Se genera folio único

**Proceso Post-Solicitud:**
- **Confirmación Inmediata:** Email con detalles de la solicitud
- **Asignación:** Sistema asigna grúa y operador
- **Notificación:** Cliente recibe confirmación con datos del operador
- **Seguimiento:** Puede rastrear el estado en tiempo real

### 4.4 Mis Facturas (`/portal/invoices`)

**Vista de Facturas:**
Acceso completo al historial de facturación con capacidad de descarga y consulta de estado de pagos.

**Lista de Facturas:**
- **Información Básica:** Folio, fecha, monto, estado
- **Estados Visuales:** Colores diferenciados por estado
- **Filtros:** Por fecha, estado, rango de montos
- **Búsqueda:** Por número de factura o período

**Estados de Factura para Clientes:**
- 📝 **Nueva:** Factura recién generada
- 📤 **Enviada:** Factura oficialmente enviada
- ⏰ **Por Vencer:** Próxima a fecha de vencimiento
- ⚠️ **Vencida:** Pasada la fecha de vencimiento
- ✅ **Pagada:** Pago confirmado y registrado

**Detalles de Factura:**
1. **Información Completa:** Datos fiscales, fechas, totales
2. **Servicios Incluidos:** Detalle de servicios facturados
3. **Cálculos:** Subtotal, IVA, total
4. **Términos de Pago:** Condiciones y vencimiento

**Funcionalidades Disponibles:**
- **Descargar PDF:** Factura en formato imprimible
- **Enviar por Email:** Reenvío a email alternativo
- **Historial de Pagos:** Registro de pagos parciales o totales
- **Contactar:** Botón directo para consultas sobre la factura

**Resumen Financiero:**
- **Saldo Actual:** Total pendiente de pago
- **Facturas del Mes:** Resumen del período actual
- **Historial de Pagos:** Registro de pagos realizados
- **Próximos Vencimientos:** Facturas por vencer

---

## 5. FUNCIONALIDADES RESPONSIVE

### 5.1 Sistema de Breakpoints

El sistema TMS Grúas utiliza un diseño completamente responsive que se adapta automáticamente a diferentes dispositivos:

**Breakpoints Definidos:**
- **Mobile:** < 640px (Smartphones)
- **Tablet:** 640px - 1024px (Tablets)
- **Desktop:** > 1024px (Computadores)

### 5.2 Adaptaciones por Dispositivo

**📱 Vista Móvil (Smartphones):**
- **Navegación:** Menú hamburguesa colapsable
- **Tablas:** Se convierten en tarjetas apilables
- **Formularios:** Campos más grandes y táctiles
- **Botones:** Tamaño optimizado para dedos
- **Imágenes:** Se redimensionan automáticamente

**📱 Vista Tablet:**
- **Navegación:** Menú parcialmente expandido
- **Layout:** Columnas adaptativas
- **Formularios:** Organización en 2 columnas
- **Tablas:** Scroll horizontal con columnas esenciales
- **Modales:** Tamaño optimizado para pantalla

**🖥️ Vista Desktop:**
- **Navegación:** Menú completo siempre visible
- **Tablas:** Vista completa con todas las columnas
- **Formularios:** Multi-columna optimizada
- **Dashboards:** Grid completo de métricas
- **Gráficos:** Tamaño completo con interactividad

### 5.3 Progressive Web App (PWA)

**Características PWA:**
- **Instalación:** Se puede instalar como app nativa
- **Offline:** Funcionalidad básica sin conexión
- **Notificaciones:** Push notifications en dispositivos
- **Caché:** Recursos guardados localmente
- **Actualizaciones:** Automáticas en segundo plano

**Beneficios:**
- **Acceso Rápido:** Icono en pantalla de inicio
- **Rendimiento:** Carga más rápida
- **Experiencia Nativa:** Se comporta como app instalada
- **Sincronización:** Datos se sincronizan automáticamente

---

## 6. FLUJOS DE TRABAJO PRINCIPALES

### 6.1 Flujo Completo de un Servicio

**1. Solicitud del Servicio:**
- Cliente solicita servicio via portal web o teléfono
- Sistema genera folio único automáticamente
- Se validan datos y disponibilidad de recursos

**2. Asignación de Recursos:**
- Sistema asigna grúa disponible según tipo de servicio
- Se selecciona operador calificado y disponible
- Se programa fecha y hora según disponibilidad

**3. Confirmación y Notificación:**
- Cliente recibe confirmación con datos del operador
- Operador recibe notificación en su dispositivo móvil
- Sistema actualiza calendario y disponibilidad

**4. Ejecución del Servicio:**
- Operador marca inicio del servicio en app móvil
- Se ejecuta el servicio según especificaciones
- Sistema rastrea tiempo y ubicación automáticamente

**5. Inspección Digital:**
- Operador completa inspección en dispositivo móvil
- Se toman fotografías y obtiene firma del cliente
- Sistema genera PDF automáticamente

**6. Finalización:**
- Servicio se marca como completado
- PDF se envía automáticamente al cliente
- Sistema actualiza métricas y disponibilidad

**7. Facturación:**
- Servicio queda disponible para incluir en cierres
- Se genera factura según configuración
- Cliente recibe factura por email

### 6.2 Proceso de Facturación

**Facturación por Cierres (Recomendado):**

**1. Creación de Cierre:**
- Seleccionar período y cliente (opcional)
- Sistema muestra servicios completados disponibles
- Seleccionar servicios a incluir en el cierre

**2. Revisión y Aprobación:**
- Verificar servicios incluidos y totales
- Confirmar datos del cliente y período
- Cerrar el cierre para proceder a facturación

**3. Generación de Factura:**
- Crear factura desde el cierre aprobado
- Sistema pre-llena todos los datos automáticamente
- Configurar fechas de emisión y vencimiento

**4. Envío y Seguimiento:**
- Enviar factura por email al cliente
- Marcar como enviada en el sistema
- Hacer seguimiento de pagos y vencimientos

**Facturación Individual:**

**1. Selección de Servicios:**
- Elegir servicios específicos a facturar
- Pueden ser de diferentes fechas y tipos
- Validar que estén completados

**2. Configuración Manual:**
- Completar datos del cliente
- Configurar fechas y términos
- Ajustar montos si es necesario

**3. Generación y Envío:**
- Crear factura con datos configurados
- Descargar PDF y enviar al cliente
- Registrar en sistema para seguimiento

### 6.3 Inspección Digital por Operadores

**Preparación:**
- Operador recibe notificación de servicio asignado
- Revisa detalles del servicio en app móvil
- Se dirige a ubicación de origen

**Inicio del Servicio:**
- Marca inicio en app móvil
- Sistema registra hora y ubicación GPS
- Actualiza estado del servicio automáticamente

**Ejecución:**
- Realiza el servicio según especificaciones
- Puede actualizar estado si es necesario
- Mantiene comunicación con base si requerido

**Proceso de Inspección:**

**1. Datos del Cliente:**
- Verificar identidad del cliente
- Corregir datos si es necesario
- Confirmar información de contacto

**2. Documentación Fotográfica:**
- **Antes del Servicio:** Estado inicial del vehículo
- **Proceso:** Carga y transporte del vehículo
- **Después:** Estado final y entrega

**3. Verificación de Equipos:**
- Completar checklist de equipos utilizados
- Verificar estado y funcionamiento
- Documentar cualquier novedad

**4. Observaciones:**
- Registrar estado del vehículo
- Anotar daños preexistentes
- Incluir recomendaciones para el cliente

**5. Firma Digital:**
- Cliente firma conformidad en pantalla táctil
- Sistema guarda firma con timestamp
- Se asocia automáticamente al servicio

**Finalización:**
- Sistema genera PDF automáticamente
- Se envía copia al cliente por email
- Servicio se marca como completado
- Operador queda disponible para nuevo servicio

### 6.4 Solicitud de Servicio por Cliente

**Acceso al Portal:**
- Cliente accede con credenciales personales
- Sistema redirige a dashboard personalizado
- Solo ve información propia y autorizada

**Proceso de Solicitud:**

**1. Selección de Tipo:**
- Cliente ve tipos de servicio disponibles
- Cada tipo muestra descripción y precio base
- Selección determina campos requeridos

**2. Información del Vehículo:**
- Marca y modelo del vehículo
- Patente y observaciones especiales
- Ubicación de origen y destino

**3. Programación:**
- Fecha preferida de ejecución
- Horario deseado (si disponible)
- Flexibilidad de horarios

**4. Detalles Adicionales:**
- Orden de compra (si requerida)
- Observaciones especiales
- Contacto alternativo

**5. Confirmación:**
- Revisión de todos los datos
- Aceptación de términos y condiciones
- Envío de solicitud

**Post-Solicitud:**
- Sistema genera folio único
- Cliente recibe confirmación por email
- Solicitud se asigna a recursos disponibles
- Cliente puede hacer seguimiento del estado

**Seguimiento:**
- Ver estado en tiempo real
- Recibir notificaciones de cambios
- Contactar directamente al operador asignado
- Descargar documentos una vez completado

---

## 7. CARACTERÍSTICAS TÉCNICAS

### 7.1 Arquitectura del Sistema

**Frontend (Cliente):**
- **React 18:** Framework principal con hooks y componentes funcionales
- **TypeScript:** Tipado estático para mayor robustez
- **Tailwind CSS:** Framework de CSS utilitario
- **Shadcn/ui:** Componentes de interfaz pre-diseñados
- **React Router:** Navegación del lado del cliente
- **React Query:** Manejo de estado del servidor y caché

**Backend (Servidor):**
- **Supabase:** Backend-as-a-Service completo
- **PostgreSQL:** Base de datos relacional robusta
- **Row Level Security (RLS):** Seguridad a nivel de filas
- **Edge Functions:** Lógica del servidor en JavaScript
- **Real-time:** Actualizaciones en tiempo real

**Almacenamiento:**
- **Supabase Storage:** Archivos y documentos
- **CDN Global:** Distribución rápida de contenido
- **Backup Automático:** Respaldos programados

### 7.2 Integración con Supabase

**Autenticación:**
- **JWT Tokens:** Autenticación segura con tokens
- **Session Management:** Manejo de sesiones automático
- **Role-Based Access:** Control de acceso por roles
- **Email Verification:** Verificación de email opcional

**Base de Datos:**
- **Relaciones Complejas:** Integridad referencial
- **Triggers:** Automatización de procesos
- **Functions:** Lógica de negocio en la base
- **Views:** Vistas optimizadas para consultas

**APIs Automáticas:**
- **REST API:** Generación automática de endpoints
- **GraphQL:** Consultas flexibles (opcional)
- **Real-time API:** Suscripciones a cambios
- **Storage API:** Manejo de archivos

### 7.3 Sistema de Notificaciones

**Tipos de Notificaciones:**
- **Push Notifications:** En navegador y dispositivos
- **Email:** Notificaciones por correo electrónico
- **In-App:** Notificaciones dentro de la aplicación
- **SMS:** Mensajes de texto (configurable)

**Eventos que Generan Notificaciones:**
- **Nuevos Servicios:** Para operadores asignados
- **Cambios de Estado:** Para clientes y administradores
- **Vencimientos:** Documentos, licencias, facturas
- **Pagos:** Confirmaciones de pagos recibidos
- **Mantenimientos:** Recordatorios programados

**Configuración Personalizada:**
- **Por Usuario:** Cada usuario configura sus preferencias
- **Por Tipo:** Activar/desactivar por categoría
- **Horarios:** Configurar horarios de envío
- **Canales:** Elegir medio de notificación preferido

### 7.4 Exportación de Datos

**Formatos Soportados:**
- **PDF:** Documentos formatados para impresión
- **Excel:** Datos tabulares para análisis
- **CSV:** Datos para importar en otros sistemas
- **JSON:** Datos estructurados para APIs

**Tipos de Exportación:**
- **Reportes:** Métricas y análisis formatados
- **Listas:** Datos tabulares de entidades
- **Documentos:** Facturas, inspecciones, contratos
- **Backups:** Respaldos completos de datos

**Programación:**
- **Manual:** Exportación bajo demanda
- **Programada:** Exportación automática periódica
- **Eventos:** Exportación trigger por eventos
- **APIs:** Acceso programático para integraciones

### 7.5 Backup y Seguridad

**Respaldos Automáticos:**
- **Diarios:** Backup completo cada 24 horas
- **Incrementales:** Cambios cada hora
- **Retención:** 30 días de historial mínimo
- **Ubicación:** Múltiples zonas geográficas

**Seguridad de Datos:**
- **Encriptación:** En tránsito y en reposo
- **SSL/HTTPS:** Comunicación segura
- **Tokens JWT:** Autenticación sin contraseñas
- **Row Level Security:** Acceso granular por usuario

**Auditoría:**
- **Logs de Acceso:** Registro de todas las sesiones
- **Cambios de Datos:** Historial de modificaciones
- **Exportaciones:** Registro de datos exportados
- **Errores:** Monitoreo de errores y excepciones

**Compliance:**
- **GDPR:** Cumplimiento de privacidad europea
- **SOC 2:** Controles de seguridad organizacional
- **ISO 27001:** Estándares de seguridad internacional
- **Auditorías:** Revisiones periódicas de seguridad

---

## 8. TROUBLESHOOTING

### 8.1 Problemas Comunes de Acceso

**No Puedo Iniciar Sesión:**

**Síntomas:**
- Email o contraseña incorrectos
- Error "Usuario no encontrado"
- Pantalla de login se queda cargando

**Soluciones:**
1. **Verificar Credenciales:**
   - Confirme que el email esté escrito correctamente
   - Verifique que no hay espacios extra
   - Pruebe con contraseña temporal si es necesario

2. **Revisar Estado del Usuario:**
   - Contacte al administrador para verificar que su usuario esté activo
   - Confirme que tiene los permisos correctos asignados

3. **Limpiar Caché del Navegador:**
   - Presione Ctrl+Shift+Delete (Windows) o Cmd+Shift+Delete (Mac)
   - Seleccione "Cookies y datos de sitios" y "Archivos e imágenes en caché"
   - Reinicie el navegador e intente nuevamente

4. **Probar en Modo Incógnito:**
   - Abra una ventana de incógnito/privada
   - Intente acceder al sistema
   - Si funciona, el problema es del caché local

**Redirects Incorrectos:**
- Verifique que esté usando la URL correcta del sistema
- Contacte soporte técnico si es redirigido a localhost

### 8.2 Problemas de Carga y Rendimiento

**La Aplicación Carga Lento:**

**Síntomas:**
- Páginas tardan más de 10 segundos en cargar
- Imágenes no aparecen
- Botones no responden inmediatamente

**Soluciones:**
1. **Verificar Conexión a Internet:**
   - Pruebe otros sitios web para confirmar velocidad
   - Reinicie su router si es necesario
   - Considere cambiar de red WiFi a datos móviles

2. **Optimización del Navegador:**
   - Cierre pestañas innecesarias
   - Reinicie el navegador completamente
   - Actualice a la versión más reciente

3. **Configuración de Red:**
   - Desactive VPN temporalmente si usa uno
   - Verifique que no hay proxy configurado
   - Contacte IT si está en red corporativa

**Error de Conexión:**
- Verifique que no hay firewall bloqueando el acceso
- Confirme que los puertos HTTPS (443) estén abiertos
- Intente desde diferentes dispositivos/redes

### 8.3 Problemas en Dispositivos Móviles

**App No Funciona en Móvil:**

**Síntomas:**
- Botones muy pequeños para tocar
- Texto no se lee bien
- Formularios no se pueden completar

**Soluciones:**
1. **Verificar Navegador Móvil:**
   - Use Chrome, Safari o Firefox actualizados
   - Evite navegadores menos comunes
   - Actualice el navegador si es necesario

2. **Configuración de Pantalla:**
   - No use zoom del navegador
   - Verifique que la rotación automática esté activada
   - Use en orientación vertical para mejor experiencia

3. **Memoria del Dispositivo:**
   - Cierre aplicaciones innecesarias
   - Reinicie el dispositivo si está lento
   - Libere espacio de almacenamiento

**Problemas con PWA (App Instalada):**
- Desinstale y reinstale la aplicación web
- Verifique que tenga permisos de notificaciones
- Actualice desde el navegador original

### 8.4 Problemas de Funcionalidad

**No Puedo Subir Fotos:**

**Síntomas:**
- Botón de cámara no responde
- Fotos no se guardan
- Error de "archivo muy grande"

**Soluciones:**
1. **Permisos del Navegador:**
   - Permita acceso a cámara y archivos
   - Verifique en configuración del navegador
   - Actualice permisos si fueron denegados

2. **Tamaño de Archivo:**
   - Use fotos de menos de 10MB
   - Reduzca calidad de cámara si es necesario
   - Comprima imágenes antes de subir

3. **Formato de Archivo:**
   - Use formatos JPG, PNG o WebP
   - Evite formatos RAW o TIFF
   - Tome fotos directamente con la cámara del dispositivo

**Formularios No Se Guardan:**

**Síntomas:**
- Datos se pierden al cambiar de página
- Error al enviar formulario
- Campos obligatorios no se validan

**Soluciones:**
1. **Completar Campos Obligatorios:**
   - Revise que todos los campos marcados con * estén completos
   - Verifique formatos de fecha correctos
   - Confirme que emails tengan formato válido

2. **Navegación Correcta:**
   - Use botones del sistema, no del navegador
   - No use botón "Atrás" del navegador
   - Complete paso a paso sin saltar secciones

3. **Conexión Estable:**
   - Verifique conexión antes de enviar
   - No cierre la ventana mientras se procesa
   - Guarde borradores si la función está disponible

### 8.5 Problemas de Impresión y Documentos

**PDFs No Se Generan:**

**Síntomas:**
- Error al generar documento
- PDF aparece en blanco
- No se puede descargar

**Soluciones:**
1. **Permisos de Descarga:**
   - Permita descargas en el navegador
   - Verifique que no hay bloqueador de pop-ups
   - Revise carpeta de descargas del dispositivo

2. **Completitud de Datos:**
   - Verifique que todos los campos requeridos estén completos
   - Confirme que las fotos se hayan subido correctamente
   - Asegúrese de que la firma digital esté guardada

3. **Navegador Compatible:**
   - Use navegadores modernos (Chrome, Firefox, Safari)
   - Actualice a versión más reciente
   - Pruebe en modo incógnito

**Documentos No Se Envían por Email:**

**Síntomas:**
- Email no llega al destinatario
- Error de "envío fallido"
- Demora excesiva en entrega

**Soluciones:**
1. **Verificar Email:**
   - Confirme que la dirección esté correcta
   - Revise carpeta de spam/basura
   - Verifique que el servidor de email esté funcionando

2. **Configuración del Sistema:**
   - Contacte administrador para verificar configuración SMTP
   - Confirme que los dominios no estén bloqueados
   - Verifique límites de envío diario

### 8.6 Cuando Contactar Soporte

**Contacte Soporte Técnico Si:**
- Los problemas persisten después de seguir estas soluciones
- Aparecen errores técnicos específicos con códigos
- Necesita recuperar datos perdidos
- Requiere capacitación adicional en funcionalidades

**Información a Proporcionar:**
1. **Descripción del Problema:** Qué estaba intentando hacer
2. **Mensaje de Error:** Screenshot del error si aparece
3. **Navegador y Dispositivo:** Qué está usando
4. **Pasos para Reproducir:** Cómo llegó al problema
5. **Usuario Afectado:** Su email y rol en el sistema

**Canales de Soporte:**
- **Email de Soporte:** [email configurado]
- **Teléfono:** [número configurado]
- **Chat en Vivo:** [si está disponible]
- **Portal de Tickets:** [si está implementado]

---

## CONCLUSIÓN

Este manual visual proporciona una guía completa para utilizar todas las funcionalidades del sistema TMS Grúas v2.0.0. El sistema está diseñado para ser intuitivo y eficiente, adaptándose automáticamente a diferentes dispositivos y necesidades de usuario.

**Beneficios Clave del Sistema:**
- **Digitalización Completa:** Elimina procesos en papel
- **Acceso Móvil:** Operadores pueden trabajar desde cualquier lugar
- **Automatización:** Reduce tareas manuales y errores
- **Trazabilidad:** Historial completo de todas las operaciones
- **Escalabilidad:** Crece con su negocio

**Próximos Pasos:**
1. Familiarícese con su rol específico en el sistema
2. Practique los flujos de trabajo principales
3. Configure sus preferencias personales
4. Contacte soporte para capacitación adicional si es necesario

**Recuerde:**
- El sistema se actualiza automáticamente
- Sus datos están respaldados continuamente
- La seguridad es prioritaria en todas las operaciones
- El soporte técnico está disponible para ayudarle

---

*© 2024 TMS Grúas - Sistema de Gestión de Servicios de Grúa v2.0.0*
*Manual actualizado: Enero 2024*