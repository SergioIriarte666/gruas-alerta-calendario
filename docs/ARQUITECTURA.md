
# Arquitectura del Sistema - TMS Grúas

## Visión General

TMS Grúas está construido siguiendo una arquitectura moderna de **JAMstack** (JavaScript, APIs, Markup) con un enfoque **serverless** que garantiza escalabilidad, performance y mantenibilidad.

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   React App     │  │   Portal Web    │  │  Mobile PWA  │ │
│  │  (Dashboard)    │  │   (Clientes)    │  │ (Operadores) │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                        CDN / EDGE                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Static Assets │  │   Caching       │  │   SSL/TLS    │ │
│  │   Compression   │  │   Rate Limiting │  │   Security   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                       BACKEND                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Supabase      │  │  Edge Functions │  │   File       │ │
│  │   PostgreSQL    │  │   (Serverless)  │  │   Storage    │ │
│  │   Auth & RLS    │  │   Email/PDF     │  │   Images     │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   INTEGRACIONES                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │    Resend       │  │   Webhooks      │  │   APIs       │ │
│  │   (Email)       │  │   (Eventos)     │  │  Externas    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Capas de la Arquitectura

### 1. Capa de Presentación (Frontend)

#### React Application
- **Framework**: React 18 con TypeScript
- **Build Tool**: Vite para desarrollo y build optimizado
- **Routing**: React Router DOM v6
- **Estado Global**: React Query + Context API
- **UI Components**: shadcn/ui + Tailwind CSS

#### Características Clave
- **Single Page Application (SPA)**
- **Progressive Web App (PWA)** para operadores móviles
- **Server-Side Rendering (SSR)** ready
- **Responsive Design** para todos los dispositivos

#### Estructura de Componentes
```
components/
├── ui/              # Componentes base reutilizables
├── layout/          # Layouts y estructuras de página
├── forms/           # Componentes de formularios
├── charts/          # Visualizaciones de datos
└── domain/          # Componentes específicos del negocio
```

### 2. Capa de Datos (Backend)

#### Supabase como Backend-as-a-Service
- **Base de Datos**: PostgreSQL con extensiones
- **Autenticación**: JWT + Row Level Security
- **APIs**: RESTful + GraphQL
- **Edge Functions**: JavaScript/TypeScript serverless
- **Storage**: Archivos e imágenes

#### Modelo de Datos
```sql
-- Estructura principal de tablas
profiles (usuarios)
  ├── clients (clientes)
  ├── operators (operadores)
  └── permissions (permisos)

services (servicios)
  ├── clients (relación 1:N)
  ├── service_types (tipos de servicio)
  ├── cranes (grúas asignadas)
  └── operators (operadores asignados)

financial (módulo financiero)
  ├── invoices (facturas)
  ├── service_closures (cierres)
  └── costs (costos)
```

### 3. Capa de Lógica de Negocio

#### Custom Hooks Pattern
```typescript
// Hooks especializados por dominio
hooks/
├── services/        # Lógica de servicios
├── auth/           # Autenticación
├── forms/          # Manejo de formularios
├── notifications/  # Sistema de notificaciones
└── reports/        # Generación de reportes
```

#### Estado de la Aplicación
- **Server State**: React Query para cache y sincronización
- **Client State**: useState + useReducer
- **Global State**: Context API para estado compartido
- **Form State**: React Hook Form + Zod validation

### 4. Capa de Servicios

#### Edge Functions (Serverless)
```typescript
// Funciones especializadas
functions/
├── send-email/           # Envío de emails
├── generate-pdf/         # Generación de PDFs
├── process-webhooks/     # Procesamiento de eventos
├── backup-data/          # Respaldos automáticos
└── sync-external/        # Sincronización externa
```

#### APIs Externas
- **Resend**: Servicio de email transaccional
- **Webhooks**: Notificaciones en tiempo real
- **File Processing**: Compresión y optimización de imágenes

## Patrones de Diseño Implementados

### 1. Repository Pattern
```typescript
// Abstracción de acceso a datos
interface ServiceRepository {
  getAll(): Promise<Service[]>
  getById(id: string): Promise<Service>
  create(data: CreateServiceData): Promise<Service>
  update(id: string, data: UpdateServiceData): Promise<Service>
  delete(id: string): Promise<void>
}
```

### 2. Factory Pattern
```typescript
// Creación de objetos complejos
class ReportFactory {
  static createPDFReport(type: ReportType): PDFReport
  static createExcelReport(type: ReportType): ExcelReport
}
```

### 3. Observer Pattern
```typescript
// Sistema de eventos y notificaciones
class EventBus {
  subscribe(event: string, callback: Function): void
  unsubscribe(event: string, callback: Function): void
  emit(event: string, data: any): void
}
```

