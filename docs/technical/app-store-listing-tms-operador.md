# Ficha App Store - TMS Operador

## Objetivo
Este documento deja preparada la ficha base de `TMS Operador` para App Store Connect, con textos sugeridos, checklist de materiales y notas para revision.

Esta guia esta pensada para la app iPhone del proyecto:

- nombre visible: `TMS Operador`
- bundle id: `cl.gruas5norte.tmsoperador`
- uso principal: operadores en terreno de Gruas 5 Norte

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

### Notas para revision
`Aplicacion de uso interno para operadores de Gruas 5 Norte. Requiere credenciales de acceso para ingresar. La app permite visualizar servicios asignados, revisar su detalle operativo y compartir ubicacion asociada a atenciones en curso.`

### Si Apple solicita acceso de prueba
Preparar y mantener:

- un usuario operador de prueba
- una cuenta con al menos un servicio asignado
- si es posible, un servicio de muestra visible al iniciar sesion

Texto sugerido si Apple pide instrucciones:

`Despues de iniciar sesion con la cuenta de prueba, la aplicacion muestra los servicios asignados al operador. Desde la pantalla principal se puede abrir el detalle del servicio y activar el uso compartido de ubicacion para pruebas operativas.`

## Privacidad y datos

### Uso esperado de datos
Para esta app, lo esperable en App Store Connect es declarar al menos:

- ubicacion precisa
- identificadores de usuario o cuenta, si el login los usa
- informacion funcional minima asociada al servicio

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

1. dashboard principal
2. ubicacion del operador
3. detalle del servicio
4. navegacion o accion operativa
5. historial o seguimiento

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
No publicar de inmediato al publico general. Mejor avanzar asi:

1. TestFlight interno
2. prueba con 2 a 5 operadores reales
3. ajustes finales
4. envio a revision de Apple
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
`1.0.0`

### Novedades de la version
`Primera version de TMS Operador para uso interno. Incluye servicios asignados, visualizacion de detalle operativo y ubicacion compartida en terreno.`

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
