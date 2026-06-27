# Pauta de prueba offline - Portal Operador

## Objetivo
Validar que el flujo operativo en terreno del portal operador siga funcionando aunque se corte la conectividad, priorizando:

- acceso a la app ya abierta
- visualizacion de servicios ya cargados
- continuidad de la inspeccion
- guardado local de evidencia y firma
- encolado del envio final
- sincronizacion posterior al volver la conexion

## Alcance de esta pauta
Esta pauta cubre solo el trabajo de terreno del operador.

Queda fuera por ahora:

- modulos administrativos de escritorio
- pruebas de escritorio financiero
- validaciones de portal cliente

## Importante antes de probar
Hay dos tipos de prueba distintas:

### 1. Prueba funcional en Mac
Sirve para validar que la app:

- guarda avances localmente
- deja continuar la inspeccion
- encola el envio offline
- sincroniza cuando vuelve la conexion

### 2. Prueba real de terreno en iPhone
Sirve para validar que la app:

- vuelve a abrir sin Internet
- carga desde cache/PWA
- no depende de que el operador recuerde si hay señal

Si la prueba en iPhone se hace entrando a una URL LAN como `http://192.168.x.x:8080`, al cortar conectividad Safari puede fallar antes de que la app tenga opcion de responder. Esa prueba no confirma por si sola si el flujo offline interno esta bien o mal.

## Precondiciones

### Datos
- Tener un usuario operador activo.
- Tener al menos 1 servicio asignado al operador.
- Idealmente usar un servicio de prueba dedicado.

### Navegador / app
- Abrir el portal operador online una vez.
- Esperar que cargue dashboard y detalle del servicio.
- Entrar al servicio de prueba antes de cortar conectividad.

### Evidencia sugerida
- 2 o 3 fotos de prueba.
- una firma de prueba.
- observaciones breves para fase inicial y fase final.

## Escenario A - Validacion base en Mac

### Paso 1. Preparacion online
1. Ingresar al portal operador con Internet.
2. Confirmar que el dashboard carga servicios asignados.
3. Abrir el servicio de prueba.
4. Confirmar que el formulario de inspeccion abre sin errores.

Resultado esperado:

- se ve el servicio
- el formulario abre
- no hay mensajes de error

### Paso 2. Guardado local de avance
1. Completar algunos campos de la inspeccion.
2. Agregar al menos 1 foto.
3. Registrar firma si el flujo ya la permite en esa etapa.
4. Volver atras o refrescar la vista.

Resultado esperado:

- el avance vuelve a aparecer
- fotos y datos no se pierden

### Paso 3. Corte de conectividad
1. Con el servicio ya abierto, cortar la conectividad del Mac.
2. Permanecer dentro del portal operador.
3. Seguir completando la inspeccion.

Resultado esperado:

- la app sigue abierta
- el formulario sigue usable
- se pueden seguir agregando datos locales

### Paso 4. Cierre offline de la inspeccion
1. Intentar enviar la inspeccion sin conexion.
2. Revisar el mensaje de confirmacion.
3. Volver al dashboard operador.

Resultado esperado:

- la app no debe perder la informacion
- el envio debe quedar en espera local
- debe verse algun indicador de pendiente de sincronizacion

### Paso 5. Recuperacion despues de cerrar vista
1. Sin volver Internet, refrescar la app si el navegador lo permite.
2. Reingresar al flujo ya abierto.
3. Confirmar que el servicio y/o el estado local siguen disponibles.

Resultado esperado:

- la app conserva el avance local
- el servicio no desaparece del flujo operativo probado

Nota:
En Mac esta prueba sirve para validar persistencia local y encolado. La reapertura total offline puede variar segun navegador y forma de acceso.

### Paso 6. Vuelta online y sincronizacion
1. Restablecer la conectividad.
2. Esperar unos segundos en dashboard o en el servicio.
3. Refrescar si fuera necesario.
4. Verificar que la inspeccion pendiente se sincroniza.

Resultado esperado:

- desaparece el pendiente local
- el servicio cambia al estado esperado
- no se generan duplicados

## Escenario B - Validacion real en iPhone

### Objetivo
Validar la experiencia que importa en terreno:

- abrir la app sin depender de recordar si hay señal
- continuar una inspeccion ya preparada
- cerrar el trabajo y sincronizar luego

### Recomendacion de prueba correcta
1. Abrir la app online.
2. Dejar cargado el dashboard operador.
3. Abrir al menos un servicio.
4. Instalarla como app si el entorno lo permite.
5. Luego recien cortar conectividad.

### Lo que debemos observar
- si la app abre desde cache
- si muestra servicios ya descargados
- si deja entrar al servicio sin backend disponible
- si deja terminar la inspeccion
- si conserva cola pendiente al cerrar y reabrir

### Señal de alerta critica
Si al cerrar la pestana y reabrir sin Internet Safari muestra directamente que no puede abrir la pagina, el problema puede estar en la forma de acceso y no necesariamente en el flujo interno de inspeccion.

## Casos que deben quedar en verde

### Criticos
- abrir dashboard operador despues de haberlo usado online
- abrir un servicio ya consultado
- completar inspeccion inicial offline
- completar inspeccion final offline
- guardar fotos offline
- guardar firma offline
- dejar envio en cola offline
- sincronizar sin duplicar al volver online

### Deseables
- indicador visible de pendientes offline
- mensaje claro cuando algo quedo en espera de sincronizacion
- recuperacion automatica tras recargar

## Registro de hallazgos
Usar este formato por cada prueba:

| Campo | Detalle |
|---|---|
| Fecha/hora |  |
| Dispositivo |  |
| Navegador o app |  |
| Escenario |  |
| Paso exacto |  |
| Resultado observado |  |
| Resultado esperado |  |
| Captura |  |
| Severidad |  |

## Criterio de aprobacion para seguir
Podemos considerar el flujo operador "listo para prueba ampliada" cuando:

- el operador puede abrir lo ya preparado sin depender de backend en vivo
- la inspeccion no pierde datos aunque se corte la conexion
- el envio final queda en cola en vez de fallar
- la sincronizacion posterior cierra el ciclo sin duplicados

## Resultado validado
Fecha de validacion manual: 27 de junio de 2026.

Resultado observado en prueba real del flujo operador:

- el portal operador pudo abrirse despues de precarga online
- la inspeccion inicial pudo completarse sin conexion
- fotos, firmas y formulario quedaron guardados localmente
- la inspeccion quedo en cola pendiente de sincronizacion
- al volver la conexion, la sincronizacion se completo
- luego fue posible recuperar el formulario y continuar el flujo

Decision operativa vigente:

- la inspeccion inicial offline para trabajo en terreno queda validada
- la entrega puede depender de conectividad urbana una vez sincronizada la inspeccion inicial
- no se exige soporte completo para modulos administrativos offline en esta etapa

## Siguiente decision recomendada
Si la prueba Mac sale bien pero iPhone sigue fallando al reabrir sin Internet, el siguiente paso no es tocar mas el formulario: es preparar un entorno de prueba PWA real para movil y validar reapertura offline desde un origen estable.
