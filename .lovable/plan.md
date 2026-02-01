

# Prompt Técnico: Desarrollo de Progressive Web Application (PWA) Empresarial

## 1. Resumen Ejecutivo

Este documento define la especificación técnica completa para desarrollar una Progressive Web Application (PWA) de nivel empresarial. La arquitectura se basa en patrones probados del sistema TMS Grúas, incluyendo formularios interactivos con validación en tiempo real, generación de PDFs, firmas digitales táctiles, funcionalidad offline robusta, notificaciones push y rendimiento optimizado.

---

## 2. Stack Tecnológico Recomendado

### 2.1 Frontend Core

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | ^18.3.x | Framework UI con Concurrent Features |
| TypeScript | ^5.x | Tipado estático y seguridad de tipos |
| Vite | ^5.x | Build tool y dev server optimizado |
| Tailwind CSS | ^3.x | Sistema de diseño utility-first |
| React Router DOM | ^6.x | Enrutamiento SPA |

### 2.2 Gestión de Estado y Datos

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| TanStack Query | ^5.x | Server state management y caching |
| React Hook Form | ^7.x | Formularios performantes |
| Zod | ^3.x | Validación de esquemas |
| Zustand | ^4.x | Client state (opcional) |

### 2.3 Backend y Base de Datos

| Tecnología | Propósito |
|------------|-----------|
| Supabase | BaaS con PostgreSQL, Auth, Storage, Edge Functions |
| IndexedDB | Almacenamiento offline local |

### 2.4 PWA y Offline

| Tecnología | Propósito |
|------------|-----------|
| Service Workers (Vanilla) | Caching, sync, push notifications |
| Web Push API | Notificaciones push |
| Background Sync API | Sincronización diferida |

### 2.5 Componentes Especializados

| Librería | Propósito |
|----------|-----------|
| jsPDF + jspdf-autotable | Generación de PDFs client-side |
| react-signature-canvas | Firma digital táctil |
| Radix UI | Componentes accesibles |
| Lucide React | Iconografía |

---

## 3. Arquitectura de la Aplicación

### 3.1 Estructura de Directorios

```text
src/
├── components/
│   ├── ui/                    # Componentes base (Button, Card, Input)
│   ├── forms/                 # Formularios reutilizables
│   ├── pwa/                   # Componentes PWA específicos
│   │   ├── InstallPrompt.tsx
│   │   ├── ConnectionStatus.tsx
│   │   ├── SyncIndicator.tsx
│   │   ├── UpdateNotification.tsx
│   │   └── PWAWrapper.tsx
│   └── [feature]/             # Componentes por módulo
├── hooks/
│   ├── usePWACapabilities.ts  # Estado PWA central
│   ├── usePushNotifications.ts
│   ├── useOfflineStorage.ts
│   ├── useServiceWorkerManager.ts
│   └── useNetworkStatus.ts
├── contexts/
│   ├── AuthContext.tsx
│   └── UserContext.tsx
├── schemas/                   # Esquemas Zod de validación
├── utils/
│   ├── pdfGenerator.ts
│   └── offlineSync.ts
├── types/
│   └── pwa.ts
└── integrations/
    └── supabase/
public/
├── sw.js                      # Service Worker
├── manifest.json              # Web App Manifest
└── icons/                     # Iconos PWA múltiples tamaños
```

### 3.2 Diagrama de Arquitectura de Alto Nivel

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENTE (PWA)                                │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   React     │  │  TanStack   │  │   Service   │  │  IndexedDB │ │
│  │   Router    │  │   Query     │  │   Worker    │  │   Cache    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                    CAPA DE COMUNICACIÓN                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Offline Queue → Background Sync → API Calls → Real-time    │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                         BACKEND (Supabase)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │PostgreSQL│  │  Auth    │  │ Storage  │  │  Edge Functions  │   │
│  │  + RLS   │  │ (JWT)    │  │ (Files)  │  │  (Push, Sync)    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Requisitos Funcionales Detallados

