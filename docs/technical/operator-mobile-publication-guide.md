# Guia de publicacion de la app operador movil

## Objetivo
Esta guia resume el flujo real de publicacion y distribucion de `TMS Operador` en iPhone y Android usando Capacitor.

Aplica a este proyecto:
- app id: `cl.gruas5norte.tmsoperador`
- nombre visible: `TMS Operador`

## Estado actual a julio 2026

### iPhone / App Store
- cuenta Apple Developer activa
- App Store Connect habilitado
- ficha de App Store completada
- politica de privacidad publicada
- capturas de iPhone cargadas
- capturas de iPad 13" cargadas
- build enviado a Apple:
  - version: `1.0.1`
  - build: `4`
  - estado: pendiente de revision por Apple

### Android / Google Play
- proyecto Android operativo
- APK debug generado para pruebas manuales
- AAB release firmado generado para Google Play
- version actual Android:
  - `versionCode = 2`
  - `versionName = "1.0.1"`
- cuenta Play Console aun pendiente de verificacion final por Google

## Archivos clave del proyecto
- proyecto iOS: [ios/App/App.xcodeproj](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/ios/App/App.xcodeproj)
- proyecto Android: [android/](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android)
- configuracion Android: [android/app/build.gradle](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build.gradle)
- permisos iPhone: [ios/App/App/Info.plist](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/ios/App/App/Info.plist)

## Preparacion comun antes de publicar

### 1. Preparar la build movil
Ejecutar:

```bash
npm run build:operator-mobile
npm run cap:sync
```

Para Android:

```bash
npm run sync:android
```

Para iPhone:

```bash
npm run sync:ios
```

### 2. Confirmar flujo funcional
Antes de publicar o subir una nueva build conviene validar:
- login del operador
- lectura de servicios asignados
- compartir ubicacion
- visibilidad de la ubicacion en TMS
- captura de fotografias y evidencias
- apertura de Google Maps
- cierre de sesion

### 3. Confirmar version
Revisar:
- Android en [android/app/build.gradle](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build.gradle)
- iPhone desde Xcode en `General > Identity`

Regla practica:
- `versionName` / `Version` cambia cuando quieres mostrar una nueva version al usuario
- `versionCode` / `Build` debe subir en cada carga nueva

## Publicacion en iPhone

### Estado actual
La build rechazada fue:
- version `1.0.1`
- build `4`

La correccion preparada para reenvio es:
- version `1.0.1`
- build `5`
- bundle iOS sincronizado con la variante `operator-mobile`
- inicio de sesion Google ausente en la variante iOS
- `UIBackgroundModes` limitado a `location`
- eliminacion de cuenta disponible tambien mientras la cuenta esta pendiente

### Bundle identifier oficial
`cl.gruas5norte.tmsoperador`

### Flujo recomendado para nuevas builds

#### 1. Abrir el proyecto iOS
Abrir:
- [ios/App/App.xcodeproj](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/ios/App/App.xcodeproj)

#### 2. Revisar firma
En Xcode:
- seleccionar target `App`
- ir a `Signing & Capabilities`
- confirmar `Team`
- confirmar `Bundle Identifier`

#### 3. Revisar version y build
En Xcode, pestaña `General`:
- `Version`: por ejemplo `1.0.1`
- `Build`: incrementar siempre, por ejemplo `5`

#### 4. Crear el archive
- menu `Product`
- `Archive`

#### 5. Subir a App Store Connect
Desde Organizer:
- seleccionar el archive
- `Distribute App`
- `App Store Connect`
- `Upload`

#### 6. Esperar procesamiento
La build puede quedar:
- `Processing`
- luego `Ready to Submit` o equivalente en TestFlight / Distribution

### Ajustes importantes aprendidos en esta implementacion

#### Privacidad de fotos en iPhone
Fue necesario declarar en `Info.plist`:
- `NSPhotoLibraryUsageDescription`
- `NSPhotoLibraryAddUsageDescription`

Esto ya quedo resuelto en:
- [ios/App/App/Info.plist](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/ios/App/App/Info.plist)

#### App Privacy en App Store Connect
Se declaro recoleccion de estos tipos de datos:
- direccion de correo electronico
- ubicacion exacta
- fotos o videos
- otro contenido del usuario
- ID de usuario

