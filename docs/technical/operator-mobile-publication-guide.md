# Guia de publicacion de la app operador movil

## Objetivo
Esta guia documenta como preparar, publicar y compartir la app movil del operador para iPhone y Android usando la implementacion actual con Capacitor.

Esta pensada para el proyecto:
- app id: `cl.gruas5norte.tmsoperador`
- nombre visible: `TMS Operador`

## Estado actual del proyecto
La app ya cuenta con:
- proyecto iOS en [ios/](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/ios)
- proyecto Android en [android/](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android)
- build movil dedicada con `npm run build:operator-mobile`
- sincronizacion nativa con `npm run cap:sync`
- icono aplicado para iPhone, Android y web
- permiso de ubicacion configurado en iOS

## Estrategia recomendada
Orden sugerido para este proyecto:

1. publicar primero en **TestFlight**
2. distribuir el APK o usar **Internal Testing** en Android
3. validar con operadores reales
4. decidir despues si se hace publicacion formal en App Store y Google Play

## Flujo general antes de publicar

### 1. Preparar la build web movil
Ejecutar:

```bash
npm run build:operator-mobile
npm run cap:sync
```

Esto deja actualizados los assets web dentro de iOS y Android.

### 2. Confirmar contenido listo
Antes de publicar conviene revisar:
- nombre de app
- icono
- permisos de ubicacion
- login operador
- dashboard operador
- compartir ubicacion
- Google Maps
- textos visibles para operador

### 3. Definir entorno
Antes de subir a usuarios reales, confirmar:
- URL backend o configuracion productiva correcta
- claves y configuracion Supabase correctas
- cuentas reales de prueba para operadores

## Publicacion en iPhone

### Camino recomendado: TestFlight
Para este proyecto, TestFlight es la mejor forma de compartir la app con operadores iPhone sin instalar manualmente desde Xcode.

### Requisitos
- cuenta activa en Apple Developer
- acceso a App Store Connect
- Xcode instalado
- proyecto iOS funcionando localmente

### Paso a paso

#### 1. Abrir el proyecto iOS
Abrir:
- [ios/App/App.xcodeproj](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/ios/App/App.xcodeproj)

#### 2. Revisar firma
En Xcode:
- seleccionar target `App`
- ir a `Signing & Capabilities`
- confirmar `Team`
- confirmar `Bundle Identifier`

Para este proyecto:
- bundle id esperado: `cl.gruas5norte.tmsoperador`

#### 3. Revisar version y build
En Xcode, pestaña `General`, definir:
- `Version`: version visible, por ejemplo `1.0.0`
- `Build`: numero interno incremental, por ejemplo `1`

Cada nueva subida a TestFlight debe aumentar al menos el `Build`.

#### 4. Seleccionar Any iOS Device
En la barra superior de Xcode, elegir un destino generico como:
- `Any iPhone Device`
- o el nombre equivalente que muestre Xcode

#### 5. Crear el archive
En Xcode:
- menu `Product`
- `Archive`

Cuando termine, se abrira el organizador de archivos.

#### 6. Subir a App Store Connect
Desde Organizer:
- seleccionar el archive
- `Distribute App`
- `App Store Connect`
- `Upload`

Aceptar las opciones por defecto si no hay un requerimiento especial.

#### 7. Configurar TestFlight
En App Store Connect:
- abrir la app
- ir a `TestFlight`
- esperar que Apple procese la build
- agregar testers internos o externos

### Compartir con operadores iPhone

#### Opcion 1. Testers internos
Sirve para pruebas rapidas con cuentas del equipo.

#### Opcion 2. Testers externos
Sirve para operadores reales fuera del equipo interno.

Flujo para el operador:
1. instalar `TestFlight` desde App Store
2. recibir invitacion por correo o link
3. instalar la app desde TestFlight

### Recomendaciones para iPhone
- partir con grupo pequeno de operadores
- validar permisos de ubicacion en terreno
- medir estabilidad y bateria antes de crecer el piloto

