# Troubleshooting - TMS Grúas

## Problemas Comunes y Soluciones

### Problemas de Instalación

#### Error: "Node.js version not supported"
```bash
# Verificar versión actual
node --version

# Si es < 18, actualizar Node.js
# Descargar desde: https://nodejs.org/
# O usar nvm:
nvm install 18
nvm use 18
```

#### Error: "npm install fails"
```bash
# Limpiar caché npm
npm cache clean --force

# Eliminar node_modules y package-lock.json
rm -rf node_modules package-lock.json

# Reinstalar
npm install

# Si persiste, usar npm ci
npm ci
```

#### Error: "Cannot connect to Supabase"
```bash
# Verificar variables de entorno
cat .env.local

# Verificar formato correcto:
VITE_SUPABASE_URL=https://proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJI...

# Verificar que el proyecto Supabase esté activo
```

### Problemas Responsive y Móviles

#### La app no se ve correctamente en móvil

**Síntomas:**
- Elementos cortados en los bordes
- Texto muy pequeño
- Botones difíciles de tocar
- Layout roto en pantallas pequeñas

**Soluciones:**
```html
<!-- Verificar viewport meta tag -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- No debe tener user-scalable=no para accesibilidad -->
```

```bash
# Verificar que hooks responsive están funcionando
console.log(useDeviceType()) // En DevTools Console
```

**Checklist de Verificación:**
- [ ] Viewport meta tag presente
- [ ] Zoom del navegador al 100%
- [ ] Navegador actualizado
- [ ] JavaScript habilitado
- [ ] Cache limpio

#### PWA no se instala en móvil

**Requisitos para PWA:**
- [ ] HTTPS habilitado
- [ ] manifest.json válido
- [ ] Service worker registrado
- [ ] Iconos de tamaños correctos

**Verificar manifest.json:**
```bash
# Acceder directamente
curl https://tu-dominio.com/manifest.json

# Verificar campos requeridos:
# - name, short_name, start_url, display, icons
```

**Verificar Service Worker:**
```javascript
// En DevTools Console
navigator.serviceWorker.getRegistration()
.then(reg => console.log(reg ? 'SW registered' : 'No SW'))
```

#### Elementos táctiles muy pequeños

**Problema:** Botones < 44px difíciles de tocar

**Solución temporal CSS:**
```css
/* Aplicar a botones problemáticos */
.touch-friendly {
  min-height: 44px !important;
  min-width: 44px !important;
  padding: 8px !important;
}
```

**Verificar en código:**
```typescript
// Los botones deben usar el hook
const { isTouchDevice } = useDeviceType()

<Button 
  className={cn(
    "standard-button",
    isTouchDevice && "min-h-11 min-w-11 p-3"
  )}
>
```

### Problemas de Autenticación

#### Usuario no puede iniciar sesión

**Síntomas:**
- "Invalid login credentials"
- "User not found"
- "Email not confirmed"

**Verificaciones:**
```bash
# 1. Verificar estado del usuario en Supabase Dashboard
# Authentication > Users > Buscar email

# 2. Verificar políticas RLS
# Database > Policies > profiles table

# 3. Verificar función get_current_user_role
```

**Soluciones comunes:**
1. **Email no confirmado:** Reenviar confirmación desde Supabase
2. **Usuario bloqueado:** Desbloquear en Supabase Dashboard
3. **Políticas RLS:** Verificar que permiten acceso de lectura

#### Portal de clientes no funciona

**Problema:** Cliente no puede acceder a su portal

**Verificar configuración:**
```sql
-- Verificar que el usuario tiene rol client
SELECT id, email, role, client_id FROM profiles 
WHERE email = 'cliente@ejemplo.com';

-- Verificar que el cliente existe
SELECT id, name FROM clients WHERE id = 'uuid-del-cliente';
```

**Soluciones:**
1. **Sin rol client:** Actualizar rol en Configuración > Usuarios
2. **Sin client_id:** Asignar cliente en perfil de usuario
3. **Cliente inexistente:** Crear cliente en Gestión > Clientes

### Problemas de Performance

#### App lenta en dispositivos móviles

**Síntomas:**
- Carga inicial > 5 segundos
- Animaciones entrecortadas
- Respuesta lenta a toques

**Verificaciones:**
```bash
# 1. Lighthouse audit
npx lighthouse https://tu-dominio.com --view

# 2. Bundle analyzer
npm run build
npm run analyze

# 3. Network tab en DevTools
# Verificar tamaño de recursos
```

**Optimizaciones inmediatas:**
```typescript
// 1. Lazy loading de componentes pesados
const HeavyComponent = lazy(() => import('./HeavyComponent'))

// 2. Memo para componentes costosos
const ExpensiveCard = memo(({ data }) => {
  // Componente costoso
}, (prevProps, nextProps) => {
  return prevProps.data.id === nextProps.data.id
})

// 3. Debounce en búsquedas
const debouncedSearch = useMemo(
  () => debounce((term) => setSearchTerm(term), 300),
  []
)
```

#### Imágenes tardan mucho en cargar

**Problema:** Fotos de inspecciones muy pesadas

**Soluciones:**
```typescript
// 1. Compresión automática en captura
const compressImage = (file: File, quality = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      const { deviceType } = useDeviceType()
      const maxWidth = deviceType === 'mobile' ? 800 : 1200
      
      canvas.width = Math.min(img.width, maxWidth)
      canvas.height = (img.height * canvas.width) / img.width
      
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      
      canvas.toBlob(resolve, 'image/jpeg', quality)
    }
    
    img.src = URL.createObjectURL(file)
  })
}

// 2. Lazy loading de imágenes
<img 
  src={imageUrl}
  loading="lazy"
  className="w-full h-auto"
/>
```

