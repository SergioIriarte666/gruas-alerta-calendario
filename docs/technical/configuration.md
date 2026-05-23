# Configuración del Sistema

## Zona Horaria
- **Configuración**: Chile/Santiago (America/Santiago)
- **Formato**: DD/MM/YYYY HH:mm
- **Implementación**: Funciones date-fns-tz para conversión automática

## Parámetros Globales
- **Moneda**: Peso Chileno (CLP)
- **Idioma**: Español (es-CL)
- **Método Inventario**: FIFO por defecto
- **Roles**: admin, supervisor, operator, client

## Variables de Entorno
```
VITE_SUPABASE_PROJECT_ID=tu_project_id_supabase
VITE_SUPABASE_PUBLISHABLE_KEY=tu_publishable_key_supabase
VITE_SUPABASE_URL=tu_url_supabase
VITE_TURNSTILE_SITE_KEY=tu_turnstile_site_key # opcional
VITE_APP_NAME=TMS Grúas
```

### Secrets backend relevantes
- `TURNSTILE_SECRET_KEY`: validación server-side del captcha en recuperación de contraseña, solo si decides activar Turnstile.
- `SUPABASE_SERVICE_ROLE_KEY`: requerido por Edge Functions administrativas y por `send-password-reset`.

## Configuraciones PWA
- Instalable en dispositivos móviles
- Service Worker para funcionalidad offline
- Push notifications habilitadas
- Cache automático de recursos críticos

## Seguridad
- **RLS**: Row Level Security habilitado en todas las tablas
- **Autenticación**: Supabase Auth con refresh tokens
- **Captcha opcional**: Cloudflare Turnstile puede activarse en recuperación de contraseña con validación `siteverify` en backend
- **Permisos**: Granulares por módulo y operación
- **Auditoría**: Logs automáticos de cambios críticos

## Configuraciones de Empresa
- Logo corporativo personalizable
- Datos fiscales (RUT, razón social)
- Información de contacto
- Plantillas de documentos

## Sistema de Reportes
- **Header Corporativo**: Todos los PDFs incluyen logo y datos completos de empresa
- **Datos de Empresa**: Se obtienen de `company_data` tabla en Supabase
- **Fallback**: Valores por defecto si no hay configuración
- **Formatos**: PDF con headers profesionales, Excel con múltiples hojas
- **Integración**: `fetchCompanyData()` y `addCompanyHeader()` para consistencia
