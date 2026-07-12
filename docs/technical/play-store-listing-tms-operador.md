# Ficha Play Store - TMS Operador

## Objetivo
Esta guia deja preparada la ficha base de `TMS Operador` para Google Play Console, con textos sugeridos, datos reales del proyecto y el checklist para subir el `AAB` cuando Google habilite completamente la cuenta.

## Datos base de la app
- nombre visible: `TMS Operador`
- package name: `cl.gruas5norte.tmsoperador`
- uso principal: app interna para operadores de Gruas 5 Norte
- version Android actual:
  - `versionCode = 2`
  - `versionName = "1.0.1"`

Archivo fuente:
- [android/app/build.gradle](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build.gradle)

## Estado actual
- cuenta Google Play Console creada
- verificacion de identidad de Google aun en proceso
- APK debug generado para pruebas
- AAB release firmado generado

## Archivo listo para Google Play
Ruta habitual del bundle:
- [android/app/build/outputs/bundle/release/app-release.aab](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build/outputs/bundle/release/app-release.aab)

## Textos sugeridos para Play Store

### Nombre de la app
`TMS Operador`

### Descripcion corta
`App interna para operadores con servicios asignados, ubicacion operativa y evidencias en terreno.`

### Descripcion completa
`TMS Operador es la aplicacion movil de uso interno para el equipo operativo de Gruas 5 Norte.

Permite consultar servicios asignados, revisar el detalle operativo de cada atencion y compartir la ubicacion del operador en terreno para mejorar la coordinacion con la central.

La app tambien facilita el registro de evidencias operativas, el seguimiento de estados del servicio y el acceso rapido a navegacion segun el destino asociado.

Funciones principales:
- consulta de servicios asignados
- detalle operativo del servicio
- compartir ubicacion del operador
- captura de fotografias y evidencias
- acceso rapido a navegacion
- historial operativo del operador

TMS Operador esta orientada exclusivamente a usuarios internos autorizados y requiere credenciales vigentes para ingresar.`

### Categoria sugerida
`Business`

## Datos de contacto sugeridos

### Correo de contacto
Usar el correo operativo o de soporte real del proyecto.

### Politica de privacidad
[https://www.gruas5norte.cl/privacidad-tms-operador](https://www.gruas5norte.cl/privacidad-tms-operador)

## Capturas sugeridas para Play Store
La logica recomendada es similar a App Store:
1. login
2. dashboard principal
3. ubicacion del operador activa
4. detalle o servicio asignado
5. historial o vista operativa final

Usar capturas limpias, con datos de prueba y buen contraste.

## Seguridad de los datos
Google Play pedira completar `Data safety`. Para esta app, la base recomendada hoy es declarar:

### Datos recopilados
- ubicacion precisa
- direccion de correo electronico
- fotos o videos
- identificadores de usuario
- otro contenido del usuario si se guardan observaciones o evidencias asociadas al servicio

### Uso de los datos
Marcar solo:
- funcionalidad de la app

No marcar:
- publicidad
- tracking
- personalizacion
- marketing

### Cifrado en transito
Marcar:
- `Yes`

### Eliminacion de datos
Responder segun el proceso real del sistema. Si existe mecanismo de baja o eliminacion controlada, declararlo en Play Console.

## Permisos relevantes para la ficha Android
La app usa estos elementos que Google puede revisar con atencion:
- camara
- ubicacion precisa
- servicio en primer plano de ubicacion
- notificacion visible del servicio

No se detecto `ACCESS_BACKGROUND_LOCATION` en la implementacion actual.

## Estrategia recomendada de salida

### Etapa 1. Prueba manual
Instalar el APK debug en tablet o telefono Android y validar:
- login
- servicios asignados
- ubicacion compartida
- captura de evidencias
- navegacion

### Etapa 2. Bundle listo
Mantener el `AAB` firmado listo para subir.

### Etapa 3. Play Console habilitado
Cuando Google complete la verificacion:
1. crear la app
2. completar ficha
3. completar `Data safety`
4. subir el `AAB`
5. partir por `Internal testing`

## Publicacion recomendada en Play
No ir directo a produccion.
Primero:
1. `Internal testing`
2. validar con pocos equipos reales
3. revisar bateria y estabilidad
4. luego decidir si pasa a produccion

## Checklist Play Store
- cuenta verificada por Google
- `app-release.aab` disponible
- keystore respaldado
- textos de ficha listos
- capturas listas
- politica de privacidad publicada
- respuestas de `Data safety` completas

## Nota operativa importante
Guardar fuera del repo:
- archivo `.jks`
- password del keystore
- alias
- password del alias

Sin eso no conviene avanzar a publicacion formal.
