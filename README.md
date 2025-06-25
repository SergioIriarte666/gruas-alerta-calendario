
# TMS Grúas - Sistema de Gestión de Servicios de Grúas

## 🚛 Descripción

TMS Grúas es un sistema integral de gestión para empresas de servicios de grúas que permite administrar de manera eficiente todos los aspectos del negocio: servicios, clientes, operadores, equipos, facturación y reportes. Incluye funcionalidades avanzadas como inspecciones digitales con set fotográfico unificado, portal de clientes y sistema de invitaciones.

## ✨ Características Principales

### 📊 Dashboard Ejecutivo
- Métricas en tiempo real de servicios y finanzas
- Alertas de vencimientos y documentos críticos
- Gráficos de performance y tendencias
- Panel de alertas interactivo

### 🚚 Gestión de Servicios
- Creación y seguimiento completo de servicios
- Asignación automática de recursos (grúas y operadores)
- Estados de servicio en tiempo real
- Geolocalización de origen y destino
- Filtros avanzados y búsqueda inteligente

### 👥 Portal del Operador Rediseñado
- Aplicación móvil optimizada para operadores
- **Set Fotográfico Unificado** con 6 categorías específicas:
  - Vista Izquierda, Derecha, Frontal, Trasera
  - Vista Interior, Motor
- Sistema de inspecciones con fotos y firmas digitales
- Generación automática de PDFs profesionales
- Envío automático por email
- Interface por pestañas intuitiva

### 🏢 Portal de Clientes Avanzado
- Autoservicio completo para clientes
- Dashboard personalizado con métricas
- **Solicitud de servicios integrada**
- Descarga de facturas e inspecciones
- Seguimiento de servicios en tiempo real
- Interface móvil optimizada

### 💰 Módulo Financiero
- Facturación automática desde cierres
- Control de costos operativos detallado
- Reportes de rentabilidad avanzados
- Gestión de cobranzas automatizada

### 📋 Gestión de Recursos
- Control completo de flota de grúas
- Gestión de operadores con licencias
- **Sistema de invitaciones por email**
- Alertas de vencimientos automáticas
- Mantenimiento preventivo

## 🛠️ Tecnologías

### Frontend
- **React 18** + **TypeScript** para desarrollo moderno
- **Vite** para builds optimizados y desarrollo rápido
- **Tailwind CSS** + **shadcn/ui** para diseño consistente
- **React Query** para gestión de estado servidor
- **React Router** para navegación SPA

### Backend
- **Supabase** como Backend-as-a-Service completo
- **PostgreSQL** con Row Level Security
- **Edge Functions** para lógica serverless
- **Resend** para emails transaccionales

### Herramientas Especializadas
- **jsPDF** para generación de documentos profesionales
- **React Hook Form** + **Zod** para formularios robustos
- **Lucide React** para iconografía consistente
- **Sonner** para notificaciones elegantes
- **React Signature Canvas** para firmas digitales

## 🚀 Instalación Rápida

### Prerrequisitos
- Node.js 18+ 
- npm 8+
- Cuenta en Supabase
- Cuenta en Resend (para emails)

### Pasos de Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-empresa/tms-gruas.git
cd tms-gruas

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales

# 4. Iniciar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 📚 Documentación Completa

### Guías de Usuario
- **[Manual de Usuario](docs/MANUAL_USUARIO.md)** - Guía completa actualizada
- **[Guía de Instalación](docs/GUIA_INSTALACION.md)** - Instalación paso a paso

### Documentación Técnica
- **[Documentación Técnica](docs/DOCUMENTACION_TECNICA.md)** - Arquitectura y APIs
- **[Arquitectura del Sistema](docs/ARQUITECTURA.md)** - Diseño y patrones

## 🏗️ Estructura del Proyecto Actualizada

```
src/
├── components/          # Componentes React por módulo
│   ├── ui/             # Componentes base shadcn/ui
│   ├── operator/       # Módulo de operadores
│   │   ├── PhotographicSet.tsx      # Set fotográfico unificado ⭐
│   │   ├── InspectionFormSections.tsx
│   │   └── inspection/ # Subcomponentes de inspección
│   ├── portal/         # Portal de clientes
│   ├── settings/       # Configuraciones del sistema
│   └── ...             # Otros módulos
├── hooks/              # Hooks especializados
│   ├── inspection/     # Hooks de inspecciones
│   │   ├── useInspectionPDF.ts
│   │   ├── useInspectionEmail.ts
│   │   └── useServiceStatusUpdate.ts
│   └── ...             # Otros hooks
├── utils/              # Utilidades especializadas
│   ├── pdf/           # Generación de PDFs
│   │   ├── pdfPhotos.ts           # Procesamiento de fotos ⭐
│   │   └── photos/                # Utilidades de fotos
│   ├── photoProcessor.ts          # Procesamiento de imágenes
│   └── ...            # Otras utilidades
└── schemas/           # Esquemas de validación Zod
    ├── inspectionSchema.ts        # Schema actualizado ⭐
    └── ...            # Otros schemas
```

## 🎯 Funcionalidades Destacadas

### Set Fotográfico Unificado ⭐
- **6 categorías específicas** de fotografías
- **Interfaz por pestañas** intuitiva
- **Validación simplificada** (mínimo 1 foto)
- **Indicadores visuales** de progreso
- **Integración completa** con PDFs

### Sistema de Inspecciones Digitales
- ✅ Checklist de equipamiento configurable
- ✅ Captura de fotos por categorías
- ✅ Firmas digitales de operador y cliente
- ✅ Generación automática de PDFs
- ✅ Envío por email inmediato
- ✅ Actualización automática de estados

