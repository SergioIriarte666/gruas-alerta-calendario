# Instalar la app en otros iPhone desde Xcode

## Objetivo
Esta guia explica como instalar la app operador en otros iPhone usando el Mac y Xcode, mientras TestFlight aun no esta habilitado.

## Cuando usar esta guia
Usar este flujo cuando:
- la membresia Apple Developer aun no permite usar App Store Connect o TestFlight
- necesitas probar la app en otros iPhone de operadores
- quieres instalar una build manualmente desde tu Mac

## Requisitos
- Mac con Xcode instalado
- proyecto iOS disponible en:
  - [ios/App/App.xcodeproj](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/ios/App/App.xcodeproj)
- iPhone fisico
- cable para conectar el iPhone al Mac
- cuenta Apple Developer configurada en Xcode

## Flujo paso a paso

### 1. Conectar el iPhone
- conectar el iPhone al Mac por cable
- esperar a que el telefono sea detectado

### 2. Confiar en el computador
En el iPhone:
- tocar `Confiar en este computador` si aparece el mensaje
- ingresar el codigo del telefono

## 3. Abrir el proyecto en Xcode
Abrir:
- [ios/App/App.xcodeproj](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/ios/App/App.xcodeproj)

### 4. Seleccionar el iPhone
En la barra superior de Xcode:
- abrir el selector de destino
- elegir el iPhone conectado

Esperar unos segundos a que Xcode lo prepare.

## Primera vez en ese iPhone

### 5. Activar Developer Mode
Si es la primera instalacion en ese iPhone:
- ir en el telefono a `Configuracion > Privacidad y seguridad > Modo Desarrollador`
- activar `Modo Desarrollador`
- aceptar el reinicio del telefono

Despues del reinicio:
- desbloquear el iPhone
- confirmar nuevamente el modo desarrollador si lo pide

### 6. Reconectar si hace falta
Si Xcode pierde el equipo:
- desconectar y volver a conectar el iPhone
- verificar de nuevo el selector de destino en Xcode

## Instalar la app

### 7. Ejecutar la build
En Xcode:
- presionar el boton `Play`

Xcode compilara e instalara la app en el iPhone.

## Si aparece error de desarrollador no confiable

### 8. Confiar en el certificado
En el iPhone:
- ir a `Configuracion > General > VPN y gestion de dispositivos`
- abrir el certificado del desarrollador
- tocar `Confiar`

Despues:
- volver a abrir la app

## Permisos dentro de la app

### 9. Iniciar sesion
- abrir la app
- iniciar sesion con la cuenta del operador

### 10. Permitir ubicacion
Cuando la app lo solicite:
- permitir ubicacion
- activar ubicacion precisa si aparece la opcion

## Que se repite por cada iPhone nuevo
Para cada nuevo dispositivo normalmente tendras que repetir:
- conectar al Mac
- confiar en el computador
- activar Developer Mode
- confiar en el certificado
- instalar desde Xcode

## Importante
Mientras no uses TestFlight:
- cada iPhone nuevo necesita instalacion manual desde tu Mac
- si cambias la build, probablemente debas reinstalarla desde Xcode

## Cuando ya no sera necesario este flujo
Cuando App Store Connect y TestFlight esten activos:
- ya no necesitarias cable
- ya no necesitarias instalar uno por uno desde Xcode
- podras invitar operadores por TestFlight

## Recomendacion practica
Para pruebas con varios iPhone antes de TestFlight:
1. instalar primero en un equipo piloto
2. validar login, permisos y GPS
3. repetir el flujo solo con los equipos estrictamente necesarios

## Archivos relacionados
- [docs/technical/operator-mobile-publication-guide.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/operator-mobile-publication-guide.md)
- [docs/technical/operator-mobile-implementation.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/operator-mobile-implementation.md)
