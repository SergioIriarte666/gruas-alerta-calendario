# Ficha App Store - TMS Operador

## Objetivo
Este documento deja preparada la ficha base de `TMS Operador` para App Store Connect, con textos sugeridos, checklist de materiales y notas para revision.

Esta guia esta pensada para la app iPhone del proyecto:

- nombre visible: `TMS Operador`
- bundle id: `cl.gruas5norte.tmsoperador`
- uso principal: operadores en terreno de Gruas 5 Norte

## Estado actual
Al cierre de esta guia:
- App Store Connect ya esta habilitado
- la politica de privacidad ya fue publicada
- la app ya fue enviada a Apple con:
  - version `1.0.1`
  - build `4`
  - estado: pendiente de revision

## Estado recomendado antes de enviar a revision
Antes de pasar desde TestFlight a publicacion formal, conviene tener validado al menos lo siguiente:

- login operador funcionando en iPhone real
- permisos de ubicacion funcionando
- compartir ubicacion estable durante una jornada real
- visibilidad de ubicacion y ruta en el panel administrativo
- navegacion a Google Maps funcionando
- textos, icono y pantallas finales estables

## Datos base de la app

### Nombre de la app
`TMS Operador`

### Subtitulo sugerido
`Operacion y ubicacion en terreno`

Alternativas validas:

- `Gestion operativa para operadores`
- `Servicios y ubicacion en ruta`
- `Coordinacion operativa en terreno`

### Categoria principal sugerida
`Negocios`

### Categoria secundaria sugerida
`Productividad`

### SKU sugerido
`tms-operador-ios-001`

Si mas adelante suben otra app distinta para supervisores o clientes, conviene mantener SKUs separados.

## Texto listo para App Store Connect

### Texto promocional
`Gestion operativa y ubicacion en tiempo real para operadores de Gruas 5 Norte.`

### Descripcion larga sugerida
`TMS Operador es la aplicacion movil de uso interno para los operadores de Gruas 5 Norte.

Permite consultar servicios asignados, revisar el detalle operativo de cada atencion y compartir la ubicacion del operador en terreno para mejorar la coordinacion con la central.

La app ayuda a mantener visibilidad operativa sobre rutas, estados de servicio, tiempos de atencion y ubicacion reportada, facilitando el seguimiento diario de las operaciones.

Funciones principales:
- consulta de servicios asignados
- visualizacion de detalle del servicio
- compartir ubicacion asociada al servicio en curso
- acceso rapido a navegacion con Google Maps
- seguimiento operativo desde plataforma administrativa

TMS Operador esta orientada exclusivamente al equipo interno autorizado de Gruas 5 Norte y requiere credenciales de acceso vigentes.`

### Descripcion corta alternativa
`App interna para operadores de Gruas 5 Norte con servicios asignados y ubicacion en terreno.`

### Palabras clave sugeridas
`tms,operador,gruas,asistencia,servicios,ubicacion,logistica,terreno,ruta`

Nota:
- Apple limita el campo de keywords, asi que si falta espacio se puede usar:
  `tms,operador,gruas,servicios,ubicacion,logistica,terreno`

## Mensaje para App Review

### Notas para revision de la build 1.0.1 (5)

Texto sugerido para pegar en `App Review Information > Notes`:

`Aplicación de uso interno para operadores autorizados de Grúas 5 Norte. La build iOS no ofrece ni utiliza inicio de sesión de Google ni otro proveedor social: el acceso se realiza exclusivamente con correo y contraseña administrados por la empresa, por lo que Guideline 4.8 no resulta aplicable a esta build.`

`La ubicación persistente es una función esencial y visible. Un operador inicia su jornada o un servicio activo y habilita el uso compartido desde la pantalla principal. La posición se actualiza en segundo plano para que el centro de operaciones pueda coordinar el servicio mientras el operador usa navegación u otra aplicación. El operador puede detener el seguimiento desde la misma pantalla. Se adjunta una grabación realizada en un dispositivo físico que muestra la activación, el paso de la app a segundo plano, la actualización en la plataforma administrativa y la detención.`

`La app no utiliza Bluetooth Low Energy. Se eliminó bluetooth-peripheral de UIBackgroundModes; el único modo declarado es location.`

`La eliminación definitiva está disponible dentro de la app en Perfil > Eliminar mi cuenta. También está disponible para una cuenta que todavía espera aprobación. El usuario confirma escribiendo ELIMINAR; se borran inmediatamente la identidad de acceso, sesiones, preferencias, avatar e historial personal. Los registros operativos de la empresa que deban conservarse quedan desvinculados de las credenciales y del perfil identificable. Se adjunta una grabación en dispositivo físico del flujo completo.`

Antes de enviar, reemplazar en App Store Connect los campos de acceso de demostración con una cuenta de operador vigente y restringida a datos de muestra.

### Si Apple solicita acceso de prueba
Preparar y mantener:

- un usuario operador de prueba
- una cuenta con al menos un servicio asignado
- si es posible, un servicio de muestra visible al iniciar sesion

Texto sugerido si Apple pide instrucciones:

`Después de iniciar sesión con la cuenta de prueba, la aplicación muestra los servicios asignados al operador. Desde la pantalla principal se puede abrir el detalle del servicio y activar el uso compartido de ubicación. La eliminación de cuenta se encuentra en Perfil > Eliminar mi cuenta.`

### Grabaciones obligatorias para este reenvío

Grabar en un iPhone físico, sin mostrar datos reales de clientes:

