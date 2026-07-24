# Rediseño del Portal de Clientes

Prototipos de dirección visual preparados sobre los flujos que ya existen:
resumen, servicios, órdenes de compra, solicitud de servicio, facturas,
seguimiento, notificaciones y cuenta de usuario.

Los prototipos usan datos demostrativos y no modifican todavía el portal
productivo ni su conexión con Supabase.

## Alternativa A · Centro de control

Una cabina operacional para clientes frecuentes. Destaca el servicio activo,
las tareas que bloquean facturación y las acciones que deben resolverse hoy.

- Mejor para usuarios de operaciones y logística.
- Lectura rápida en escritorio.
- Sidebar persistente y buscador global.
- Alta visibilidad para O.C. pendientes, facturas vencidas y seguimiento.

## Alternativa B · Cuenta ejecutiva

Una experiencia editorial y financiera, con menos elementos visuales y más
énfasis en posición de cuenta, documentos y reportabilidad.

- Mejor para administración, finanzas y gerencias.
- Jerarquía sobria y documental.
- Tablas más protagonistas.
- El seguimiento sigue disponible, pero no domina la pantalla.

## Alternativa C · Ruta de servicio

Una experiencia guiada y cercana que convierte el avance del servicio en el
centro del portal.

- Mejor para adopción móvil y usuarios ocasionales.
- Línea de tiempo comprensible sin capacitación.
- Acción principal muy visible.
- Comunicación más amable, con menos densidad de datos.

## Recomendación

Usar la alternativa A como arquitectura base e incorporar la línea de tiempo
de la alternativa C para el detalle del servicio. Esa combinación responde
mejor al uso corporativo recurrente sin perder claridad en móvil.

## Alcance de implementación después de la selección

1. Crear el nuevo `PortalLayout`, navegación responsive y selector
   claro/oscuro/sistema reutilizando el proveedor de tema actual.
2. Rediseñar el dashboard con datos reales y estados de carga/error/vacío.
3. Aplicar el sistema a Servicios, O.C., Solicitar servicio y Facturas.
4. Verificar contraste, teclado, lectores de pantalla y reducción de
   movimiento.
5. Validar escritorio, tablet y móvil, manteniendo los contratos visuales y
   las pruebas funcionales existentes.
