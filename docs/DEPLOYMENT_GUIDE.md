# Guía de Deployment - TMS Grúas

## Introducción

Esta guía detalla el proceso completo de deployment de TMS Grúas, desde la configuración inicial hasta el monitoreo en producción, incluyendo optimizaciones específicas para dispositivos móviles y responsive design.

## Requisitos Previos

### Tecnologías Necesarias
- **Node.js**: versión 18 o superior
- **npm**: versión 8 o superior (o yarn/pnpm)
- **Git**: para control de versiones
- **Cuenta Supabase**: para backend y base de datos
- **Dominio propio**: (opcional) para deployment personalizado

### Cuentas y Servicios
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Lovable](https://lovable.dev) (para desarrollo)
- Servicio de hosting (Vercel, Netlify, o similar)
- Servicio de email (para notificaciones)

## Configuración de Supabase

### 1. Crear Proyecto Supabase

```bash
# 1. Crear nuevo proyecto en Supabase Dashboard
# 2. Anotar las siguientes credenciales:
#    - Project URL
#    - Anon Key
#    - Service Role Key (para operaciones administrativas)
```

### 2. Configurar Base de Datos

```sql
-- Ejecutar las migraciones en orden:
-- 1. Tablas principales
-- 2. Políticas RLS
-- 3. Funciones y triggers
-- 4. Datos iniciales

-- Verificar que todas las tablas fueron creadas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';
```

### 3. Configurar Storage

```sql
-- Crear buckets para archivos
INSERT INTO storage.buckets (id, name, public) VALUES 
('avatars', 'avatars', true),
('documents', 'documents', false),
('signatures', 'signatures', false),
('photos', 'photos', false);

-- Configurar políticas de storage
-- (Ver archivo de políticas RLS específico)
```

### 4. Configurar Authentication

```bash
# En Supabase Dashboard:
# 1. Authentication > Settings
# 2. Configurar Site URL: https://tu-dominio.com
# 3. Configurar Redirect URLs:
#    - https://tu-dominio.com/auth/callback
#    - https://tu-dominio.com (para PWA)
# 4. Habilitar Email confirmations si es necesario
```

## Configuración de Variables de Entorno

### Variables de Desarrollo (.env.local)

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key

# Email Configuration (opcional para desarrollo)
VITE_EMAIL_SERVICE_URL=https://tu-proyecto.supabase.co/functions/v1/send-email

# PWA Configuration
VITE_APP_NAME="TMS Grúas"
VITE_APP_DESCRIPTION="Sistema de Gestión de Grúas"

# Environment
VITE_ENV=development
```

### Variables de Producción

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://tu-proyecto-prod.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-prod

# Domain Configuration
VITE_APP_URL=https://tu-dominio.com

# Email Configuration
VITE_EMAIL_SERVICE_URL=https://tu-proyecto-prod.supabase.co/functions/v1/send-email
VITE_SMTP_HOST=smtp.tu-proveedor.com
VITE_SMTP_PORT=587

# Analytics (opcional)
VITE_ANALYTICS_ID=tu-analytics-id

# PWA Configuration
VITE_APP_NAME="TMS Grúas"
VITE_APP_DESCRIPTION="Sistema de Gestión de Grúas"
VITE_APP_THEME_COLOR="#1f2937"
VITE_APP_BACKGROUND_COLOR="#ffffff"

# Security
VITE_ENVIRONMENT=production
VITE_DEBUG=false
```

## Edge Functions

### Configurar Edge Functions en Supabase

```bash
# 1. Verificar que las funciones están deployadas:
#    - send-email
#    - send-user-invitation
#    - generate-pdf-report

# 2. Configurar secrets en Supabase Dashboard:
supabase secrets set SMTP_HOST=smtp.tu-proveedor.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=tu-email@dominio.com
supabase secrets set SMTP_PASSWORD=tu-password
supabase secrets set FROM_EMAIL=noreply@tu-dominio.com
supabase secrets set APP_URL=https://tu-dominio.com
```

### Verificar Edge Functions

```bash
# Test de función de email
curl -X POST \
  'https://tu-proyecto.supabase.co/functions/v1/send-email' \
  -H 'Authorization: Bearer tu-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "to": "test@ejemplo.com",
    "subject": "Test Email",
    "html": "<p>Test message</p>"
  }'
```

## Build y Deployment

### 1. Preparar el Build

```bash
# Instalar dependencias
npm install

# Ejecutar tests (si están configurados)
npm run test

# Verificar TypeScript
npm run type-check

# Crear build de producción
npm run build

# Verificar que el build es exitoso
npm run preview
```

### 2. Optimizaciones de Build

```bash
# Verificar tamaño del bundle
npm run build -- --analyze

# Optimizaciones implementadas:
# - Tree shaking automático
# - Code splitting por rutas
# - Compresión de assets
# - Optimización de imágenes
# - PWA service worker
```

### 3. Deployment en Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Configurar proyecto
vercel

# Configurar variables de entorno en Vercel Dashboard
# Deployar
vercel --prod
```

### 4. Deployment en Netlify

```bash
# Instalar Netlify CLI
npm i -g netlify-cli

# Build y deploy
netlify deploy --prod --dir=dist

# Configurar redirects para SPA
echo "/* /index.html 200" > dist/_redirects
```

## Configuración PWA

### 1. Verificar PWA Manifest

```json
// public/manifest.json
{
  "name": "TMS Grúas",
  "short_name": "TMS",
  "description": "Sistema de Gestión de Grúas",
  "theme_color": "#1f2937",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait-primary",
  "start_url": "/",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512x512.png", 
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ]
}
```

### 2. Service Worker

```javascript
// Verificar que el service worker está registrado
// El archivo sw.js debe estar en public/
// Vite automáticamente registra el SW en producción
```

### 3. Testing PWA

```bash
# Verificar PWA con Lighthouse
npx lighthouse https://tu-dominio.com --view

