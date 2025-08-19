# Preguntas Frecuentes (FAQ) - TMS Grúas

## Instalación y Configuración

### ¿Qué requisitos necesito para instalar TMS Grúas?

**Requisitos del Sistema:**
- Node.js 18 o superior
- npm 8+ (o yarn/pnpm equivalente)
- Navegador moderno con soporte ES2020+
- Conexión a internet para Supabase

**Cuentas Necesarias:**
- Cuenta de Supabase (gratuita disponible)
- Cuenta de email para invitaciones (opcional)

### ¿Por qué no puedo conectar con la base de datos?

**Verificar Configuración:**
```bash
# Revisar variables de entorno
cat .env.local

# Deben estar presentes:
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu_clave_anonima
```

**Problemas Comunes:**
- URLs de Supabase incorrectas
- Claves API mal copiadas
- Proyecto Supabase pausado (plan gratuito)
- Políticas RLS muy restrictivas

### ¿Cómo configurar el sistema para mi empresa?

1. **Datos de Empresa:** Ir a Configuración > Empresa
2. **Usuarios:** Crear usuarios vía Configuración > Usuarios
3. **Tipos de Servicio:** Personalizar en Configuración > Tipos de Servicio
4. **Grúas y Operadores:** Agregar recursos en sus respectivos módulos

## Responsive Design y Móviles

### ¿Por qué la app se ve rara en mi móvil?

**Verificaciones:**
1. **Navegador actualizado:** Usar Chrome, Safari o Firefox actualizados
2. **Zoom del navegador:** Asegurar zoom al 100%
3. **Orientación:** Probar en portrait y landscape
4. **Caché:** Limpiar caché del navegador

**Dispositivos Soportados:**
- Móviles: >= 375px de ancho
- Tablets: 768px - 1023px
- Desktop: >= 1024px

### ¿Cómo instalar la app como PWA en mi móvil?

**Android (Chrome):**
1. Abrir el sitio en Chrome
2. Tocar menú (⋯) > "Agregar a pantalla de inicio"
3. Confirmar instalación

**iOS (Safari):**
1. Abrir el sitio en Safari
2. Tocar botón compartir (□↗)
3. Seleccionar "Agregar a pantalla de inicio"

**Verificar PWA:**
- Ícono aparece en pantalla de inicio
- Se abre sin barras de navegador
- Funciona parcialmente offline

### ¿Por qué algunos botones son difíciles de tocar en móvil?

Esto puede deberse a:
- **Tamaño insuficiente:** Los botones deben ser mínimo 44px
- **Espaciado:** Falta espacio entre elementos táctiles
- **Zoom del navegador:** Verificar que esté al 100%

**Solución temporal:** Hacer zoom en la página para elementos pequeños.

## Gestión de Usuarios

### ¿Cómo invitar nuevos usuarios?

1. **Ir a Configuración > Usuarios**
2. **Clic en "Nuevo Usuario"**
3. **Completar formulario:**
   - Email válido
   - Nombre completo
   - Rol apropiado
   - Cliente (si es rol "client")
4. **Enviar invitación**

**El usuario recibirá:**
- Email con link de registro
- Instrucciones de acceso
- Link válido por 7 días

### ¿Qué roles de usuario existen?

**Administrador:**
- Acceso completo al sistema
- Gestión de usuarios e invitaciones
- Configuración de empresa
- Reportes financieros

**Operador:**
- Portal móvil optimizado
- Inspecciones digitales
- Gestión de servicios asignados
- Acceso limitado a sus servicios

**Cliente:**
- Portal independiente
- Solicitud de servicios
- Visualización de historial
- Descarga de documentos

**Visualizador:**
- Solo lectura
- Dashboard básico
- Reportes limitados

### ¿Cómo cambiar el rol de un usuario?

**Solo Administradores pueden:**
1. Ir a Configuración > Usuarios
2. Seleccionar usuario
3. Editar rol en el formulario
4. Guardar cambios

**Nota:** El cambio es inmediato pero el usuario debe cerrar sesión y volver a entrar.

