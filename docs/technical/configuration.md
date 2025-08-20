# Configuración del Sistema

## Configuración Global de Zona Horaria

### Implementación Chile/Santiago
El sistema está configurado globalmente para usar la zona horaria de Chile/Santiago:

```typescript
// Configuración global en utils/dateUtils.ts
import { format, parse } from 'date-fns';
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

const CHILE_TIMEZONE = 'America/Santiago';

export const formatDateForChile = (date: Date): string => {
  const chileTime = utcToZonedTime(date, CHILE_TIMEZONE);
  return format(chileTime, 'dd/MM/yyyy HH:mm');
};
```

### Parámetros del Sistema

#### Configuraciones de Empresa
- **Nombre**: Configurable desde panel de administración
- **Logo**: Subida y gestión de imagen corporativa
- **Datos de Contacto**: Dirección, teléfono, email
- **Configuración Fiscal**: RUT, razón social

#### Configuraciones Operacionales
- **Zona Horaria**: Chile/Santiago (fijo)
- **Moneda**: Peso Chileno (CLP)
- **Formato de Fecha**: DD/MM/YYYY
- **Idioma**: Español (es-CL)

#### Configuraciones de Inventario
- **Método de Valuación**: FIFO, LIFO, Promedio
- **Alertas de Stock**: Mínimo, máximo, punto de reorden
- **Categorías**: Configurables por administrador
- **Unidades de Medida**: Sistema métrico chileno

## Variables de Entorno

### Supabase
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Configuraciones PWA
```
VITE_APP_NAME=TMS Grúas
VITE_APP_SHORT_NAME=TMS
VITE_APP_DESCRIPTION=Sistema de Gestión de Grúas
```

## Configuraciones de Seguridad

### Políticas RLS
- Todas las tablas tienen Row Level Security habilitado
- Acceso basado en roles (admin, supervisor, operator, client)
- Funciones de seguridad optimizadas sin recursión

### Autenticación
- Sistema basado en Supabase Auth
- Roles granulares por módulo
- Sesiones seguras con refresh tokens