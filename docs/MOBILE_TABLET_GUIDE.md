# Guía de Uso Móvil y Tablet - TMS Grúas

## Introducción

TMS Grúas está optimizado para ofrecer una experiencia excepcional en dispositivos móviles y tablets. Esta guía detalla las funcionalidades específicas, optimizaciones implementadas y mejores prácticas para el uso en dispositivos táctiles.

## Características Móviles Principales

### Progressive Web App (PWA)

TMS Grúas funciona como una aplicación nativa en dispositivos móviles:

**Instalación:**
1. Abrir https://tu-dominio.com en Chrome/Safari móvil
2. Tocar el menú del navegador (⋯)
3. Seleccionar "Agregar a pantalla de inicio" o "Instalar aplicación"
4. La app aparecerá como icono nativo en tu dispositivo

**Funcionalidades PWA:**
- **Acceso offline**: Funcionalidad básica sin conexión
- **Notificaciones push**: Alertas de servicios urgentes
- **Inicio rápido**: Carga instantánea desde pantalla de inicio
- **Experiencia nativa**: Sin barras de navegador

### Diseño Responsive Adaptativo

La interfaz se adapta automáticamente según el dispositivo:

#### Móviles (< 768px)
- **Layout**: Una columna, contenido apilado verticalmente
- **Navegación**: Menú hamburguesa colapsible
- **Botones**: Tamaño mínimo 44px para fácil toque
- **Formularios**: Campos apilados, teclados optimizados
- **Tablas**: Vista de tarjetas para mejor legibilidad

#### Tablets (768px - 1023px)  
- **Layout**: Dos columnas balanceadas
- **Navegación**: Sidebar semi-persistente
- **Dashboard**: Grid 2x2 de métricas
- **Formularios**: Campos agrupados inteligentemente
- **Modales**: Tamaño intermedio optimizado

## Optimizaciones Táctiles

### Controles Touch-Friendly

**Botones y Enlaces:**
- Tamaño mínimo: 44px x 44px
- Espaciado entre elementos: 8px mínimo
- Estados visuales claros (pressed, hover)
- Feedback haptico en dispositivos compatibles

**Formularios Optimizados:**
```typescript
// Ejemplo de campo optimizado para móvil
<Input
  type="email"
  inputMode="email"           // Teclado de email
  autoComplete="email"        // Autocompletado
  className="text-base"       // Previene zoom iOS
  placeholder="email@ejemplo.com"
/>
```

**Tipos de Teclado por Campo:**
- Email: `inputMode="email"`
- Teléfono: `inputMode="tel"`
- Números: `inputMode="numeric"`
- URLs: `inputMode="url"`
- Búsqueda: `inputMode="search"`

### Gestos Táctiles

**Navegación por Gestos:**
- **Swipe horizontal**: Cambiar entre tabs
- **Pull to refresh**: Actualizar listas
- **Tap and hold**: Menús contextuales
- **Pinch to zoom**: Imágenes y documentos

**Área de Toque Expandida:**
```css
/* Elementos clicables tienen área expandida */
.touch-target {
  padding: 12px;
  min-height: 44px;
  min-width: 44px;
}
```

## Funcionalidades por Módulo

### Dashboard Móvil

**Métricas Responsivas:**
- Vista de tarjetas apiladas en móvil
- Iconos grandes y texto legible
- Información esencial prioritaria
- Scroll vertical suave

**Navegación Rápida:**
- Accesos directos a funciones críticas
- Búsqueda rápida prominente
- Alertas visuales destacadas

### Portal de Operadores Móvil

**Inspecciones Digitales:**
```typescript
// Optimizaciones para cámara móvil
const CameraCapture = () => {
  const { isMobile } = useDeviceType()
  
  return (
    <Camera
      facingMode={isMobile ? "environment" : "user"}
      resolution={isMobile ? "720p" : "1080p"}
      quality={isMobile ? 0.8 : 0.9}
    />
  )
}
```

**Funcionalidades Clave:**
- **Captura de fotos**: Integración nativa con cámara
- **Firmas digitales**: Canvas optimizado para dedos
- **GPS automático**: Localización de servicios
- **Modo offline**: Sincronización posterior

**Controles Específicos:**
- Botones de cámara extra grandes
- Preview de imágenes en tiempo real
- Compresión automática de fotos
- Galería de imágenes tipo carrusel

### Gestión de Servicios Móvil

**Formulario Adaptativo:**
```typescript
// Layout responsivo de formulario
const ServiceForm = () => {
  const { isMobile, isTablet } = useDeviceType()
  
  return (
    <div className={cn(
      "grid gap-4",
      isMobile && "grid-cols-1",
      isTablet && "grid-cols-2", 
      !isMobile && !isTablet && "grid-cols-3"
    )}>
      {/* Campos del formulario */}
    </div>
  )
}
```

**Características:**
- Autocompletado inteligente
- Validación en tiempo real no intrusiva
- Campos colapsibles para reducir scroll
- Guardado automático de borradores

### Tablas y Listas Móviles

**Vista de Tarjetas:**
```typescript
// Tabla que se convierte en tarjetas en móvil
const ResponsiveTable = ({ data, columns }) => {
  const { isMobile } = useDeviceType()
  
  if (isMobile) {
    return (
      <div className="space-y-4">
        {data.map(item => (
          <MobileCard key={item.id} item={item} />
        ))}
      </div>
    )
  }
  
  return <StandardTable columns={columns} data={data} />
}
```

