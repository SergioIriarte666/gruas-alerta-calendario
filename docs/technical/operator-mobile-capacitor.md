# App operador con Capacitor

## Objetivo
Convertir el portal de operador en una app móvil nativa-híbrida usando Capacitor, manteniendo el backoffice administrativo en web.

La meta de esta primera etapa es:

- reutilizar el frontend React actual
- abrir el portal operador como app móvil real
- preparar permisos y ciclo de vida móvil para ubicación, cámara, red y estado de la app
- dejar claro qué cambia entre Android e iPhone

## Decisión de producto
- **Web**: administración, reportes, cierres, facturación, configuración
- **App móvil operador**: servicios asignados, inspecciones, fotos, firma, ubicación, alertas

## Qué quedó configurado en el repo
- Dependencias base de Capacitor en `package.json`
- Configuración general en [capacitor.config.ts](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/capacitor.config.ts)
- Variante de build móvil operador:
  - `npm run build:operator-mobile`
- Scripts útiles:
  - `npm run cap:add:android`
  - `npm run cap:add:ios`
  - `npm run cap:copy`
  - `npm run cap:sync`
  - `npm run cap:open:android`
  - `npm run cap:open:ios`

## Comportamiento de la variante móvil
La variante `operator-mobile`:

- fuerza el flujo móvil hacia `/operator`
- evita navegación accidental hacia módulos administrativos
- muestra un mensaje claro si alguien entra con una cuenta no pensada para la app operador

Archivos principales:
- [src/lib/appVariant.ts](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/src/lib/appVariant.ts)
- [src/App.tsx](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/src/App.tsx)
- [src/pages/Index.tsx](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/src/pages/Index.tsx)

## Flujo recomendado de implementación

### Fase 1. Shell móvil estable
- generar build móvil con `npm run build:operator-mobile`
- agregar plataformas nativas:
  - `npm run cap:add:android`
  - `npm run cap:add:ios`
- sincronizar cambios con `npm run cap:sync`
- abrir cada proyecto nativo desde Android Studio y Xcode

### Fase 2. Operación móvil
- validar login y sesión
- validar dashboard operador
- validar inspección, fotos, firma y offline
- ajustar safe areas, teclado, splash y estado de red

### Fase 3. Ubicación
- arrancar con ubicación en primer plano durante servicio activo
- guardar puntos offline y sincronizar luego
- mostrar última ubicación en TMS admin
- decidir luego si el tracking necesita background location real

### Fase 4. Publicación
- Android interno primero
- TestFlight después
- producción cuando permisos, batería y estabilidad estén validados en terreno

## Android: guía práctica

### Lo bueno
- suele ser el mejor primer objetivo
- permisos más directos para pruebas internas
- comportamiento más flexible que iPhone para operación en terreno

### Lo que hay que preparar
- Android Studio
- SDK actualizado
- emulador y al menos un equipo real
- cuenta de Google Play si se va a publicar

### Permisos esperables
- ubicación precisa
- red
- cámara/fotos si corresponde
- si más adelante quieren tracking de fondo: `ACCESS_BACKGROUND_LOCATION`

### Ojo con Android
- Google Play revisa con cuidado el uso de ubicación en segundo plano
- Android 8+ limita la frecuencia de updates cuando la app está en background
- para tracking de fondo real hay que justificarlo como función central del producto

### Recomendación Android
- partir con Android primero
- validar flujo completo en un teléfono real de operador
- medir batería, frecuencia de reportes y reconexión

## iPhone: guía práctica

### Lo bueno
- experiencia visual y de permisos más consistente
- buena base para inspecciones, fotos, firma y uso dirigido

### Lo delicado
- iOS es más estricto con background location
- hay que configurar bien permisos y capacidades en Xcode
- el review de Apple puede cuestionar permisos “Always” si no están bien justificados

### Lo que hay que preparar
- Xcode actualizado
- cuenta Apple Developer para pruebas amplias y publicación
- iPhone real para pruebas de ubicación y cámara

### Configuración típica si luego activan tracking de fondo
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- capability de `Background Modes`
- marcar `Location updates` cuando aplique

### Recomendación iPhone
- no partir prometiendo tracking perfecto con pantalla bloqueada
- lanzar primero primer plano + sync offline
- subir a background location solo después de validar que realmente se necesita

## Recomendación de rollout
1. Android interno
2. Ajustes de UX y permisos
3. iPhone vía TestFlight
4. Piloto con 2-5 operadores reales
5. Decisión sobre tracking de fondo avanzado

## Lo que sigue técnicamente
1. Crear plataformas nativas Android/iOS
2. Ajustar iconos, splash y nombre final
3. Integrar eventos nativos de app/red
4. Implementar módulo de ubicación para operador
5. Probar ciclo real: servicio activo, app minimizada, reconexión, batería

## Decisiones pendientes
- app id final para stores
- nombre comercial final
- si la primera release tendrá solo ubicación en primer plano o también background
- si Android e iPhone salen juntos o Android primero

## Recomendación final
Para este proyecto:

- **sí** a Capacitor para la app operador
- **sí** a Android primero
- **sí** a una primera release con tracking en primer plano + offline
- **no** asumir desde el día 1 tracking continuo de fondo en iPhone sin pruebas reales