Uso recomendado para todos:
- solo `Funcionalidad de la app`
- no tracking
- no publicidad

#### Capturas iPad 13"
Apple exigio capturas de iPad de 13" para poder completar el envio.
Se generaron versiones adaptadas en:
- [/Users/sergioiriartevasquez/Desktop/appstore-ipad-13in](</Users/sergioiriartevasquez/Desktop/appstore-ipad-13in>)

### Estado antes de reenviar la build 6

Completados:

- prueba en un iPhone fisico de los permisos y el rastreo de ubicación
- grabación de la ubicación persistente con la app en segundo plano
- grabación del flujo completo de eliminación de cuenta
- build `1.0.1 (6)` firmada, instalada y probada en un iPhone físico

Pendientes en App Store Connect:

- generar `Product > Archive`, validar y subir la build 6
- pegar en App Review las notas y enlaces preparados en `app-store-listing-tms-operador.md`

También confirmados:

- la ficha laboral, nombre y RUT deben conservarse después de eliminar las credenciales
- cuenta de revisión: `apple.review.operator@gruas5norte.cl`
- operador vinculado: `Apple Review Operador`
- servicio de muestra asignado: `SRV-6820`

## Publicacion en Android

### Estado actual
Ya existen dos salidas utiles:

#### APK de pruebas
Usado para instalar manualmente en tablets o telefonos Android.

Ruta habitual:
- [android/app/build/outputs/apk/debug/app-debug.apk](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build/outputs/apk/debug/app-debug.apk)

#### AAB firmado para Google Play
Usado para Play Console.

Ruta habitual:
- [android/app/build/outputs/bundle/release/app-release.aab](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build/outputs/bundle/release/app-release.aab)

### Version Android actual
En [android/app/build.gradle](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build.gradle):
- `applicationId = "cl.gruas5norte.tmsoperador"`
- `versionCode = 2`
- `versionName = "1.0.1"`

### Permisos relevantes en Android
La app usa:
- camara
- ubicacion precisa
- servicio en primer plano de ubicacion
- notificaciones para el servicio de ubicacion

No se detecto `ACCESS_BACKGROUND_LOCATION` en el proyecto actual.

### Como generar APK de prueba
En Android Studio:
- `Build`
- `Build Bundle(s) / APK(s)`
- `Build APK(s)`

### Como generar AAB firmado
En Android Studio:
- `Build`
- `Generate Signed App Bundle / APK`
- elegir `Android App Bundle`
- crear o usar keystore
- seleccionar variante `release`
- `Create`

### Keystore
Guardar fuera del repo:
- archivo `.jks`
- password del keystore
- alias
- password del alias

Sin eso, luego se complica publicar actualizaciones futuras.

### Estado Play Console
Actualmente la cuenta esta en proceso de verificacion por Google.
Mientras eso no termine:
- puedes generar APK y AAB
- no puedes completar la publicacion en Play Console

## Estrategia recomendada hoy

### iPhone
Seguir asi:
1. archivar, validar y subir la build `1.0.1 (6)`
2. incorporar las credenciales y los enlaces de evidencia en App Review Information
3. reenviar a revisión y responder cualquier observación de Apple

### Android
Seguir asi:
1. usar `app-debug.apk` para pruebas manuales
2. conservar `app-release.aab` listo para Play Console
3. esperar verificacion de Google
4. al habilitarse la cuenta, completar ficha y subir el AAB

## Checklist rapido de salida

### iPhone
- build `1.0.1 (6)` seleccionada en App Store Connect
- ficha completada
- privacidad publicada
- screenshots iPhone e iPad cargados
- notas de revision con cuenta de prueba
- videos fisicos de ubicacion y eliminacion accesibles para Apple

### Android
- APK debug probado en equipo real
- AAB release generado
- keystore respaldado
- version Android confirmada
- Play Console pendiente solo de habilitacion de cuenta

## Archivos relacionados
- [docs/technical/app-store-listing-tms-operador.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/app-store-listing-tms-operador.md)
- [docs/technical/install-android-apk.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/install-android-apk.md)
- [docs/technical/operator-mobile-ota-updates.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/operator-mobile-ota-updates.md)
