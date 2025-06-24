
# TMS Grúas - Sistema de Gestión de Servicios de Grúas

## 🚛 Descripción

TMS Grúas es un sistema integral de gestión para empresas de servicios de grúas que permite administrar de manera eficiente todos los aspectos del negocio: servicios, clientes, operadores, equipos, facturación y reportes.

## ✨ Características Principales

### 📊 Dashboard Ejecutivo
- Métricas en tiempo real de servicios y finanzas
- Alertas de vencimientos y documentos
- Gráficos de performance y tendencias

### 🚚 Gestión de Servicios
- Creación y seguimiento completo de servicios
- Asignación automática de recursos (grúas y operadores)
- Estados de servicio en tiempo real
- Geolocalización de origen y destino

### 👥 Portal del Operador
- Aplicación móvil para operadores en terreno
- Sistema de inspecciones con fotos y firmas digitales
- Generación automática de PDFs de inspección
- Notificaciones de servicios asignados

### 🏢 Portal de Clientes
- Autoservicio para visualizar historial de servicios
- Descarga de facturas y documentos
- Solicitud de nuevos servicios online
- Seguimiento en tiempo real

### 💰 Módulo Financiero
- Facturación automática desde cierres de servicios
- Control de costos operativos
- Reportes de rentabilidad
- Gestión de cobranzas

### 📋 Gestión de Recursos
- Control de flota de grúas
- Gestión de operadores y licencias
- Alertas de vencimientos de documentos
- Mantenimiento preventivo

## 🛠️ Tecnologías

### Frontend
- **React 18** + **TypeScript** para una experiencia moderna
- **Vite** para desarrollo rápido y builds optimizados
- **Tailwind CSS** + **shadcn/ui** para diseño consistente
- **React Query** para gestión de estado servidor
- **React Router** para navegación

### Backend
- **Supabase** como Backend-as-a-Service
- **PostgreSQL** con Row Level Security
- **Edge Functions** para lógica serverless
- **Resend** para emails transaccionales

### Herramientas
- **jsPDF** para generación de documentos
- **React Hook Form** + **Zod** para formularios y validación
- **Lucide React** para iconografía
- **Sonner** para notificaciones

## 🚀 Instalación Rápida

### Prerrequisitos
- Node.js 18+ 
- npm 8+
- Cuenta en Supabase

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-empresa/tms-gruas.git
cd tms-gruas

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 4. Iniciar el servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 📚 Documentación

### Guías de Usuario
- **[Manual de Usuario](docs/MANUAL_USUARIO.md)** - Guía completa para usar el sistema
- **[Guía de Instalación](docs/GUIA_INSTALACION.md)** - Instrucciones detalladas de instalación

### Documentación Técnica
- **[Arquitectura del Sistema](docs/ARQUITECTURA.md)** - Diseño y patrones arquitectónicos
- **[Documentación Técnica](docs/DOCUMENTACION_TECNICA.md)** - APIs, hooks y componentes

## 🏗️ Estructura del Proyecto

```
src/
├── components/          # Componentes React organizados por módulo
│   ├── ui/             # Componentes base de shadcn/ui
│   ├── layout/         # Layouts y navegación
│   ├── services/       # Componentes de servicios
│   ├── portal/         # Portal de clientes y operadores
│   └── ...             # Otros módulos
├── hooks/              # Hooks personalizados por funcionalidad
│   ├── services/       # Hooks de servicios
│   ├── inspection/     # Hooks de inspecciones
│   └── ...             # Otros hooks especializados
├── pages/              # Páginas principales
├── contexts/           # Contextos de React
├── types/              # Definiciones de tipos TypeScript
├── utils/              # Utilidades y helpers
└── schemas/            # Esquemas de validación Zod
```

## 🎯 Características Técnicas

### Seguridad
- ✅ Row Level Security (RLS) en base de datos
- ✅ Autenticación JWT con refresh automático
- ✅ Roles y permisos granulares
- ✅ Validación de datos en cliente y servidor