## Publicacion en Android

### Camino recomendado
Para este proyecto hay dos opciones razonables:

1. **APK directo** para pruebas simples
2. **Google Play Internal Testing** para una distribucion mas ordenada

Si solo hay una tablet Android o un solo operador Android, el APK suele bastar al comienzo.

### Requisitos
- Android Studio instalado
- proyecto Android sincronizado
- dispositivo o tablet real para prueba
- cuenta Google Play solo si se publicara por Play Console

### Preparar el proyecto
Abrir:
- [android/](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android)

### Opcion A. Generar APK
En Android Studio:
- `Build`
- `Generate Signed Bundle / APK`
- elegir `APK`
- crear o usar un keystore
- generar la build firmada

Resultado:
- archivo `.apk` para compartir manualmente

### Opcion B. Subir a Google Play Internal Testing
En Android Studio:
- `Build`
- `Generate Signed Bundle / APK`
- elegir `Android App Bundle`

Resultado:
- archivo `.aab`

Luego en Google Play Console:
- crear la aplicacion
- entrar a `Internal testing`
- subir el `.aab`
- invitar usuarios de prueba

### Compartir con operadores Android

#### Si es APK
El operador o encargado debe:
1. descargar el APK
2. permitir instalacion desde fuente autorizada si el equipo lo pide
3. instalar la app

#### Si es Internal Testing
El operador recibe link de prueba desde Google Play y la instala como cualquier otra app.

## Configuracion recomendada para uso real

### iPhone
Para operadores en terreno:
- ubicacion activada
- ubicacion precisa activada
- Background App Refresh activado si luego se extiende a segundo plano
- desactivar modo ahorro durante pruebas de terreno

### Android
Para operadores en terreno:
- ubicacion precisa activada
- permitir uso de ubicacion siempre si mas adelante se habilita segundo plano
- excluir la app de optimizacion de bateria cuando se requiera continuidad

## Politica de versiones recomendada

### Version visible
Usar formato:
- `1.0.0`
- `1.0.1`
- `1.1.0`

### Build interno
Incrementar en cada subida:
- `1`
- `2`
- `3`

Ejemplo:
- primera prueba TestFlight: version `1.0.0`, build `1`
- correccion menor: version `1.0.0`, build `2`
- nueva mejora funcional: version `1.1.0`, build `3`

## Checklist de salida

### Antes de compartir con usuarios
- build movil ejecutada
- `cap sync` ejecutado
- icono correcto visible
- login del operador probado
- ubicacion probada
- ultima ubicacion visible en TMS
- Google Maps probado
- cierre de sesion probado

### Antes de publicar a un grupo mas grande
- validar consumo de bateria
- validar comportamiento con mala senal
- validar reconexion
- validar permisos en dispositivos reales

## Problemas frecuentes

### iPhone no instala o no abre
Revisar:
- firma
- developer mode si es prueba local por Xcode
- confianza de certificado si es instalacion local
- que el build este realmente subido a TestFlight si ya se usa ese camino

### Icono no cambia
Revisar:
- volver a correr `npm run cap:sync`
- reinstalar la app en el dispositivo
- limpiar build en Xcode o Android Studio

### Android no instala APK
Revisar:
- firma del APK
- permisos para instalar apps
- compatibilidad de version Android del dispositivo

## Recomendacion final para este proyecto
La mejor estrategia hoy es:

1. usar **TestFlight** para operadores iPhone
2. usar **APK** o **Internal Testing** para la tablet Android
3. operar un piloto controlado con pocos usuarios
4. recoger observaciones de terreno antes de una publicacion mas amplia

## Archivos relacionados
- [docs/technical/operator-mobile-implementation.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/operator-mobile-implementation.md)
- [docs/technical/operator-mobile-capacitor.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/operator-mobile-capacitor.md)
- [capacitor.config.ts](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/capacitor.config.ts)