### Problemas de Datos

#### Servicios no aparecen en cierres

**Problema:** Servicios completados no se incluyen automáticamente

**Verificar estado de servicios:**
```sql
-- Ver servicios del período
SELECT folio, status, service_date, client_id 
FROM services 
WHERE service_date BETWEEN '2025-01-01' AND '2025-01-31'
AND status = 'completed';

-- Ver cierres existentes
SELECT * FROM service_closures 
WHERE date_from <= '2025-01-31' AND date_to >= '2025-01-01';
```

**Soluciones:**
1. **Estado incorrecto:** Cambiar estado a "completed"
2. **Ya en otro cierre:** Verificar closure_services table
3. **Fuera de fechas:** Verificar service_date vs período del cierre

#### Inspecciones no generan PDF

**Problema:** Error al generar documentos de inspección

**Verificar Edge Function:**
```bash
# Verificar logs de la función
# Supabase Dashboard > Edge Functions > generate-pdf > Logs

# Verificar secrets configurados
# Dashboard > Settings > Edge Functions > Secrets
```

**Variables requeridas:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FROM_EMAIL`

### Problemas de Edge Functions

#### Función send-email no funciona

**Verificar configuración SMTP:**
```bash
# En Supabase Edge Functions Secrets:
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=tu_api_key
FROM_EMAIL=noreply@tu-dominio.com
```

**Debugging:**
```typescript
// Verificar función manualmente
const { data, error } = await supabase.functions.invoke('send-email', {
  body: {
    to: 'test@ejemplo.com',
    subject: 'Test',
    html: '<p>Test message</p>'
  }
})

console.log('Response:', { data, error })
```

#### Función generate-pdf falla

**Síntomas:**
- Error 500 en función
- PDF no se genera
- Email sin adjunto

**Verificar dependencias:**
```typescript
// En la función, verificar imports
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// Verificar que Supabase client está configurado
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)
```

### Debugging Tools

#### DevTools Console Commands

```javascript
// 1. Verificar estado responsive
console.log('Device:', window.TMS_DEBUG?.device)

// 2. Verificar usuario actual
console.log('User:', window.TMS_DEBUG?.user)

// 3. Verificar queries React Query
console.log('Queries:', window.TMS_DEBUG?.queries)

// 4. Forzar recarga de datos
window.TMS_DEBUG?.refetchAll()
```

#### Modo Debug Responsive

```typescript
// Agregar a cualquier componente para debugging
const DebugInfo = () => {
  const device = useDeviceType()
  const [debugVisible, setDebugVisible] = useState(false)
  
  useEffect(() => {
    // Mostrar debug en desarrollo
    if (import.meta.env.DEV) {
      setDebugVisible(true)
      // Auto-hide después de 5 segundos
      setTimeout(() => setDebugVisible(false), 5000)
    }
  }, [])
  
  if (!debugVisible) return null
  
  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-2 rounded text-xs z-50">
      <div>Device: {device.deviceType}</div>
      <div>Width: {window.innerWidth}px</div>
      <div>Touch: {device.isTouchDevice ? 'Yes' : 'No'}</div>
    </div>
  )
}
```

#### Network Issues Debugging

```bash
# 1. Verificar conectividad a Supabase
curl -I https://tu-proyecto.supabase.co/rest/v1/

# 2. Verificar CORS
curl -H "Origin: https://tu-dominio.com" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://tu-proyecto.supabase.co/rest/v1/

# 3. Test de latencia
ping tu-proyecto.supabase.co
```

### Comandos de Recovery

#### Reset completo del entorno

```bash
# 1. Backup de datos importantes
npm run backup:data

# 2. Limpiar todo
rm -rf node_modules package-lock.json .vite
npm cache clean --force

# 3. Reinstalar
npm install

# 4. Resetear configuración
cp .env.example .env.local
# Editar .env.local con credenciales correctas

# 5. Restart desarrollo
npm run dev
```

#### Restaurar base de datos

```sql
-- Solo en caso de emergencia, ejecutar con precaución
-- Backup primero:
-- pg_dump database_url > backup.sql

-- Reset tablas específicas si es necesario
TRUNCATE services, inspections, service_closures CASCADE;

-- Reiniciar secuencias
SELECT setval('services_folio_seq', 1000);
```

## Contacto de Soporte

### Escalación de Problemas

1. **Nivel 1 - Auto-resolución:**
   - Consultar esta guía
   - Verificar FAQ
   - Probar soluciones básicas

2. **Nivel 2 - Documentación:**
   - Revisar documentación técnica
   - Verificar ejemplos de código
   - Consultar issues conocidos

3. **Nivel 3 - Soporte Técnico:**
   - Email: soporte@tmsgruas.com
   - Include: logs, screenshots, pasos reproducir
   - Response time: 24-48 horas

### Información para Reportes

```markdown
## Bug Report Template

**Problema:**
Descripción clara del problema

**Entorno:**
- URL: https://tu-dominio.com
- Browser: Chrome 121.0.6167.160
- OS: Windows 11 / macOS 14.2 / Android 13
- Device: Desktop / iPhone 15 / Samsung Galaxy S23
- Screen: 1920x1080 / 375x812

**Pasos para Reproducir:**
1. Paso 1
2. Paso 2  
3. Paso 3

**Resultado Esperado:**
Lo que debería pasar

**Resultado Actual:**
Lo que realmente pasa

**Logs de Console:**
```
Error messages from DevTools Console
```

**Screenshots:**
[Adjuntar imágenes del problema]

**Intentos de Solución:**
- [ ] Refresh página
- [ ] Limpiar cache
- [ ] Probar otro navegador
- [ ] Verificar permisos
```

---

**Última actualización:** Enero 2025  
**Versión de la guía:** 2.0.0