### Performance
- ✅ Code splitting y lazy loading
- ✅ Optimización de imágenes automática
- ✅ Cache inteligente con React Query
- ✅ PWA para uso offline

### Escalabilidad
- ✅ Arquitectura serverless
- ✅ Base de datos PostgreSQL escalable
- ✅ CDN para assets estáticos
- ✅ Monitoreo y métricas integradas

## 👥 Roles de Usuario

### 🔑 Administrador
- Acceso completo al sistema
- Gestión de usuarios y configuración
- Reportes ejecutivos y financieros

### 🚛 Operador
- Portal móvil optimizado
- Gestión de inspecciones
- Visualización de servicios asignados

### 🏢 Cliente
- Portal de autoservicio
- Historial de servicios
- Facturación y documentos

### 👁️ Visualizador
- Acceso de solo lectura
- Reportes básicos
- Dashboard de métricas

## 📱 Módulos Principales

### 1. Dashboard
Tablero ejecutivo con métricas clave, alertas y gráficos en tiempo real.

### 2. Servicios
Gestión completa del ciclo de vida de servicios desde creación hasta facturación.

### 3. Clientes
Base de datos completa de clientes con historial y análisis.

### 4. Operadores
Gestión de operadores, licencias y asignaciones de servicios.

### 5. Grúas
Control de flota con mantenimiento y documentación.

### 6. Facturación
Sistema completo de facturación con cierres de servicios.

### 7. Costos
Control de gastos operativos y análisis de rentabilidad.

### 8. Reportes
Generación de reportes en PDF y Excel con múltiples filtros.

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Inicia servidor de desarrollo
npm run build        # Construye para producción
npm run preview      # Vista previa del build

# Testing
npm run test         # Ejecuta tests
npm run test:ui      # Interface de testing
npm run coverage     # Reporte de cobertura

# Calidad de Código
npm run lint         # ESLint
npm run type-check   # Verificación de tipos TypeScript

# Base de Datos
npm run db:push      # Aplicar cambios a Supabase
npm run db:reset     # Resetear base de datos
```

## 🌐 Deployment

### Producción Recomendada
- **Frontend**: Vercel, Netlify o similar
- **Backend**: Supabase (incluido)
- **CDN**: Cloudflare
- **Monitoreo**: Sentry + Supabase Analytics

### Variables de Entorno Requeridas
```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_RESEND_API_KEY=tu_resend_api_key
```

## 🤝 Contribución

### Proceso de Desarrollo
1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit de cambios (`git commit -m 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

### Estándares de Código
- TypeScript strict mode
- ESLint + Prettier
- Conventional Commits
- Tests unitarios para nuevas funcionalidades

## 📊 Roadmap

### Q1 2024
- [ ] Migración a React Server Components
- [ ] Implementación de WebSockets para updates en tiempo real
- [ ] API para integraciones externas

### Q2 2024
- [ ] Aplicación móvil nativa
- [ ] Módulo de mantenimiento predictivo
- [ ] Dashboard analítico avanzado

### Q3 2024
- [ ] Integración con GPS/IoT
- [ ] Sistema de notificaciones push
- [ ] Módulo de recursos humanos

## 📞 Soporte

### Canales de Soporte
- **Email**: soporte@tmsgruas.com
- **Documentación**: [wiki.tmsgruas.com]
- **Issues**: [GitHub Issues](https://github.com/tu-empresa/tms-gruas/issues)

### Horarios de Atención
- **Lunes a Viernes**: 9:00 - 18:00 (CLT)
- **Sábados**: 9:00 - 13:00 (CLT)
- **Emergencias**: 24/7

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- Equipo de desarrollo de TMS Grúas
- Comunidad open source
- Clientes beta testers
- Supabase por la plataforma backend

---

**Hecho con ❤️ para la industria de servicios de grúas**

[![Deployed on Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/tu-empresa/tms-gruas)
