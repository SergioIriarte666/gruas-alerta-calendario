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
VITE_SUPABASE_URL=tu_url_supabase
VITE_SUPABASE_ANON_KEY=tu_clave_anonima
VITE_APP_NAME=TMS Grúas
```

## Configuraciones PWA
- Instalable en dispositivos móviles
- Service Worker para funcionalidad offline
- Push notifications habilitadas
- Cache automático de recursos críticos

## Seguridad
- **RLS**: Row Level Security habilitado en todas las tablas
- **Autenticación**: Supabase Auth con refresh tokens
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