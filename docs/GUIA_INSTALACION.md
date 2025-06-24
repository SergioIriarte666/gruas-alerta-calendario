
# Guía de Instalación - TMS Grúas

## Requisitos del Sistema

### Requisitos Mínimos de Hardware
- **CPU**: 2 cores, 2.0 GHz
- **RAM**: 4 GB
- **Almacenamiento**: 10 GB libres
- **Red**: Conexión a internet estable

### Requisitos Recomendados
- **CPU**: 4 cores, 2.5 GHz o superior
- **RAM**: 8 GB o más
- **Almacenamiento**: SSD con 20 GB libres
- **Red**: Banda ancha 10 Mbps o superior

### Software Requerido
- **Node.js**: Versión 18 o superior
- **npm**: Versión 8 o superior (incluido con Node.js)
- **Git**: Para control de versiones
- **Navegador web moderno**: Chrome, Firefox, Safari, Edge

## Instalación en Desarrollo

### 1. Preparación del Entorno

#### Instalación de Node.js
1. Descargar desde [nodejs.org](https://nodejs.org/)
2. Ejecutar el instalador
3. Verificar instalación:
```bash
node --version
npm --version
```

#### Instalación de Git
1. Descargar desde [git-scm.com](https://git-scm.com/)
2. Seguir el asistente de instalación
3. Configurar usuario:
```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"
```

### 2. Clonación del Repositorio

```bash
# Clonar el repositorio
git clone https://github.com/tu-empresa/tms-gruas.git

# Navegar al directorio
cd tms-gruas

# Verificar estructura
ls -la
```

### 3. Instalación de Dependencias

```bash
# Instalar dependencias del proyecto
npm install

# Verificar instalación
npm list --depth=0
```

### 4. Configuración del Entorno

#### Crear archivo de variables de entorno
```bash
# Copiar template de configuración
cp .env.example .env.local

# Editar variables de entorno
nano .env.local
```

#### Variables de entorno requeridas
```env
# Supabase Configuration
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key

# Email Configuration
VITE_RESEND_API_KEY=tu_resend_api_key

# App Configuration
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=TMS Grúas
```

### 5. Configuración de Supabase

#### Crear proyecto en Supabase
1. Ir a [supabase.com](https://supabase.com/)
2. Crear nueva cuenta o iniciar sesión
3. Crear nuevo proyecto
4. Copiar URL y API Key

#### Configurar base de datos
```bash
# Instalar Supabase CLI
npm install -g @supabase/cli

# Inicializar Supabase
supabase init

# Enlazar proyecto
supabase link --project-ref tu-project-ref

# Ejecutar migraciones
supabase db push
```

### 6. Primer Inicio

```bash
# Iniciar servidor de desarrollo
npm run dev

# La aplicación estará disponible en:
# http://localhost:5173
```

## Instalación en Producción

### 1. Preparación del Servidor

#### Requisitos del Servidor
- **OS**: Ubuntu 20.04 LTS o CentOS 8
- **RAM**: Mínimo 2 GB
- **CPU**: 2 cores
- **Almacenamiento**: 20 GB SSD
- **Certificado SSL**: Requerido para HTTPS

#### Instalación de Node.js en Ubuntu
```bash
# Actualizar sistema
sudo apt update
sudo apt upgrade -y

# Instalar Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version
npm --version
```

### 2. Configuración del Proyecto

```bash
# Crear usuario para la aplicación
sudo useradd -m -s /bin/bash tmsgruas

# Cambiar a usuario de aplicación
sudo su - tmsgruas

# Clonar repositorio
git clone https://github.com/tu-empresa/tms-gruas.git
cd tms-gruas

# Instalar dependencias de producción
npm ci --only=production

# Construir aplicación
npm run build
```

### 3. Configuración de Variables de Entorno

```bash
# Crear archivo de producción
sudo nano /etc/environment

# Agregar variables
VITE_SUPABASE_URL=tu_supabase_production_url
VITE_SUPABASE_ANON_KEY=tu_supabase_production_anon_key
VITE_RESEND_API_KEY=tu_resend_production_api_key
VITE_APP_URL=https://tu-dominio.com
```

### 4. Configuración de Nginx

#### Instalación de Nginx
```bash
sudo apt install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
```

#### Configuración del sitio
```bash
sudo nano /etc/nginx/sites-available/tmsgruas
```

Contenido del archivo:
```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;
    
    root /home/tmsgruas/tms-gruas/dist;
    index index.html;
    
    # Configuración para SPA
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Configuración de cache para assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Configuración de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

#### Activar configuración
```bash
sudo ln -s /etc/nginx/sites-available/tmsgruas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Configuración de SSL con Certbot

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com

# Configurar renovación automática
sudo crontab -e
# Agregar línea:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 6. Configuración de PM2 (Opcional para apps con backend)

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Crear archivo de configuración
nano ecosystem.config.js
```

Contenido del archivo:
```javascript
module.exports = {
  apps: [{
    name: 'tms-gruas',
    script: 'serve',
    args: '-s dist -l 3000',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

```bash
# Iniciar aplicación
pm2 start ecosystem.config.js

# Configurar inicio automático
pm2 startup
pm2 save
```

## Configuración de Base de Datos

### 1. Migraciones de Producción

```bash
# Configurar Supabase CLI para producción
supabase link --project-ref tu-proyecto-produccion

# Aplicar migraciones
supabase db push --include-seed
```

### 2. Configuración de Policies

```sql
-- Habilitar RLS en todas las tablas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
-- ... continuar con todas las tablas
```

### 3. Seed Data (Datos Iniciales)

```sql
-- Insertar usuario administrador inicial
INSERT INTO profiles (id, email, full_name, role) VALUES
('00000000-0000-0000-0000-000000000000', 'admin@tuempresa.com', 'Administrador', 'admin');

-- Insertar configuración inicial de empresa
INSERT INTO company_data (business_name, rut, address, phone, email) VALUES
('Tu Empresa de Grúas', '12.345.678-9', 'Dirección de tu empresa', '+56 2 1234 5678', 'contacto@tuempresa.com');
```

## Verificación de Instalación

### 1. Tests de Funcionalidad

```bash
# Ejecutar tests unitarios
npm run test

# Ejecutar tests de integración
npm run test:integration

# Verificar build de producción
npm run build
npm run preview
```

### 2. Verificación de Acceso

#### Verificar acceso web
- Abrir navegador en `https://tu-dominio.com`
- Verificar carga correcta de la aplicación
- Probar login con usuario administrador

#### Verificar funcionalidades críticas
- [ ] Login de usuarios
- [ ] Creación de servicios
- [ ] Generación de PDFs
- [ ] Envío de emails
- [ ] Backup de datos

### 3. Monitoreo de Logs

```bash
# Ver logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Ver logs de aplicación (si usa PM2)
pm2 logs tms-gruas

# Ver logs del sistema
sudo journalctl -f -u nginx
```

## Respaldo y Recuperación

### 1. Configuración de Respaldos

#### Script de respaldo automático
```bash
#!/bin/bash
# Crear archivo: /home/tmsgruas/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/tms-gruas"
APP_DIR="/home/tmsgruas/tms-gruas"

# Crear directorio de respaldo
mkdir -p $BACKUP_DIR

# Respaldar archivos de aplicación
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C $APP_DIR .

# Respaldar base de datos (usando Supabase CLI)
supabase db dump --file $BACKUP_DIR/db_$DATE.sql

# Limpiar respaldos antiguos (mantener últimos 7 días)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
```

#### Configurar cron para respaldos
```bash
sudo crontab -e
# Agregar línea para respaldo diario a las 2 AM:
# 0 2 * * * /home/tmsgruas/backup.sh
```

### 2. Procedimiento de Recuperación

```bash
# Restaurar aplicación desde respaldo
cd /home/tmsgruas
tar -xzf /backups/tms-gruas/app_YYYYMMDD_HHMMSS.tar.gz

# Restaurar base de datos
supabase db reset --file /backups/tms-gruas/db_YYYYMMDD_HHMMSS.sql

# Reiniciar servicios
sudo systemctl restart nginx
pm2 restart tms-gruas
```

## Solución de Problemas

### Problemas Comunes

#### Error: "Module not found"
```bash
# Limpiar cache de npm
npm cache clean --force
rm -rf node_modules
npm install
```

#### Error: "Permission denied"
```bash
# Verificar permisos de archivos
sudo chown -R tmsgruas:tmsgruas /home/tmsgruas/tms-gruas
sudo chmod -R 755 /home/tmsgruas/tms-gruas
```

#### Error: "Connection refused"
```bash
# Verificar estado de servicios
sudo systemctl status nginx
pm2 status

# Verificar puertos abiertos
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

#### Problemas de Supabase
```bash
# Verificar conectividad
curl -I https://tu-proyecto.supabase.co/rest/v1/

# Verificar variables de entorno
env | grep VITE_SUPABASE
```

### Logs Útiles

```bash
# Logs de aplicación
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Logs del sistema
journalctl -xe
journalctl -f -u nginx

# Logs de PM2 (si aplica)
pm2 logs --lines 100
```

## Mantenimiento

### Actualizaciones

#### Actualización de la aplicación
```bash
# Cambiar a usuario de aplicación
sudo su - tmsgruas

# Actualizar código
git pull origin main

# Instalar nuevas dependencias
npm ci --only=production

# Construir nueva versión
npm run build

# Reiniciar servicios
pm2 restart tms-gruas
```

#### Actualización de dependencias
```bash
# Verificar dependencias desactualizadas
npm outdated

# Actualizar dependencias
npm update

# Actualizar dependencias principales
npm install @latest
```

### Monitoreo Continuo

#### Métricas a monitorear
- CPU y memoria del servidor
- Espacio en disco
- Conexiones de red
- Errores en logs
- Tiempo de respuesta de la aplicación

#### Alertas recomendadas
- Uso de CPU > 80%
- Uso de memoria > 85%
- Espacio en disco < 2GB
- Aplicación no responde
- Errores 5xx > 1%

## Contacto para Soporte

### Soporte Técnico
- **Email**: soporte@tmsgruas.com
- **Teléfono**: +56 2 1234 5678
- **Horario**: Lunes a Viernes, 9:00 - 18:00

### Emergencias (24/7)
- **Teléfono**: +56 9 8765 4321
- **Email**: emergencias@tmsgruas.com

### Documentación Adicional
- Wiki del proyecto: [wiki.tmsgruas.com]
- Base de conocimientos: [kb.tmsgruas.com]
- Repositorio: [github.com/tmsgruas/tms-system]