1. `ubicacion-segundo-plano.mov`: iniciar sesión, abrir un servicio de muestra, activar ubicación, enviar la app a segundo plano, demostrar que la posición continúa actualizándose en el panel administrativo y detener el seguimiento.
2. `eliminacion-cuenta.mov`: crear o iniciar sesión con una cuenta QA, ir a Perfil, abrir `Eliminar mi cuenta`, escribir `ELIMINAR`, confirmar y demostrar que el siguiente inicio de sesión falla.

Subir ambos videos a una URL accesible para Apple y pegar los enlaces en `App Review Information > Notes`.

### Retención de registros operativos

La cuenta Auth y el perfil identificable se eliminan de inmediato. La ficha laboral y los registros de servicios se desvinculan de la cuenta porque pueden formar parte de los antecedentes operacionales de la empresa. Antes del reenvío, el responsable legal debe confirmar qué campos de la ficha laboral (por ejemplo, nombre o RUT) deben conservarse y por cuánto tiempo; si no existe una obligación aplicable, deben anonimizarse también.

## Privacidad y datos

### Uso esperado de datos
Para esta app, en App Store Connect ya se trabajo sobre esta base:

- direccion de correo electronico
- ubicacion exacta
- fotos o videos
- otro contenido del usuario
- ID de usuario

Para todos ellos, el uso recomendado es:
- `Funcionalidad de la app`
- sin tracking
- sin publicidad

### Motivo del uso de ubicacion
Texto sugerido:

`La ubicacion del operador se utiliza para compartir posicion en terreno asociada a servicios activos y mejorar la coordinacion operativa.`

### Recomendacion
Completar la seccion de privacidad mirando el comportamiento real de la app. Si solo se usa ubicacion para la operacion interna y no para marketing, no marcar usos promocionales.

## Capturas recomendadas

### Capturas minimas sugeridas para iPhone
Subir pantallas reales y limpias, idealmente desde un iPhone moderno:

1. inicio de sesion
2. dashboard principal del operador
3. tarjeta de ubicacion compartida activa
4. listado o detalle de servicio asignado
5. historial o vista operativa relevante

### Criterios para las capturas

- usar datos limpios y presentables
- evitar informacion sensible real de clientes si no es necesaria
- mostrar la interfaz ya final, no pantallas incompletas
- preferir capturas con buen contraste y textos legibles

### Orden recomendado de capturas

1. login
2. dashboard principal
3. ubicacion del operador
4. detalle del servicio
5. historial o seguimiento

### Capturas iPad 13"
Apple exigio tambien capturas de iPad de 13".
Se generaron versiones adaptadas en:
- [/Users/sergioiriartevasquez/Desktop/appstore-ipad-13in](</Users/sergioiriartevasquez/Desktop/appstore-ipad-13in>)

## Checklist para completar la ficha

### En App Store Connect

- nombre de la app
- subtitulo
- categoria principal
- categoria secundaria
- descripcion
- keywords
- texto promocional
- URL de soporte
- URL de marketing, si aplica
- informacion de privacidad
- capturas de pantalla
- build seleccionado para distribucion

### Contacto de soporte
Si aun no tienen pagina dedicada, al menos dejar:

- correo de soporte operativo
- telefono de contacto si quieren incluirlo
- URL simple, aunque sea una pagina institucional

Ejemplo:

- soporte: `soporte@gruas5norte.cl`
- sitio: `https://gruas5norte.cl`

## Seccion de soporte

### URL de soporte
Idealmente una pagina simple con:

- nombre de la app
- correo de contacto
- horario de soporte
- breve explicacion de que es una app de uso interno

### Texto sugerido para soporte
`Soporte para usuarios internos de TMS Operador. Para ayuda con acceso, servicios asignados o uso de la aplicacion, contacta al equipo de Gruas 5 Norte.`

## Estrategia recomendada de publicacion

### Opcion recomendada para este proyecto
El primer envio formal ya fue realizado. Para las siguientes iteraciones, mantener este orden:

1. probar cambios por TestFlight cuando aplique
2. validar con operadores reales
3. subir nueva build si el cambio es nativo o requiere nueva revision
4. enviar a revision de Apple
5. decidir si la publicacion sera:
   - privada para uso controlado
   - o publica en App Store

### Cuando conviene publicar
Conviene publicar cuando:

- la ubicacion en terreno ya este validada
- el flujo de login este estable
- ya exista una forma clara de soporte a operadores
- haya un criterio definido para altas y bajas de usuarios

## Texto sugerido para metadata final

### Version actual
`1.0.1`

### Novedades de la version
`Version operativa de TMS Operador para uso interno. Incluye servicios asignados, visualizacion de detalle operativo, captura de evidencias y ubicacion compartida en terreno.`

## Preguntas practicas

### Hay que esperar testers antes de publicar
No es obligatorio, pero si altamente recomendable.

Para este proyecto, lo sano es esperar al menos:

- una prueba real en ruta
- una validacion de bateria y estabilidad
- una confirmacion de que la ubicacion aparece en el panel admin

### TestFlight publica la app
No. TestFlight solo sirve para pruebas.

### Se puede dejar la ficha lista ahora
Si. Se puede dejar casi todo completo aunque la app aun siga en pruebas.

## Siguiente paso recomendado
Una vez completada la ficha:

1. seguir probando por TestFlight
2. reunir feedback corto de operadores
3. preparar capturas definitivas
4. enviar la version seleccionada a revision cuando el equipo la considere estable