### RF-01: Formularios Interactivos con Validación en Tiempo Real

**Descripción**: Sistema de formularios con validación instantánea, persistencia local y experiencia táctil optimizada.

**Implementación Técnica**:

```typescript
// Esquema de validación con Zod
import { z } from 'zod';

export const formSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Campo requerido')
    .max(100, 'Máximo 100 caracteres'),
  email: z.string()
    .trim()
    .email('Email inválido'),
  phone: z.string()
    .regex(/^\+?[0-9]{10,15}$/, 'Teléfono inválido'),
  date: z.date()
    .min(new Date(), 'Fecha debe ser futura'),
});

// Hook de formulario con React Hook Form
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export const useValidatedForm = <T extends z.ZodSchema>(schema: T) => {
  return useForm<z.infer<T>>({
    resolver: zodResolver(schema),
    mode: 'onChange', // Validación en tiempo real
    reValidateMode: 'onChange',
  });
};
```

**Criterios de Aceptación**:
- [ ] Validación visual inmediata al modificar campos
- [ ] Mensajes de error claros y contextuales
- [ ] Persistencia automática de borrador en localStorage
- [ ] Prevención de envío con errores pendientes
- [ ] Soporte completo para inputs táctiles

---

### RF-02: Generación y Visualización de PDFs

**Descripción**: Generación client-side de documentos PDF con soporte para imágenes, tablas y firmas digitales.

**Implementación Técnica**:

```typescript
// Generador de PDF con progreso
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ProgressCallback {
  (progress: number, step: string): void;
}

export class PDFGenerator {
  private progressCallback?: ProgressCallback;

  constructor(progressCallback?: ProgressCallback) {
    this.progressCallback = progressCallback;
  }

  async generate(data: FormData): Promise<{ blob: Blob; url: string }> {
    this.updateProgress(10, 'Validando datos...');
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Header con logo
    this.updateProgress(20, 'Agregando encabezado...');
    await this.addHeader(doc, data.companyLogo);

    // Contenido dinámico
    this.updateProgress(40, 'Procesando contenido...');
    this.addContent(doc, data);

    // Tablas de datos
    this.updateProgress(60, 'Generando tablas...');
    (doc as any).autoTable({
      head: [['Columna 1', 'Columna 2']],
      body: data.tableRows,
      startY: 80,
      theme: 'grid',
      styles: { fontSize: 9 }
    });

    // Imágenes y firmas
    this.updateProgress(80, 'Procesando imágenes...');
    await this.addImages(doc, data.photos);
    await this.addSignatures(doc, data.signatures);

    this.updateProgress(100, 'PDF listo');
    
    const blob = doc.output('blob');
    return { blob, url: URL.createObjectURL(blob) };
  }

  private updateProgress(progress: number, step: string) {
    this.progressCallback?.(progress, step);
  }
}
```

**Criterios de Aceptación**:
- [ ] Generación completa sin conexión a servidor
- [ ] Soporte para imágenes base64 embebidas
- [ ] Tablas con paginación automática
- [ ] Firmas digitales incluidas en el documento
- [ ] Descarga automática y fallback manual
- [ ] Barra de progreso visual durante generación

---

### RF-03: Sistema de Firma Digital Táctil

**Descripción**: Componente de firma digital optimizado para dispositivos móviles con soporte para stylus y dedo.

**Implementación Técnica**:

