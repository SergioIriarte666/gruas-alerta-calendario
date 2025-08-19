# 🔄 Guía de Migración - TMS Grúas

## 📋 Contenido Consolidado

Esta guía consolida toda la información de migración dispersa en documentos anteriores en una ubicación centralizada.

### 🎯 Migraciones Disponibles

#### v1.0.0 → v2.0.0 (Sistema Responsivo)
- **Cambios Principales**: Implementación completa del sistema responsivo
- **Breaking Changes**: Actualización de componentes UI
- **Tiempo Estimado**: 2-4 horas
- **Estado**: ✅ Completado

#### v2.0.0 → v2.1.0 (Mejoras de Performance)
- **Cambios Principales**: Optimización de logging y refactoring de hooks
- **Breaking Changes**: Ninguno (backward compatible)
- **Tiempo Estimado**: 30 minutos
- **Estado**: ✅ Completado

---

## 🚀 Migración v2.0.0 → v2.1.0

### Preparación
```bash
# 1. Backup completo
git checkout -b backup-v2.0.0
git add -A && git commit -m "Backup antes de migración v2.1.0"

# 2. Crear rama de migración
git checkout main
git checkout -b migration-v2.1.0

# 3. Backup de base de datos
npm run db:backup
```

### Paso 1: Actualizar Dependencias
```bash
npm update
npm audit fix
```

### Paso 2: Migrar Sistema de Logging
```bash
# Ejecutar script de migración automática
npx ts-node scripts/migrate-console-logs.ts
```

**Resultado esperado:**
- ✅ 1,356 console.logs migrados al nuevo sistema
- ✅ Imports de logger agregados automáticamente
- ✅ Reducción de 40-60% en uso de memoria

### Paso 3: Actualizar TypeScript (Manual)
```json
// tsconfig.app.json
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitAny": true,
  "noFallthroughCasesInSwitch": true
}
```

### Paso 4: Verificar Funcionalidad
```bash
# Tests de integración
npm run test

# Build de producción
npm run build

# Verificar que no hay errores TypeScript
npm run type-check
```

### Paso 5: Desplegar
```bash
# Merge a main
git checkout main
git merge migration-v2.1.0

# Deploy
npm run deploy
```

---

## 🔙 Migración v1.0.0 → v2.0.0 (Histórica)

### ⚠️ Preparación Obligatoria

#### 1. Verificación de Versión Actual
```bash
# Verificar versión actual
grep '"version"' package.json

# Debe mostrar: "version": "1.0.0" o similar
```

#### 2. Backup Completo del Sistema
```bash
# Backup de código
git checkout -b backup-v1.0.0-$(date +%Y%m%d)
git add -A
git commit -m "Backup completo antes de migración v2.0.0"

# Backup de base de datos
npm run db:backup

# Backup de archivos de configuración
mkdir migration-backup
cp .env.local migration-backup/
cp -r public/uploads migration-backup/ 2>/dev/null || true
```

#### 3. Verificación de Dependencias
```bash
# Verificar Node.js
node --version  # Debe ser >= 18.0.0

# Verificar NPM
npm --version   # Debe ser >= 8.0.0

# Limpiar cache
npm cache clean --force
```

### 🔄 Proceso de Migración Automática

#### Paso 1: Descargar e Instalar v2.0.0
```bash
# Cambiar a rama principal
git checkout main

# Hacer pull de la última versión
git pull origin main

# Instalar nuevas dependencias
npm install
```

#### Paso 2: Actualizar Variables de Entorno
```bash
# Comparar archivos de entorno
diff .env.example .env.local

# Agregar nuevas variables para responsive system
echo "
# Responsive Configuration (v2.0.0)
VITE_ENABLE_RESPONSIVE=true
VITE_MOBILE_BREAKPOINT=768
VITE_TABLET_BREAKPOINT=1024
VITE_PWA_ENABLED=true
" >> .env.local
```

#### Paso 3: Migrar Base de Datos
```bash
# Ejecutar migraciones automáticas
npm run migrate:v2.0.0

# Verificar migraciones
npm run db:status
```

