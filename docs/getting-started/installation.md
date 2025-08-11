# 📥 Guía de Instalación - TMS Grúas v2.1.0

## 🎯 Requisitos del Sistema

### Requisitos Mínimos
- **Node.js**: v18.0.0 o superior
- **NPM**: v8.0.0 o superior
- **RAM**: 4GB mínimo (8GB recomendado)
- **Almacenamiento**: 2GB libres
- **Navegador**: Chrome 90+, Firefox 88+, Safari 14+

### Requisitos de Desarrollo
```bash
# Verificar versiones instaladas
node --version    # >= 18.0.0
npm --version     # >= 8.0.0
git --version     # >= 2.28.0
```

## 🚀 Instalación Paso a Paso

### 1. Clonar el Repositorio
```bash
# Clonar el proyecto
git clone https://github.com/tu-empresa/tms-gruas-v2.git
cd tms-gruas-v2

# Cambiar a la rama principal
git checkout main
```

### 2. Instalar Dependencias
```bash
# Instalar paquetes
npm install

# Verificar que no hay vulnerabilidades críticas
npm audit
```

### 3. Configurar Variables de Entorno
```bash
# Copiar archivo de ejemplo
cp .env.example .env.local

# Editar variables necesarias
nano .env.local
```

#### Variables Obligatorias
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima

# App Configuration
VITE_APP_ENV=development
VITE_APP_VERSION=2.1.0
```

#### Variables Opcionales
```env
# Analytics (opcional)
VITE_ANALYTICS_ID=UA-XXXXXXXX-1

# Features Flags (opcional)
VITE_ENABLE_OFFLINE=true
VITE_ENABLE_PWA=true
```

### 4. Inicializar Base de Datos
```bash
# Ejecutar migraciones
npx supabase db reset

# Verificar conexión
npm run db:status
```

### 5. Ejecutar Aplicación
```bash
# Modo desarrollo
npm run dev

# La aplicación estará disponible en:
# http://localhost:5173
```

## 🔧 Configuración de Entorno de Desarrollo

### VSCode (Recomendado)
Instalar extensiones esenciales:
```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "supabase.supabase-vscode"
  ]
}
```

### Configuración de Prettier
```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Scripts de Desarrollo
```bash
# Servidor de desarrollo
npm run dev

# Build de producción
npm run build

# Preview del build
npm run preview

# Linting
npm run lint

# Formateo de código
npm run format

# Tests
npm run test
```

## 🐛 Solución de Problemas Comunes

### Error: "Node.js version not supported"
```bash
# Actualizar Node.js usando nvm
nvm install 18
nvm use 18
```

### Error: "npm install fails"
```bash
# Limpiar cache y reinstalar
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Error: "Cannot connect to Supabase"
1. Verificar que las variables de entorno están correctas
2. Comprobar que el proyecto Supabase está activo
3. Verificar conectividad de red

```bash
# Test de conectividad
curl https://tu-proyecto.supabase.co/rest/v1/
```

### Error: "Port 5173 already in use"
```bash
# Usar puerto diferente
npm run dev -- --port 3000
```

## ✅ Verificación de Instalación

### Checklist Post-Instalación
- [ ] Aplicación carga sin errores
- [ ] Login funciona correctamente
- [ ] Dashboard muestra datos
- [ ] Responsive funciona en móvil
- [ ] PWA se puede instalar

### Tests de Verificación
```bash
# Ejecutar suite de tests
npm run test

# Test de build
npm run build

# Test de linting
npm run lint:check
```

### URLs de Verificación
- **App Principal**: http://localhost:5173
- **Health Check**: http://localhost:5173/health
- **API Status**: http://localhost:5173/api/status

## 🎯 Próximos Pasos

1. **[⚙️ Configuración](configuration.md)**: Personalizar la aplicación
2. **[🎯 Primeros Pasos](first-steps.md)**: Guía de uso inicial
3. **[👨‍💼 Manual del Admin](../user-guides/admin-guide.md)**: Gestión del sistema

---

*¿Problemas durante la instalación? Consulta [Troubleshooting](../troubleshooting/common-issues.md)*