```typescript
import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  label: string;
  personName?: string;
  onSignatureChange: (signature: string) => void;
  signature?: string;
}

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
}

export const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ label, personName, onSignatureChange, signature }, ref) => {
    const canvasRef = useRef<SignatureCanvas>(null);

    useImperativeHandle(ref, () => ({
      clear: () => {
        canvasRef.current?.clear();
        onSignatureChange('');
      },
      isEmpty: () => canvasRef.current?.isEmpty() ?? true,
    }));

    // Restaurar firma desde estado
    useEffect(() => {
      if (signature && canvasRef.current) {
        canvasRef.current.fromDataURL(signature);
      }
    }, [signature]);

    const handleEnd = () => {
      if (canvasRef.current && !canvasRef.current.isEmpty()) {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSignatureChange(dataUrl);
      }
    };

    return (
      <div className="space-y-3">
        <div className="text-center">
          <h4 className="font-semibold">{label}</h4>
          {personName && (
            <p className="text-sm text-muted-foreground">
              Nombre: <span className="font-medium">{personName}</span>
            </p>
          )}
        </div>
        
        <div className="border-2 rounded-lg relative touch-none">
          <SignatureCanvas
            ref={canvasRef}
            canvasProps={{
              className: 'w-full h-32',
              style: { touchAction: 'none' }
            }}
            backgroundColor="white"
            penColor="black"
            minWidth={1}
            maxWidth={3}
            velocityFilterWeight={0.7}
            onEnd={handleEnd}
          />
          <span className="absolute bottom-2 left-2 text-xs text-gray-400">
            Firme aquí con su dedo o stylus
          </span>
        </div>
        
        <button type="button" onClick={() => ref.current?.clear()}>
          Limpiar Firma
        </button>
      </div>
    );
  }
);
```

**Criterios de Aceptación**:
- [ ] Respuesta táctil fluida (<16ms latencia)
- [ ] Soporte para stylus con detección de presión
- [ ] Prevención de scroll durante firma
- [ ] Exportación a formato PNG base64
- [ ] Restauración de firma desde estado
- [ ] Botón de limpieza accesible

---

### RF-04: Funcionalidad Offline con Service Workers

**Descripción**: Capacidad de trabajo completa sin conexión con sincronización automática.

**Service Worker (sw.js)**:

```javascript
const CACHE_NAME = 'app-cache-v1';
const SW_VERSION = '1.0.0';

// Instalación y caching de recursos estáticos
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing v${SW_VERSION}`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Limpiar caches antiguos
      caches.keys().then(names => 
        Promise.all(
          names.filter(name => name !== CACHE_NAME)
               .map(name => caches.delete(name))
        )
      ),
      // Tomar control inmediato
      self.clients.claim()
    ])
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: data.data,
    requireInteraction: data.urgent === true,
    tag: data.tag || `notification-${Date.now()}`,
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click en notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  const targetUrl = data.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then(clients => {
        // Buscar ventana existente
        for (const client of clients) {
          if (client.url.includes(self.registration.scope)) {
            return client.focus().then(() => 
              client.postMessage({ type: 'NOTIFICATION_CLICKED', data })
            );
          }
        }
        // Abrir nueva ventana
        return self.clients.openWindow(targetUrl);
      })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-sync') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  // Notificar a clientes que sync inició
  const clients = await self.clients.matchAll();
  clients.forEach(client => 
    client.postMessage({ type: 'SYNC_STARTED' })
  );
  
  // Aquí iría la lógica de sincronización
  // ...
  
  clients.forEach(client => 
    client.postMessage({ type: 'SYNC_COMPLETED' })
  );
}
```

**Hook de Almacenamiento Offline**:

```typescript
// useOfflineStorage.ts
const DB_NAME = 'AppOfflineDB';
const DB_VERSION = 1;
const STORES = {
  OFFLINE_ACTIONS: 'offlineActions',
  CACHED_DATA: 'cachedData',
};