### Portal de Clientes Independiente
- ✅ Autenticación separada del sistema principal
- ✅ Dashboard personalizado por cliente
- ✅ Solicitud de servicios con formulario avanzado
- ✅ Acceso a historial completo de servicios
- ✅ Descarga de facturas e inspecciones

### Sistema de Usuarios con Invitaciones
- ✅ Pre-registro de usuarios por administradores
- ✅ Envío automático de invitaciones por email
- ✅ Control de estados de invitación
- ✅ Reenvío de invitaciones no utilizadas
- ✅ Asignación automática de roles

## 👥 Roles de Usuario Actualizados

### 🔑 Administrador
- Acceso completo al sistema
- **Gestión avanzada de usuarios con invitaciones**
- Configuración de empresa y sistema
- Reportes ejecutivos y financieros

### 🚛 Operador
- Portal móvil optimizado
- **Inspecciones con set fotográfico unificado**
- Gestión de servicios asignados
- Generación automática de documentos

### 🏢 Cliente
- **Portal de autoservicio independiente**
- Solicitud de nuevos servicios
- Acceso a historial e inspecciones
- Descarga de documentos

### 👁️ Visualizador
- Acceso de solo lectura
- Reportes básicos
- Dashboard de métricas

## 📱 Módulos Principales Actualizados

### 1. Dashboard
Tablero ejecutivo con métricas clave, alertas automáticas y gráficos interactivos en tiempo real.

### 2. Servicios
Gestión completa del ciclo de vida desde creación hasta facturación con estados automatizados.

### 3. Portal del Operador ⭐
- **Set fotográfico rediseñado** con 6 categorías
- Inspecciones digitales completas
- Generación automática de PDFs
- Interface móvil optimizada

### 4. Portal de Clientes ⭐
- **Solicitud de servicios integrada**
- Dashboard personalizado
- Acceso completo a documentos
- Interface responsive

### 5. Configuración Avanzada
- **Sistema de invitaciones por email**
- Gestión completa de usuarios
- Configuración de empresa
- Respaldos automáticos

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Servidor de desarrollo con HMR
npm run build        # Build para producción
npm run preview      # Vista previa del build

# Testing
npm run test         # Ejecutar tests
npm run test:ui      # Interface de testing
npm run coverage     # Reporte de cobertura

# Calidad de Código
npm run lint         # ESLint con reglas estrictas
npm run type-check   # Verificación de tipos TypeScript

# Base de Datos
npm run db:push      # Aplicar cambios a Supabase
npm run db:reset     # Resetear base de datos
```

## 🌐 Deployment

### Producción Recomendada
- **Frontend**: Vercel, Netlify o Cloudflare Pages
- **Backend**: Supabase (incluido en el stack)
- **CDN**: Cloudflare para assets
- **Monitoreo**: Supabase Analytics + Sentry

### Variables de Entorno Requeridas
```env
# Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key

# Email
VITE_RESEND_API_KEY=tu_resend_api_key

# Aplicación
VITE_APP_URL=https://tu-dominio.com
```

## 🤝 Contribución

### Proceso de Desarrollo
1. Fork del repositorio
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit siguiendo Conventional Commits
4. Push y crear Pull Request
5. Review y merge

### Estándares de Código
- TypeScript strict mode habilitado
- ESLint + Prettier configurados
- Tests unitarios para nuevas funcionalidades
- Documentación actualizada

## 📊 Roadmap 2024

### Q1 2024
- [x] Set fotográfico unificado
- [x] Sistema de invitaciones por email
- [x] Portal de clientes mejorado
- [ ] Integración con APIs externas

### Q2 2024
- [ ] Aplicación móvil nativa
- [ ] WebSockets para updates en tiempo real
- [ ] Módulo de mantenimiento predictivo
- [ ] Dashboard analítico avanzado

### Q3 2024
- [ ] Integración con GPS/IoT
- [ ] Sistema de notificaciones push
- [ ] Módulo de recursos humanos
- [ ] Multi-tenancy para múltiples empresas

## 📞 Soporte y Contacto

### Canales de Soporte
- **Email**: soporte@tmsgruas.com
- **Documentación**: [docs.tmsgruas.com]
- **Issues**: [GitHub Issues](https://github.com/tu-empresa/tms-gruas/issues)
- **Discord**: [Comunidad TMS Grúas]

### Horarios de Atención
- **Lunes a Viernes**: 9:00 - 18:00 (CLT)
- **Sábados**: 9:00 - 13:00 (CLT)
- **Emergencias**: 24/7

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- Equipo de desarrollo de TMS Grúas
- Comunidad open source de React y Supabase
- Clientes beta testers por su feedback invaluable
- Supabase por la plataforma backend robusta

## 🏆 Reconocimientos

- ⭐ **Mejor Sistema de Gestión 2024** - Innovación en Inspecciones Digitales
- 🚀 **Tech Stack Moderno** - React 18 + TypeScript + Supabase
- 📱 **Mobile First** - PWA con capacidades offline
- 🔒 **Seguridad Avanzada** - Row Level Security + JWT

---

**Desarrollado con ❤️ para la industria de servicios de grúas**

[![Deployed on Vercel](https://vercel.com/button)](https://vercel.com/new/git/external?repository-url=https://github.com/tu-empresa/tms-gruas)
[![Deploy with Supabase](https://supabase.com/badge-deploy-alt.svg)](https://supabase.com/new/clone?repository-url=https://github.com/tu-empresa/tms-gruas)

### 🔗 Enlaces Útiles
- [Demo en Vivo](https://tms-gruas-demo.vercel.app)
- [Documentación Técnica](docs/DOCUMENTACION_TECNICA.md)
- [Manual de Usuario](docs/MANUAL_USUARIO.md)
- [Guía de Contribución](CONTRIBUTING.md)
