# Instalar APK de prueba en otros Android

## Objetivo
Esta guia explica como instalar la app operador en otros equipos Android usando el APK de prueba generado desde el proyecto.

## APK generado
Archivo actual:
- [app-debug.apk](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build/outputs/apk/debug/app-debug.apk)

Ruta:
- `android/app/build/outputs/apk/debug/app-debug.apk`

## Cuando usar esta guia
Usar este flujo cuando:
- quieres instalar la app en otra tablet o telefono Android
- no quieres depender de Android Studio para cada instalacion
- aun estas en etapa de pruebas internas

## Importante
Este APK es de tipo **debug**:
- sirve bien para pruebas internas
- no es la build final para Google Play
- puede requerir permitir instalacion manual en el equipo Android

## Opciones para pasar el APK al equipo

### Opcion 1. Por cable USB
- conectar el equipo Android al Mac
- copiar el archivo APK al almacenamiento del dispositivo

### Opcion 2. Por WhatsApp, Drive o correo
- subir el APK a un medio de transferencia
- abrirlo desde el equipo Android

### Opcion 3. Por AirDroid, Telegram o nube
- cualquier metodo sirve mientras el equipo Android pueda descargar el archivo

## Instalacion paso a paso en Android

### 1. Tener el APK en el equipo
El operador o encargado debe abrir el archivo:
- `app-debug.apk`

### 2. Permitir instalacion
Android puede mostrar un mensaje como:
- `Por seguridad, tu telefono no puede instalar aplicaciones desconocidas`

En ese caso:
- tocar `Configuracion`
- permitir instalar apps desde esa fuente

Dependiendo del equipo, puede ser:
- navegador
- gestor de archivos
- WhatsApp
- Google Drive

### 3. Instalar la app
- tocar el APK
- elegir `Instalar`
- esperar a que termine

### 4. Abrir la app
- tocar `Abrir`
- iniciar sesion con cuenta de operador

### 5. Permitir ubicacion
Cuando la app lo solicite:
- permitir ubicacion
- activar ubicacion precisa si el equipo la ofrece

## Que validar despues de instalar
- icono correcto
- login correcto
- dashboard operador
- permiso de ubicacion
- compartir ubicacion
- apertura de Google Maps

## Si Android bloquea la instalacion
Revisar:
- que el archivo se haya descargado completo
- que se haya permitido instalar desde esa fuente
- que no exista una version incompatible ya instalada

## Si ya habia una version previa
Puede pasar que:
- Android pida desinstalar la version anterior
- o simplemente instale encima

Si da conflicto:
1. desinstalar la app anterior
2. volver a instalar el APK

## Actualizar a una nueva build
Cada vez que generes un nuevo APK:
1. reemplazar el archivo compartido
2. instalar la nueva version en el equipo Android

## Como regenerar el APK
Desde el proyecto:

```bash
npm run sync:android
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew assembleDebug
```

Luego el nuevo APK quedara otra vez en:
- [android/app/build/outputs/apk/debug/app-debug.apk](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/android/app/build/outputs/apk/debug/app-debug.apk)

## Recomendacion practica
Para pruebas internas:
1. usar este APK debug
2. validar con pocos equipos
3. cuando el flujo este estable, pasar a build firmada o distribucion por Google Play Internal Testing

## Archivos relacionados
- [docs/technical/operator-mobile-publication-guide.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/operator-mobile-publication-guide.md)
- [docs/technical/operator-mobile-implementation.md](/Users/sergioiriartevasquez/Desktop/gruas-alerta-calendario-main/docs/technical/operator-mobile-implementation.md)