export const useOfflineStorage = () => {
  const [db, setDb] = useState<IDBDatabase | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initDB = () => {
      return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          Object.values(STORES).forEach(storeName => {
            if (!db.objectStoreNames.contains(storeName)) {
              const store = db.createObjectStore(storeName, { keyPath: 'id' });
              store.createIndex('timestamp', 'timestamp');
            }
          });
        };
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    };

    initDB().then(database => {
      setDb(database);
      setIsReady(true);
    });
  }, []);

  const addOfflineAction = async (action: OfflineAction) => {
    if (!db) throw new Error('Database not ready');
    
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORES.OFFLINE_ACTIONS], 'readwrite');
      const store = tx.objectStore(STORES.OFFLINE_ACTIONS);
      
      const request = store.add({
        ...action,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        retries: 0
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  };

  return { isReady, addOfflineAction, /* más métodos */ };
};
```

**Criterios de Aceptación**:
- [ ] Registro automático de Service Worker
- [ ] Cache de recursos estáticos (App Shell)
- [ ] Cola de acciones offline en IndexedDB
- [ ] Sincronización automática al recuperar conexión
- [ ] Indicador visual de estado de conexión
- [ ] Manejo de conflictos de sincronización

---

### RF-05: Instalación Nativa (A2HS)

**Descripción**: Capacidad de instalar la aplicación en dispositivos como app nativa.

**Web App Manifest (manifest.json)**:

```json
{
  "short_name": "MiApp",
  "name": "Mi Aplicación PWA Empresarial",
  "description": "Descripción completa de la aplicación",
  "icons": [
    {
      "src": "icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "start_url": "/",
  "display": "standalone",
  "scope": "/",
  "theme_color": "#1e293b",
  "background_color": "#0f172a",
  "orientation": "portrait-primary",
  "categories": ["business", "productivity"],
  "lang": "es-ES",
  "prefer_related_applications": false,
  "shortcuts": [
    {
      "name": "Acción Rápida",
      "short_name": "Rápido",
      "url": "/quick-action",
      "icons": [{ "src": "icons/icon-96x96.png", "sizes": "96x96" }]
    }
  ],
  "share_target": {
    "action": "/share",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
}
```

**Hook de Instalación**:

```typescript
// usePWAInstall.ts
export const usePWAInstall = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Capturar evento de instalación
    const handlePrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);

    // Detectar si ya está instalado
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    return () => window.removeEventListener('beforeinstallprompt', handlePrompt);
  }, []);

  const install = async () => {
    if (!installPrompt) return false;
    
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
    
    return outcome === 'accepted';
  };

  return {
    canInstall: !!installPrompt && !isInstalled,
    isInstalled,
    install
  };
};
```

**Criterios de Aceptación**:
- [ ] Prompt de instalación contextual y no intrusivo
- [ ] Detección correcta de instalación previa
- [ ] Iconos en todos los tamaños requeridos
- [ ] Splash screen durante carga
- [ ] Shortcuts funcionales en dispositivos compatibles

---

### RF-06: Notificaciones Push

**Descripción**: Sistema de notificaciones push para comunicación en tiempo real.

**Implementación**:

```typescript
// usePushNotifications.ts
export const usePushNotifications = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const subscribe = async (): Promise<boolean> => {
    // Verificar soporte
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported');
      return false;
    }

    // Solicitar permiso
    const result = await Notification.requestPermission();
    setPermission(result);
    
    if (result !== 'granted') return false;

    // Obtener registro SW
    const registration = await navigator.serviceWorker.ready;

    // Crear suscripción
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: VAPID_PUBLIC_KEY
    });

    // Guardar en servidor
    await saveSubscriptionToServer(subscription);
    
    setIsSubscribed(true);
    return true;
  };

  const unsubscribe = async (): Promise<boolean> => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      await removeSubscriptionFromServer(subscription);
    }
    
    setIsSubscribed(false);
    return true;
  };

  return { isSubscribed, permission, subscribe, unsubscribe };
};
```

**Criterios de Aceptación**:
- [ ] Solicitud de permisos no bloqueante
- [ ] Suscripción/desuscripción funcional
- [ ] Notificaciones con acciones personalizadas
- [ ] Deep linking al clickear notificación
- [ ] Preferencias por tipo de notificación

---

## 5. Requisitos No Funcionales

### RNF-01: Rendimiento

| Métrica | Objetivo | Herramienta |
|---------|----------|-------------|
| First Contentful Paint | < 1.8s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.8s | Lighthouse |
| Cumulative Layout Shift | < 0.1 | Lighthouse |
| First Input Delay | < 100ms | Lighthouse |
| Bundle size (gzipped) | < 200KB inicial | webpack-bundle-analyzer |

**Estrategias de Optimización**:
- Code splitting por ruta
- Lazy loading de componentes pesados
- Preload de recursos críticos
- Compresión de imágenes (WebP/AVIF)
- Service Worker caching

### RNF-02: Accesibilidad (WCAG 2.1 AA)

**Requisitos**:
- Navegación completa por teclado
- Ratio de contraste mínimo 4.5:1
- Textos alternativos en imágenes
- Labels en todos los inputs
- Focus visible en elementos interactivos
- Estructura semántica de headings
- Soporte para lectores de pantalla
- Reducción de movimiento respetada

**Componentes accesibles recomendados**:
- Radix UI Primitives
- Headless UI
- React Aria

### RNF-03: Seguridad

- Todas las conexiones vía HTTPS
- Validación de inputs client y server-side
- Sanitización de contenido HTML
- CSP (Content Security Policy) configurado
- Tokens JWT con expiración
- Row Level Security en base de datos

### RNF-04: Responsive Design

**Breakpoints**:

```css
/* Mobile First */
@media (min-width: 640px)  { /* sm */ }
@media (min-width: 768px)  { /* md - Tablet */ }
@media (min-width: 1024px) { /* lg - Desktop */ }
@media (min-width: 1280px) { /* xl */ }
@media (min-width: 1536px) { /* 2xl */ }
```

**Requisitos**:
- Layout adaptativo sin scroll horizontal
- Targets táctiles mínimo 44x44px en móvil
- Formularios optimizados para entrada táctil
- Imágenes responsivas con srcset
- Tipografía escalable (rem/em)

---

## 6. Testing Automatizado

### 6.1 Configuración Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/']
    }
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  }
});
```