# Verificar manifest
curl https://tu-dominio.com/manifest.json

# Test de instalación en móvil
# Abrir en Chrome móvil y verificar banner de instalación
```

## Configuración de Dominio Personalizado

### 1. DNS Configuration

```bash
# Configurar DNS en tu proveedor:
# Tipo: CNAME
# Nombre: @ (o www)
# Valor: tu-app.vercel.app (o provider correspondiente)

# Para subdominios:
# Tipo: CNAME  
# Nombre: app
# Valor: tu-app.vercel.app
```

### 2. SSL/HTTPS

```bash
# SSL automático en Vercel/Netlify
# Verificar certificado válido
curl -I https://tu-dominio.com

# Headers de seguridad recomendados:
# - Strict-Transport-Security
# - Content-Security-Policy  
# - X-Frame-Options
# - X-Content-Type-Options
```

## Monitoreo y Analytics

### 1. Configurar Logging

```typescript
// utils/logger.ts
export const logger = {
  info: (message: string, data?: any) => {
    if (import.meta.env.PROD) {
      // Enviar a servicio de logging externo
      console.log(`[INFO] ${message}`, data)
    }
  },
  error: (message: string, error?: Error) => {
    if (import.meta.env.PROD) {
      // Enviar a servicio de error tracking
      console.error(`[ERROR] ${message}`, error)
    }
  }
}
```

### 2. Performance Monitoring

```typescript
// Performance metrics para PWA
const trackPerformance = () => {
  // Core Web Vitals
  if ('web-vital' in window) {
    // Implementar tracking de métricas
  }
  
  // Service Worker performance
  navigator.serviceWorker?.ready.then(registration => {
    // Monitor SW performance
  })
}
```

### 3. Error Monitoring

```typescript
// Error boundary global
window.addEventListener('error', (event) => {
  logger.error('Global error', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', event.reason)
})
```

## Mantenimiento y Updates

### 1. Backup Strategy

```bash
# Backup de base de datos (mensual)
supabase db dump --file backup-$(date +%Y%m%d).sql

# Backup de storage (mensual)
# Configurar backup automático en Supabase Dashboard
```

### 2. Updates Strategy

```bash
# 1. Desarrollo en rama feature
git checkout -b feature/nueva-funcionalidad

# 2. Testing en staging
vercel --target staging

# 3. Deploy a producción
git checkout main
git merge feature/nueva-funcionalidad
vercel --prod
```

### 3. Health Checks

```bash
# Script de health check
#!/bin/bash
curl -f https://tu-dominio.com/health || exit 1
curl -f https://tu-proyecto.supabase.co/rest/v1/ \
  -H "apikey: tu-anon-key" || exit 1
```

## Troubleshooting

### Problemas Comunes

1. **PWA no se instala en móvil:**
   ```bash
   # Verificar manifest.json válido
   # Verificar HTTPS habilitado
   # Verificar service worker registrado
   ```

2. **Problemas de CORS:**
   ```bash
   # Configurar en Supabase Dashboard:
   # Authentication > Settings > Site URL
   # Agregar todos los dominios permitidos
   ```

3. **Performance en móviles:**
   ```bash
   # Verificar bundle size
   npm run build -- --analyze
   
   # Optimizar imágenes
   # Implementar lazy loading
   # Verificar SW cache strategies
   ```

### Logs y Debugging

```bash
# Logs de Vercel
vercel logs tu-dominio.com

# Logs de Supabase Edge Functions
# Revisar en Supabase Dashboard > Edge Functions > Logs

# Browser DevTools
# Application > Service Workers
# Application > Manifest
# Network > Disable cache
```

## Checklist de Deployment

### Pre-deployment
- [ ] Variables de entorno configuradas
- [ ] Edge functions deployadas y testeadas
- [ ] Base de datos migrada
- [ ] Storage buckets creados
- [ ] PWA manifest configurado
- [ ] Service worker funcionando

### Post-deployment
- [ ] DNS configurado correctamente
- [ ] SSL/HTTPS funcionando
- [ ] PWA instalable en móviles
- [ ] Auth redirect URLs configurados
- [ ] Email service funcionando
- [ ] Performance metrics aceptables
- [ ] Error monitoring activo

### Ongoing Maintenance
- [ ] Backups programados
- [ ] Monitoring configurado
- [ ] Update strategy definida
- [ ] Documentation actualizada

---

Esta guía asegura un deployment exitoso y un mantenimiento eficiente de TMS Grúas en producción, con especial atención a la experiencia móvil y responsive.