**Funcionalidades:**
- Scroll infinito en lugar de paginación
- Búsqueda con filtros colapsibles
- Acciones swipe (deslizar para opciones)
- Agrupación inteligente de datos

## Configuraciones Específicas

### Configuración de Teclados Móviles

```html
<!-- Prevenir zoom en iOS -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

<!-- Configuración de teclado para formularios -->
<input 
  type="tel" 
  inputmode="numeric" 
  pattern="[0-9]*"
  autocomplete="tel"
/>
```

### Configuración de PWA

```json
// manifest.json optimizado para móvil
{
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#1f2937",
  "background_color": "#ffffff",
  "start_url": "/",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ]
}
```

### Service Worker para Offline

```javascript
// Estrategia de caché para móviles
const CACHE_STRATEGY = {
  // Páginas críticas: Cache First
  pages: 'CacheFirst',
  // API data: Network First con fallback
  api: 'NetworkFirst',
  // Assets estáticos: Stale While Revalidate
  assets: 'StaleWhileRevalidate'
}
```

## Optimizaciones de Performance

### Carga Diferida por Dispositivo

```typescript
// Componentes optimizados por dispositivo
const HeavyComponent = lazy(() => {
  if (window.innerWidth < 768) {
    return import('./MobileLightComponent')
  }
  return import('./DesktopHeavyComponent')
})
```

### Imágenes Responsivas

```typescript
// Tamaños de imagen por dispositivo
const getImageUrl = (baseUrl: string, deviceType: DeviceType) => {
  const sizes = {
    mobile: '400w',
    tablet: '800w', 
    desktop: '1200w'
  }
  return `${baseUrl}?w=${sizes[deviceType]}&q=80`
}
```

### Bundle Splitting Inteligente

```typescript
// Chunks específicos para móvil
export const mobileRoutes = [
  {
    path: '/mobile-dashboard',
    component: lazy(() => import('./MobileDashboard'))
  }
]
```

## Troubleshooting Móvil

### Problemas Comunes y Soluciones

**1. App no se instala como PWA:**
```bash
# Verificar lista:
✓ HTTPS habilitado
✓ manifest.json válido
✓ Service worker registrado
✓ Iconos de tamaño correcto
✓ start_url accesible
```

**2. Zoom no deseado en iOS:**
```css
/* Usar font-size >= 16px en inputs */
input, select, textarea {
  font-size: 16px;
}
```

**3. Scroll problemático en móviles:**
```css
/* Mejora el scroll en webkit */
-webkit-overflow-scrolling: touch;
overscroll-behavior: contain;
```

**4. Botones muy pequeños:**
```css
/* Asegurar área táctil mínima */
.touch-target {
  min-height: 44px;
  min-width: 44px;
  padding: 8px;
}
```

### Debug en Dispositivos Móviles

**Chrome DevTools Móvil:**
1. Abrir DevTools (F12)
2. Clic en icono de dispositivo móvil
3. Seleccionar dispositivo a emular
4. Probar diferentes orientaciones

**Depuración Remota (Android):**
```bash
# Habilitar depuración USB en Android
# En Chrome desktop: chrome://inspect
# Seleccionar dispositivo conectado
```

**Safari Web Inspector (iOS):**
```bash
# En iOS: Configuración > Safari > Avanzado > Web Inspector
# En Mac: Safari > Develop > [Dispositivo iOS]
```

## Mejores Prácticas de Uso

### Para Usuarios Móviles

**Navegación Eficiente:**
- Usar búsqueda rápida para encontrar contenido
- Aprovechar gestos swipe en listas
- Usar modo landscape para tablas complejas

**Gestión de Datos:**
- Sincronizar datos cuando hay buena conexión
- Revisar alertas de conectividad
- Usar modo offline para inspecciones

**Rendimiento:**
- Cerrar pestañas innecesarias del navegador
- Limpiar caché periódicamente
- Actualizar app desde pantalla de inicio

### Para Administradores

**Configuración Inicial:**
```typescript
// Optimizar configuración para móviles
const mobileConfig = {
  paginationSize: 10,      // Menos items por página
  imageQuality: 0.8,       // Menor calidad para velocidad
  cacheStrategy: 'aggressive', // Caché más agresivo
  offlineMode: true        // Habilitar modo offline
}
```

**Monitoreo de Uso:**
- Analizar métricas de uso móvil
- Monitorear tiempos de carga en dispositivos
- Revisar errores específicos de móvil

## Actualizaciones y Mantenimiento

### Actualización de PWA

**Detección de Actualizaciones:**
```typescript
// Service worker detecta nuevas versiones
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    registration.addEventListener('updatefound', () => {
      // Mostrar notificación de actualización disponible
      showUpdateNotification()
    })
  })
}
```

**Proceso de Actualización:**
1. Usuario recibe notificación de actualización
2. Confirma actualización
3. App recarga con nueva versión
4. Caché se actualiza automáticamente

### Mantenimiento Preventivo

**Limpieza de Caché:**
```javascript
// Limpiar caché antiguo automáticamente
const CACHE_VERSION = 'v2.0.0'
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_VERSION)
          .map(cacheName => caches.delete(cacheName))
      )
    })
  )
})
```

---

Esta guía asegura que los usuarios de dispositivos móviles y tablets tengan la mejor experiencia posible con TMS Grúas, aprovechando al máximo las capacidades táctiles y de conectividad de sus dispositivos.