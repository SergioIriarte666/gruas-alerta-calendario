# Guía Rápida: Cómo Actualizar tu Aplicación de Escritorio Tauri

Este archivo contiene las instrucciones para actualizar y distribuir tu aplicación "Gruas 5 Norte Sistema de Gestion".

---

## Opción 1: Ver Cambios Mientras Desarrollas (Para ti)

Usa este método para trabajar en la aplicación y ver tus cambios reflejados al instante en la ventana de escritorio.

### Paso 1: Iniciar el Entorno de Desarrollo

Abre tu terminal en la carpeta del proyecto y ejecuta el siguiente comando:

```bash
npx tauri dev
```

### Paso 2: ¡A programar!

-   Este comando abrirá la aplicación de escritorio.
-   Ahora puedes modificar cualquier archivo de tu proyecto en la carpeta `src/` (componentes de React, estilos, etc.).
-   Cada vez que guardes un cambio, la ventana de la aplicación de escritorio **se recargará automáticamente** para mostrar las modificaciones. ¡No necesitas hacer nada más!

---

## Opción 2: Publicar una Nueva Versión para tus Usuarios

Usa este método cuando hayas terminado un conjunto de cambios y quieras crear nuevos instaladores (`.dmg` para Mac, `.msi` para Windows) para distribuirlos.

### Paso 1: Confirmar y Guardar tus Cambios con Git

Abre tu terminal en la carpeta del proyecto. Primero, añade todos tus archivos modificados:

```bash
git add .
```

Luego, crea un "commit" (un paquete de guardado) con un mensaje que describa los cambios que hiciste. Por ejemplo:

```bash
git commit -m "feat: Se agrega el nuevo formulario de clientes"
```
*(Reemplaza el mensaje con una descripción real de tus cambios)*

### Paso 2: Subir los Cambios a GitHub

Ahora, sube tus cambios guardados al repositorio en la nube. Si tu rama local se ha desactualizado con respecto a la de GitHub, necesitarás hacer un `pull` primero:

```bash
git pull origin main --no-rebase
git push origin main
```

### Paso 3: ¡GitHub Hace el Trabajo Pesado!

Al ejecutar `git push`, el sistema de **GitHub Actions** que configuramos se activará automáticamente.

-   **¿Cómo verlo?** Ve a tu repositorio en GitHub, a la pestaña **"Actions"**. Verás un flujo de trabajo ejecutándose.
-   **Espera:** El proceso tardará entre 10 y 15 minutos en compilar las versiones para Windows, macOS y Linux.

### Paso 4: Descargar los Nuevos Instaladores

Una vez que el flujo de trabajo termine (verás un ✅ verde), los nuevos instaladores estarán listos.

1.  Ve a la página principal de tu repositorio en GitHub.
2.  En la columna de la derecha, haz clic en **"Releases"**.
3.  Verás una nueva "Release" en modo borrador (`Draft`) con un nombre como `App v0.1.0`.
4.  Haz clic en ella. En la sección de **"Assets"**, encontrarás los archivos listos para descargar:
    -   `..._aarch64.dmg` (Instalador para Mac con Apple Silicon)
    -   `..._x64.msi` (Instalador para Windows de 64 bits)
    -   `...amd64.AppImage` (Ejecutable para Linux)

¡Y listo! Ya puedes compartir esos archivos con tus usuarios. 