### 6.2 Ejemplo de Tests

```typescript
// FormComponent.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormComponent } from './FormComponent';

describe('FormComponent', () => {
  it('shows validation errors on invalid input', async () => {
    const user = userEvent.setup();
    render(<FormComponent onSubmit={vi.fn()} />);
    
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab();
    
    await waitFor(() => {
      expect(screen.getByText(/email inválido/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<FormComponent onSubmit={onSubmit} />);
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /enviar/i }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' })
      );
    });
  });
});
```

### 6.3 E2E con Playwright

```typescript
// e2e/form-submission.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Form Submission Flow', () => {
  test('completes full form with signature', async ({ page }) => {
    await page.goto('/form');
    
    // Fill form
    await page.fill('[name="name"]', 'John Doe');
    await page.fill('[name="email"]', 'john@example.com');
    
    // Sign
    const canvas = page.locator('.signature-canvas');
    await canvas.dispatchEvent('mousedown', { clientX: 100, clientY: 50 });
    await canvas.dispatchEvent('mousemove', { clientX: 200, clientY: 100 });
    await canvas.dispatchEvent('mouseup');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify success
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

---

## 7. Documentación de API

### 7.1 Hooks Públicos

```typescript
// usePWACapabilities
interface PWACapabilities {
  canWork: boolean;          // Puede trabajar (online u offline)
  canInstall: boolean;       // Instalación disponible
  hasNotifications: boolean; // Notificaciones habilitadas
  syncStatus: {
    isOnline: boolean;
    pendingActions: number;
    lastSync: Date | null;
  };
  installApp: () => Promise<void>;
  enableNotifications: () => Promise<NotificationPermission>;
  clearOfflineData: () => Promise<void>;
}

// useOfflineStorage
interface OfflineStorage {
  isReady: boolean;
  addOfflineAction: (action: OfflineAction) => Promise<void>;
  getOfflineActions: () => Promise<OfflineAction[]>;
  removeOfflineAction: (id: string) => Promise<void>;
  storeData: (store: string, data: any) => Promise<void>;
  getData: (store: string, id?: string) => Promise<any>;
  clearAll: () => Promise<void>;
}