## Portal de Operadores

### ¿Cómo hacer una inspección digital?

1. **Acceder al portal de operadores**
2. **Seleccionar servicio pendiente**
3. **Completar inspección:**
   - Checklist de equipamiento
   - Fotos antes del servicio
   - Fotos del vehículo cliente
   - Fotos del equipo usado
   - Observaciones del vehículo
   - Firma del operador
4. **Enviar inspección**

**La inspección genera:**
- PDF automático
- Email al cliente
- Actualización de estado del servicio

### ¿Por qué no puedo tomar fotos en el móvil?

**Permisos de Cámara:**
1. Verificar permisos del navegador
2. En Chrome: Configuración > Privacidad > Cámara
3. Permitir acceso para el sitio web

**Problemas Comunes:**
- Navegador sin permisos de cámara
- Conexión inestable
- Espacio insuficiente en dispositivo
- Navegador muy antiguo

### ¿Las inspecciones funcionan offline?

**Funcionalidad Offline:**
- ✅ Completar formularios
- ✅ Tomar fotos localmente
- ✅ Guardar firmas
- ❌ Envío inmediato (requiere conexión)

**Al recuperar conexión:**
- Las inspecciones se sincronizan automáticamente
- Se envían emails pendientes
- Se actualizan estados de servicios

## Portal de Clientes

### ¿Cómo puede un cliente solicitar un servicio?

1. **Acceder al portal de clientes**
2. **Clic en "Solicitar Servicio"**
3. **Completar formulario:**
   - Tipo de servicio
   - Fechas deseadas
   - Información del vehículo
   - Ubicaciones
   - Observaciones especiales
4. **Enviar solicitud**

**El administrador recibe:**
- Notificación de nueva solicitud
- Formulario para crear servicio oficial
- Información completa del cliente

### ¿Por qué mi cliente no puede acceder a su portal?

**Verificaciones:**
1. **Usuario creado:** Cliente debe estar registrado en el sistema
2. **Rol correcto:** Usuario debe tener rol "client"
3. **Cliente asignado:** Perfil debe estar vinculado a cliente específico
4. **Invitación aceptada:** Cliente debe haber completado registro

**Pasos para solucionarlo:**
1. Verificar en Configuración > Usuarios
2. Editar usuario y asignar cliente correcto
3. Reenviar invitación si es necesario

## Servicios y Operaciones

### ¿Cómo configurar tipos de servicio personalizados?

1. **Ir a Configuración > Tipos de Servicio**
2. **Crear nuevo tipo:**
   - Nombre descriptivo
   - Precio base (opcional)
   - Campos requeridos:
     - ¿Requiere grúa?
     - ¿Requiere operador?
     - ¿Información vehículo opcional?
     - ¿Orden de compra requerida?

**Campos de Vehículo:**
- Marca: ¿requerida?
- Modelo: ¿requerido?
- Patente: ¿requerida?
- Info opcional: ¿se puede omitir todo?

### ¿Por qué no aparecen algunos campos en el formulario de servicio?

**Lógica de Campos Dinámicos:**
Los campos de vehículo se muestran según la configuración del tipo de servicio:

```typescript
// Si el tipo de servicio tiene vehicle_info_optional = true
// Y no requiere marca, modelo ni patente específicamente
// Los campos se ocultan automáticamente
```

**Para mostrar campos:**
1. Editar tipo de servicio
2. Desmarcar "Información de vehículo opcional"
3. O marcar campos específicos como requeridos

### ¿Cómo funcionan los folios automáticos?

**Configuración de Folios:**
1. Ir a Configuración > Empresa
2. Configurar "Formato de Folio": `SRV-{number}`
3. "Próximo Número": Se incrementa automáticamente

**Formatos Soportados:**
- `SRV-{number}` → SRV-1001, SRV-1002
- `{number}` → 1001, 1002
- `GRUA-{number}` → GRUA-1001, GRUA-1002

## Facturación y Cierres