#### Paso 4: Actualizar Customizaciones
```bash
# Ejecutar script de migración de componentes
npm run migrate:components

# Resultado esperado:
# ✅ Componentes UI actualizados al sistema responsivo
# ✅ Hooks responsivos agregados
# ✅ Breakpoints configurados
```

### 📱 Nuevas Funcionalidades v2.0.0

#### Hooks Responsivos Disponibles
```typescript
// useDeviceType - Detectar tipo de dispositivo
const { isMobile, isTablet, isDesktop } = useDeviceType();

// useBreakpoint - Manejar breakpoints
const { currentBreakpoint, isAbove, isBelow } = useBreakpoint();

// useOrientation - Detectar orientación
const { isPortrait, isLandscape } = useOrientation();
```

#### Componentes Mobile-First
- ✅ **ResponsiveTable**: Tablas que se convierten en cards en móvil
- ✅ **MobileNavigation**: Navegación hamburguesa para móvil
- ✅ **ResponsiveModal**: Modals que se adaptan al dispositivo
- ✅ **TouchOptimized**: Componentes optimizados para touch

### 🧪 Validación Post-Migración

#### Tests Obligatorios
```bash
# 1. Test de responsividad
npm run test:responsive

# 2. Test de compatibilidad móvil
npm run test:mobile

# 3. Test de PWA
npm run test:pwa

# 4. Test de regresión
npm run test:regression
```

#### Checklist de Validación Manual
- [ ] **Responsive Design**
  - [ ] Desktop (1920px): Layout completo visible
  - [ ] Tablet (768px): Navegación adaptada
  - [ ] Mobile (375px): Navegación hamburguesa
  - [ ] Formularios en 1 columna
  - [ ] Tablas como tarjetas

- [ ] **Funcionalidad Mobile**
  - [ ] Touch gestures funcionan
  - [ ] Elementos táctiles tienen tamaño adecuado (min 44px)
  - [ ] Navegación por swipe
  - [ ] Zoom y scroll nativos

- [ ] **PWA Features**
  - [ ] App se puede instalar
  - [ ] Funciona offline (modo básico)
  - [ ] Notificaciones push
  - [ ] Service worker registrado

- [ ] **Performance**
  - [ ] Lighthouse Score > 90
  - [ ] First Contentful Paint < 1.5s
  - [ ] Time to Interactive < 3s

### 🐛 Problemas Comunes y Soluciones

#### Error: "useDeviceType is not defined"
```bash
# Solución: Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

#### Error: "Responsive styles not working"
```bash
# Verificar que Tailwind está configurado correctamente
npm run build:css
```

#### Error: "PWA not installing"
```bash
# Verificar manifest.json y service worker
npm run pwa:validate
```

#### Error: "Mobile navigation not working"
```bash
# Verificar que los hooks están importados correctamente
grep -r "useDeviceType" src/
```

### 🔄 Rollback de Emergencia

Si algo sale mal durante la migración:

```bash
# 1. Rollback de código
git checkout backup-v1.0.0

# 2. Restaurar base de datos
npm run db:restore migration-backup/database.sql

# 3. Restaurar configuración
cp migration-backup/.env.local .env.local

# 4. Reinstalar dependencias v1.0.0
npm install

# 5. Verificar que todo funciona
npm run dev
```

### 📞 Soporte para Migración

Si encuentras problemas durante la migración:

1. **Revisar logs de migración** en `migration-backup/`
2. **Consultar troubleshooting** específico en [Problemas Comunes](../troubleshooting/common-issues.md)
3. **Contactar soporte técnico** con logs completos
4. **Rollback a v1.0.0** si es necesario

---

## 📈 Beneficios Post-Migración

### v2.1.0 (Última migración)
- **Performance**: 40-60% menos uso de memoria
- **Maintainability**: Código más modular y testeable
- **Developer Experience**: TypeScript estricto y mejor debugging

### v2.0.0 (Sistema Responsivo)
- **Mobile Experience**: Experiencia nativa en dispositivos móviles
- **PWA Features**: Instalación como app nativa
- **Performance**: Carga optimizada por dispositivo
- **User Experience**: Interfaz adaptativa automática

---

*¿Problemas durante la migración? Consulta [Troubleshooting](../troubleshooting/common-issues.md) o contacta soporte técnico.*