// usePushNotifications
interface PushNotificationHook {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  requestPermission: () => Promise<NotificationPermission>;
}
```

### 7.2 Componentes PWA

```typescript
// PWAWrapper - Envuelve la app con todos los componentes PWA
<PWAWrapper>
  <App />
</PWAWrapper>

// InstallPrompt - Modal de instalación contextual
<InstallPrompt userRole="operator" />

// ConnectionStatus - Indicador de conexión
<ConnectionStatus />

// SyncIndicator - Estado de sincronización
<SyncIndicator />

// UpdateNotification - Aviso de actualización disponible
<UpdateNotification />
```

---

## 8. Casos de Uso Principales

### CU-01: Trabajo de Campo Offline

**Actor**: Operador de campo
**Precondiciones**: App instalada, datos descargados previamente
**Flujo Principal**:
1. Operador pierde conexión en zona rural
2. Sistema detecta offline y muestra indicador
3. Operador completa formulario de inspección
4. Sistema guarda datos en IndexedDB
5. Operador firma digitalmente el documento
6. Sistema genera PDF localmente
7. Al recuperar conexión, sistema sincroniza automáticamente
8. Sistema notifica sincronización exitosa

### CU-02: Instalación de PWA

**Actor**: Usuario nuevo
**Flujo Principal**:
1. Usuario accede a la app web
2. Tras 3 interacciones, sistema muestra prompt contextual
3. Usuario acepta instalación
4. Sistema descarga y cachea recursos
5. App se agrega al home screen
6. Usuario puede acceder offline

---

## 9. Checklist de Implementación

### Fase 1: Fundamentos
- [ ] Configurar proyecto React + TypeScript + Vite
- [ ] Implementar sistema de componentes UI
- [ ] Configurar React Router con rutas protegidas
- [ ] Integrar TanStack Query para data fetching
- [ ] Implementar sistema de autenticación

### Fase 2: Formularios
- [ ] Crear esquemas de validación Zod
- [ ] Implementar formularios con React Hook Form
- [ ] Agregar persistencia local de borradores
- [ ] Implementar componente de firma digital
- [ ] Tests unitarios de validaciones

### Fase 3: PWA Core
- [ ] Crear manifest.json completo
- [ ] Implementar Service Worker básico
- [ ] Configurar meta tags PWA en HTML
- [ ] Generar iconos en múltiples tamaños
- [ ] Implementar hook usePWACapabilities

### Fase 4: Offline
- [ ] Implementar useOfflineStorage con IndexedDB
- [ ] Crear cola de acciones offline
- [ ] Implementar Background Sync
- [ ] Agregar indicadores visuales de estado
- [ ] Tests de sincronización

### Fase 5: Push Notifications
- [ ] Generar par de claves VAPID
- [ ] Implementar suscripción push
- [ ] Crear Edge Function para envío
- [ ] Manejar clicks en notificaciones
- [ ] Configurar preferencias por usuario

### Fase 6: PDFs
- [ ] Implementar generador PDF con jsPDF
- [ ] Agregar soporte para tablas
- [ ] Integrar fotos e imágenes
- [ ] Incluir firmas digitales
- [ ] Optimizar para dispositivos móviles

### Fase 7: Testing y QA
- [ ] Configurar Vitest con RTL
- [ ] Tests unitarios de hooks
- [ ] Tests de integración de formularios
- [ ] Tests E2E con Playwright
- [ ] Auditoría Lighthouse (score > 90)

### Fase 8: Optimización
- [ ] Implementar code splitting
- [ ] Optimizar imágenes
- [ ] Configurar caching headers
- [ ] Minificar y comprimir bundle
- [ ] Monitorear Core Web Vitals

---

## 10. Referencias y Recursos

- [Web.dev PWA](https://web.dev/progressive-web-apps/)
- [MDN Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [React Hook Form Docs](https://react-hook-form.com/)
- [jsPDF Documentation](https://artskydj.github.io/jsPDF/docs/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Supabase Documentation](https://supabase.com/docs)

