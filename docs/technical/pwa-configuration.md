# Configuración PWA - TMS Grúas v2.2.0

## Características de la PWA

### Funcionalidades Offline
- **Visualización de datos**: Datos previamente cargados disponibles sin conexión
- **Entradas rápidas**: Registro de gastos y eventos offline
- **Sincronización automática**: Al recuperar conexión, sincroniza datos pendientes
- **Cache inteligente**: Almacena automáticamente datos frecuentemente accedidos

### Instalación

#### Desde Navegador Desktop
1. Abrir TMS Grúas en Chrome, Edge o Firefox
2. Buscar ícono de "Instalar" en la barra de direcciones
3. Hacer clic en "Instalar TMS Grúas"
4. La aplicación se agregará al escritorio y menú de inicio

#### Desde Navegador Móvil
1. Abrir TMS Grúas en Safari (iOS) o Chrome (Android)
2. **iOS**: Tocar botón "Compartir" → "Agregar a pantalla de inicio"
3. **Android**: Tocar menú → "Agregar a pantalla de inicio"
4. La aplicación se instalará como app nativa

### Notificaciones Push

#### Configuración del Usuario
1. **Activar Notificaciones**: Configuraciones → Notificaciones
2. **Permitir en Navegador**: Aceptar solicitud de permisos
3. **Configurar Tipos**:
   - Vencimiento de documentos
   - Facturas vencidas
   - Alertas de stock bajo
   - Recordatorios de mantenimiento
   - Nuevos servicios asignados

#### Gestión de Suscripciones
- **Activar/Desactivar**: Por tipo de notificación
- **Horarios**: Configurar horarios de recepción
- **Frecuencia**: Inmediata, diaria o semanal

### Sincronización de Datos

#### Datos Almacenados Localmente
- **Servicios activos**: Servicios en progreso del usuario
- **Datos de grúas**: Información básica de grúas asignadas
- **Catálogo de inventario**: Items frecuentemente usados
- **Configuraciones de usuario**: Preferencias personales

#### Proceso de Sincronización
1. **Automática**: Cada vez que hay conexión disponible
2. **Manual**: Botón "Sincronizar" en configuraciones
3. **Inteligente**: Prioriza datos más recientes y críticos
4. **Conflictos**: Solicita resolución manual cuando hay discrepancias

## Configuración Técnica

### Manifest PWA
```json
{
  "name": "TMS Grúas",
  "short_name": "TMS Grúas",
  "description": "Sistema de Gestión de Transporte y Servicios",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#3b82f6",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker
- **Cache Strategy**: Stale While Revalidate para datos dinámicos
- **Network First**: Para datos críticos en tiempo real
- **Cache First**: Para recursos estáticos
- **Offline Fallback**: Páginas offline para funcionalidad básica

### Almacenamiento Local

#### IndexedDB
- **Servicios**: Datos de servicios activos
- **Entradas Rápidas**: Registros offline pendientes
- **Cache de Imágenes**: Fotos y documentos frecuentes
- **Configuraciones**: Preferencias del usuario

#### LocalStorage
- **Token de Sesión**: Autenticación persistente
- **Configuración UI**: Estados de interfaz
- **Filtros**: Preferencias de filtrado guardadas

## Optimización de Performance

### Estrategias de Cache
1. **App Shell**: Interfaz básica siempre disponible
2. **Lazy Loading**: Carga de componentes bajo demanda
3. **Image Optimization**: Compresión automática de imágenes
4. **Bundle Splitting**: Separación de código por funcionalidad

### Gestión de Memoria
- **Limpieza automática**: Cache antiguo se elimina automáticamente
- **Compresión**: Datos almacenados en formato comprimido
- **Límites de almacenamiento**: Respeta límites del dispositivo

## Troubleshooting PWA

### Problemas Comunes

#### PWA no se instala
1. Verificar que el navegador soporte PWA
2. Comprobar conexión HTTPS
3. Limpiar cache del navegador
4. Verificar que el manifest.json esté accesible

#### Sincronización falla
1. Verificar conexión a internet
2. Comprobar estado del servidor
3. Limpiar datos de la aplicación
4. Reinstalar PWA

#### Notificaciones no llegan
1. Verificar permisos de notificación en el navegador
2. Comprobar configuración en la aplicación
3. Verificar que el service worker esté activo
4. Revisar configuración de no molestar del dispositivo

### Herramientas de Diagnóstico

#### Chrome DevTools
1. **Application Tab**: Revisar manifest, service worker, y storage
2. **Network Tab**: Verificar requests y respuestas
3. **Console**: Revisar errores de PWA
4. **Lighthouse**: Audit de PWA y performance

#### Comandos de Diagnóstico
- **Registrar Service Worker**: Forzar re-registro
- **Limpiar Cache**: Eliminar cache de la aplicación
- **Reset PWA**: Restaurar estado inicial
- **Verificar Sincronización**: Test manual de sync

## Actualizaciones de la PWA

### Proceso de Actualización
1. **Detección automática**: PWA detecta nueva versión
2. **Notificación al usuario**: Banner de actualización disponible
3. **Actualización en background**: Descarga nueva versión
4. **Activación**: Usuario activa nueva versión cuando esté listo

### Versionado
- **Semantic Versioning**: Major.Minor.Patch
- **Changelog**: Registro de cambios visible para usuarios
- **Rollback**: Posibilidad de revertir a versión anterior

### Cache Busting
- **Estrategia automática**: Archivos con hash único
- **Invalidación selectiva**: Solo archivos cambiados se actualizan
- **Precaching**: Recursos críticos pre-cargados