### ¿Cómo hacer un cierre de servicios?

1. **Ir a Cierres y Facturación**
2. **Clic en "Nuevo Cierre"**
3. **Seleccionar período:**
   - Fecha desde
   - Fecha hasta
   - Cliente (opcional, todos si se omite)
4. **Revisar servicios incluidos**
5. **Crear cierre**

**El cierre incluye:**
- Todos los servicios completados en el período
- Cálculo automático de totales
- Posibilidad de generar factura

### ¿Por qué algunos servicios no aparecen en el cierre?

**Servicios Incluidos:**
- Estado: "completed" o "invoiced"
- Fecha de servicio dentro del período
- Cliente coincidente (si se especifica)

**Servicios Excluidos:**
- Estado "pending" o "cancelled"
- Ya incluidos en otro cierre
- Fuera del rango de fechas

## Performance y Troubleshooting

### ¿Por qué la app va lenta en mi dispositivo?

**Optimizaciones Móviles:**
1. **Cerrar otras pestañas** del navegador
2. **Limpiar caché** del navegador
3. **Verificar conexión** a internet
4. **Actualizar navegador** a última versión

**Dispositivos con Rendimiento Limitado:**
- La app ajusta automáticamente calidad de imágenes
- Reduce animaciones en dispositivos lentos
- Carga componentes bajo demanda

### ¿Qué hacer si encuentro un error?

**Pasos Inmediatos:**
1. **Refrescar página** (F5 o pull-to-refresh en móvil)
2. **Cerrar sesión y volver a entrar**
3. **Limpiar caché del navegador**
4. **Probar en navegador diferente**

**Información para Reportar:**
- URL donde ocurre el error
- Pasos para reproducir
- Tipo de dispositivo y navegador
- Screenshot del error
- Mensajes en consola (F12 > Console)

### ¿Los datos están seguros?

**Seguridad Implementada:**
- ✅ **Encriptación HTTPS** en toda comunicación
- ✅ **Row Level Security (RLS)** en base de datos
- ✅ **Autenticación JWT** con expiración
- ✅ **Backups automáticos** diarios
- ✅ **Auditoría de acciones** críticas

**Privacidad:**
- Cada usuario solo ve sus datos permitidos
- Clientes solo acceden a sus servicios
- Operadores solo ven servicios asignados
- Administradores tienen control total

## Integración y Extensiones

### ¿Se puede integrar con otros sistemas?

**APIs Disponibles:**
- Supabase REST API para integración externa
- Webhooks para notificaciones en tiempo real
- Export de datos en CSV/Excel

**Integraciones Comunes:**
- Sistemas de facturación externa
- GPS tracking de vehículos
- Sistemas de gestión empresarial (ERP)

### ¿Cómo exportar datos del sistema?

**Métodos de Export:**
1. **Reportes built-in:** PDF y Excel desde interfaz
2. **Base de datos:** Backup completo desde Supabase
3. **API REST:** Consultas programáticas

**Datos Exportables:**
- Servicios por período
- Facturas y cierres
- Listados de clientes/operadores
- Métricas y reportes

## Soporte Técnico

### ¿Dónde obtener ayuda adicional?

**Recursos Disponibles:**
- 📖 **Documentación:** Carpeta `docs/` completa
- 🔧 **Issues GitHub:** Para reportar bugs
- 📧 **Email soporte:** Para consultas directas
- 💬 **Documentación en línea:** Guías actualizadas

### ¿Con qué frecuencia se actualiza el sistema?

**Ciclo de Actualizaciones:**
- **Patches de seguridad:** Inmediato
- **Correcciones de bugs:** Semanal
- **Nuevas funcionalidades:** Mensual
- **Versiones mayores:** Trimestral

**Notificaciones de Actualización:**
- PWA muestra notificación de actualización disponible
- Cambios importantes se comunican por email
- Changelog disponible en documentación

---

### ¿No encuentras tu pregunta?

Consulta la [documentación completa](./README.md) o reporta tu pregunta como issue en el repositorio.