### 4. Strategy Pattern
```typescript
// Diferentes estrategias de validación
interface ValidationStrategy {
  validate(data: any): ValidationResult
}

class ServiceValidationStrategy implements ValidationStrategy
class InvoiceValidationStrategy implements ValidationStrategy
```

## Seguridad

### Row Level Security (RLS)
```sql
-- Políticas de seguridad a nivel de fila
CREATE POLICY "Users can only see their own data" ON services
  FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Operators can see assigned services" ON services
  FOR SELECT USING (
    operator_id IN (
      SELECT id FROM operators WHERE user_id = auth.uid()
    )
  );
```

### Autenticación y Autorización
- **JWT Tokens** con refresh automático
- **Role-Based Access Control (RBAC)**
- **Multi-factor Authentication (MFA)** ready
- **Session Management** seguro

### Validación de Datos
```typescript
// Validación con Zod schemas
const ServiceSchema = z.object({
  folio: z.string().min(1),
  clientId: z.string().uuid(),
  value: z.number().positive(),
  // ... más validaciones
})
```

## Performance y Optimización

### Frontend Optimizations
- **Code Splitting** por rutas y componentes
- **Lazy Loading** de componentes pesados
- **Memoization** con React.memo y useMemo
- **Virtual Scrolling** para listas grandes
- **Image Optimization** automática

### Backend Optimizations
- **Database Indexing** estratégico
- **Query Optimization** con EXPLAIN ANALYZE
- **Connection Pooling** automático
- **Caching** a múltiples niveles

### Network Optimizations
- **HTTP/2** y **HTTP/3** support
- **Gzip/Brotli** compression
- **CDN** para assets estáticos
- **Service Workers** para cache offline

## Escalabilidad

### Horizontal Scaling
```yaml
# Configuración de auto-scaling
scaling:
  min_instances: 2
  max_instances: 10
  cpu_threshold: 70%
  memory_threshold: 80%
```

### Database Scaling
- **Read Replicas** para consultas
- **Sharding** por cliente/región
- **Archive Strategies** para datos históricos
- **Backup Strategies** automatizadas

### Monitoring y Observabilidad
```typescript
// Métricas y logging estructurado
interface MetricEvent {
  timestamp: Date
  event: string
  userId?: string
  metadata: Record<string, any>
}
```

## DevOps y CI/CD

### Continuous Integration
```yaml
# GitHub Actions pipeline
name: CI/CD Pipeline
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
```

### Deployment Strategies
- **Blue-Green Deployment** para zero downtime
- **Feature Flags** para releases graduales
- **Rollback Strategies** automáticas
- **Health Checks** continuas

## Disaster Recovery

### Backup Strategies
```typescript
// Estrategias de respaldo automático
interface BackupConfig {
  frequency: 'daily' | 'weekly' | 'monthly'
  retention: number // días
  compression: boolean
  encryption: boolean
}
```

### Recovery Procedures
1. **Database Recovery** desde snapshots
2. **Application Recovery** desde containers
3. **File Recovery** desde object storage
4. **Configuration Recovery** desde infrastructure as code

## Futuras Mejoras Arquitectónicas

### Microservicios
- Migración gradual a microservicios
- Event-driven architecture
- API Gateway implementation
- Service mesh para comunicación

### Edge Computing
- Edge functions para mejor latencia
- Geo-distributed cache
- Regional deployments
- Offline-first capabilities

### AI/ML Integration
```typescript
// Preparación para funcionalidades de IA
interface MLService {
  predictMaintenance(craneData: CraneData): MaintenancePrediction
  optimizeRoutes(services: Service[]): OptimizedRoute[]
  detectAnomalies(metrics: Metric[]): Anomaly[]
}
```

### Real-time Features
- WebSocket connections para updates en tiempo real
- Push notifications
- Live chat support
- Real-time dashboard updates

## Consideraciones de Compliance

### Protección de Datos
- **GDPR** compliance ready
- **Data anonymization** capabilities
- **Audit trails** completos
- **Data retention** policies

### Estándares de Seguridad
- **ISO 27001** guidelines
- **OWASP Top 10** protections
- **SOC 2** compliance
- **Penetration testing** regular

## Documentación de APIs

### RESTful APIs
```typescript
// Estructura estándar de respuestas
interface APIResponse<T> {
  data: T
  message: string
  status: 'success' | 'error'
  timestamp: string
}
```

### GraphQL Schema
```graphql
type Service {
  id: ID!
  folio: String!
  client: Client!
  operator: Operator
  crane: Crane
  status: ServiceStatus!
}
```

Esta arquitectura proporciona una base sólida y escalable para el crecimiento futuro del sistema TMS Grúas, manteniendo la flexibilidad para adaptarse a nuevos requerimientos y tecnologías.
