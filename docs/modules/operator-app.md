# operator-app

## Resumen
Modulo de **operador** enfocado en servicios asignados, inspeccion en terreno, evidencia, PDF y cambio de estado del servicio.

La implementacion actual es mas rica que una lista simple con formulario: el dashboard opera por tabs de estado y la inspeccion se ejecuta en dos fases, con persistencia local y coordinacion de PDF, email y transicion de estados.

## Entrypoints vigentes
- Layout operador: [OperatorLayout](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/layout/OperatorLayout.tsx)
- Dashboard operador: [OperatorDashboard](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/OperatorDashboard.tsx)
- Inspeccion: [ServiceInspection](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/pages/operator/ServiceInspection.tsx)
- Componentes: [src/components/operator](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/src/components/operator)
- Pauta de prueba offline: [operator-offline-test-plan.md](file:///Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario/docs/technical/operator-offline-test-plan.md)

## Rutas
- `/operator`
- `/operator/service/:id/inspection`

## Arquitectura actual
### Dashboard
El dashboard actual organiza servicios por tabs de estado:

- `pending`
- `in_progress`
- `inspection_completed`
- `completed`

La UX visible presenta etiquetas tipo:

- Asignados
- Activos
- Por Entregar
- Completados

No todas las tarjetas navegan al formulario; las navegables dependen del estado del servicio.

### Inspeccion
El flujo real de inspeccion se compone de:

- `InspectionHeader`
- `InspectionLoadingState`
- `InspectionErrorState`
- `ServiceDetailsCard`
- `InspectionForm`
- `PDFProgress`
- componentes de secciones, fotos y firma

## Hooks y servicios clave
- `useOperatorServicesTabs`
- `useOperatorService`
- `useServiceInspection`
- `useInspectionPersistence`
- `useInspectionPDF`
- `useInspectionEmail`
- `useServiceStatusUpdate`

## Datos y persistencia principales
- `services` es la entidad central del flujo.
- La persistencia de avance del formulario usa `localStorage` en el front actual.
- El cambio de estado del servicio es parte critica del flujo.
- PDF y envio por email se coordinan desde hooks especificos.

## Flujos vigentes

### 1. Dashboard por estados
- El operador no ve una sola lista plana.
- El tablero separa servicios por estado operativo y permite refresh manual.

### 2. Inspeccion en dos fases
- fase inicial
- fase final o entrega

El paso entre fases depende del estado del servicio y del avance de inspeccion.

### 3. Transicion de estados
Flujo general documentable hoy:

- `pending`
- inspeccion inicial
- `inspection_completed`
- inspeccion final o entrega
- `completed`

### 4. Persistencia local y recuperacion
- El avance del formulario puede persistirse localmente.
- Esto ayuda a continuidad operativa durante el trabajo en terreno.

### 5. PDF y envio
- El modulo coordina generacion de PDF y envio por email como parte del cierre del flujo.

## Consideraciones de mantenimiento
- Documentar la inspeccion como flujo bifasico, no lineal simple.
- Usar hooks reales del modulo operador e inspeccion como fuente de verdad.
- Evitar afirmar persistencia en tabla `inspections` si el flujo vigente del frontend no la usa directamente.
