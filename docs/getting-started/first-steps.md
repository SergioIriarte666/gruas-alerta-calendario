# 🎯 Primeros Pasos - TMS Grúas v2.1.0

## 🚀 Inicio Rápido (5 minutos)

### 1. Acceso Inicial
```bash
# Iniciar aplicación
npm run dev

# Abrir en navegador
open http://localhost:5173
```

### 2. Login de Administrador
- **Email**: admin@tuempresa.com
- **Password**: (configurado durante la instalación)

### 3. Dashboard Principal
Al ingresar verás:
- 📊 **Métricas principales** (servicios, inventario, facturación)
- 🚨 **Alertas activas** (stock bajo, servicios pendientes)
- 📈 **Gráficos de actividad** (últimos 30 días)
- 🔔 **Notificaciones recientes**

## 📋 Configuración Básica Paso a Paso

### Paso 1: Configurar Datos de Empresa
1. Ir a **⚙️ Configuración > Empresa**
2. Completar información básica:
   ```
   Nombre: Grúas Mi Empresa Ltda.
   RUT: 12345678-9
   Dirección: Av. Principal 123, Ciudad
   Teléfono: +56912345678
   Email: contacto@miempresa.cl
   ```
3. Subir logo de la empresa
4. **Guardar** cambios

### Paso 2: Crear Ubicaciones de Inventario
1. Ir a **📦 Inventario > Ubicaciones**
2. Crear ubicaciones esenciales:

   **Bodega Principal**
   ```
   Nombre: Bodega Central
   Tipo: Almacén
   Dirección: Mismo de empresa
   Responsable: Jefe de Bodega
   ```

   **Vehículos de Servicio**
   ```
   Nombre: Grúa 001
   Tipo: Vehículo
   Patente: ABC-123
   Responsable: Operador asignado
   ```

### Paso 3: Configurar Tipos de Grúas
1. Ir a **🚛 Flota > Tipos de Grúas**
2. Agregar tipos comunes:
   ```
   Grúa Móvil 25T - Capacidad: 25,000 kg
   Grúa Torre - Capacidad: 50,000 kg
   Grúa Todo Terreno - Capacidad: 40,000 kg
   ```

### Paso 4: Registrar Primer Vehículo
1. Ir a **🚛 Flota > Vehículos**
2. Hacer clic en **+ Nuevo Vehículo**
3. Completar datos:
   ```
   Patente: ABC-123
   Marca: Mercedes-Benz
   Modelo: Atego 1725
   Año: 2020
   Tipo de Grúa: Grúa Móvil 25T
   Estado: Activo
   ```

### Paso 5: Crear Primer Cliente
1. Ir a **👥 Clientes**
2. Hacer clic en **+ Nuevo Cliente**
3. Completar información:
   ```
   Nombre/Razón Social: Constructora Ejemplo S.A.
   RUT: 98765432-1
   Email: contacto@constructora.cl
   Teléfono: +56987654321
   Dirección: Av. Construcción 456
   ```

## 🛠️ Configuración de Inventario Básico

### Crear Categorías de Productos
1. Ir a **📦 Inventario > Categorías**
2. Crear categorías básicas:
   - 🔧 **Herramientas**: Herramientas y equipos
   - ⚙️ **Repuestos**: Repuestos y componentes
   - ⛽ **Combustibles**: Combustibles y lubricantes
   - 📦 **Materiales**: Materiales varios

### Agregar Productos Esenciales
1. Ir a **📦 Inventario > Productos**
2. Agregar productos comunes:

   **Ejemplo: Cable de Acero**
   ```
   Nombre: Cable de Acero 12mm
   Categoría: Herramientas
   Código: CAB-12MM-001
   Stock Mínimo: 10 metros
   Stock Máximo: 100 metros
   Precio: $2,500 por metro
   ```

   **Ejemplo: Filtro de Aceite**
   ```
   Nombre: Filtro de Aceite Motor
   Categoría: Repuestos
   Código: FIL-ACE-001
   Stock Mínimo: 5 unidades
   Stock Máximo: 20 unidades
   Precio: $15,000 por unidad
   ```

### Configurar Alertas de Stock
1. Ir a **📦 Inventario > Alertas**
2. Configurar umbrales:
   ```
   Stock Bajo: 20% del stock mínimo
   Stock Crítico: 5% del stock mínimo
   Productos sin Movimiento: 90 días
   Productos por Vencer: 30 días
   ```

## 🎯 Crear Primer Servicio

### Paso 1: Nuevo Servicio
1. Ir a **📋 Servicios**
2. Hacer clic en **+ Nuevo Servicio**

### Paso 2: Información Básica
```
Cliente: Constructora Ejemplo S.A.
Tipo de Servicio: Montaje Industrial
Dirección del Trabajo: Av. Industrial 789
Fecha Programada: Hoy + 1 día
Hora Estimada: 09:00
```

### Paso 3: Asignación de Recursos
```
Grúa Asignada: ABC-123 (Grúa Móvil 25T)
Operador Principal: Seleccionar operador
Operador Auxiliar: (Opcional)
Tiempo Estimado: 4 horas
```

### Paso 4: Detalles del Servicio
```
Descripción: Montaje de estructura metálica
Altura de Trabajo: 15 metros
Peso Estimado: 8,000 kg
Instrucciones Especiales: Coordinar con capataz de obra
```

### Paso 5: Confirmar Servicio
1. Revisar todos los datos
2. Hacer clic en **Crear Servicio**
3. El servicio aparecerá en **Estado: Programado**

## 📱 Configuración Mobile y PWA

### Activar PWA
1. Abrir la app en móvil
2. Buscar opción **"Instalar App"** en el navegador
3. Seguir instrucciones de instalación
4. La app funcionará offline para funciones básicas

### Configurar Notificaciones Push
1. Ir a **⚙️ Configuración > Notificaciones**
2. Activar notificaciones para:
   - ✅ Stock bajo
   - ✅ Servicios programados
   - ✅ Servicios completados
   - ✅ Alertas de mantenimiento

## 👥 Configurar Portal de Clientes

### Activar Portal
1. Ir a **⚙️ Configuración > Portal de Clientes**
2. Activar configuraciones:
   ```
   ✅ Permitir acceso a clientes
   ✅ Mostrar historial de servicios
   ✅ Permitir solicitar nuevos servicios
   ✅ Mostrar facturas
   ✅ Permitir descargar documentos
   ```

### Invitar Primer Cliente
1. Ir a **👥 Clientes**
2. Seleccionar **Constructora Ejemplo S.A.**
3. Hacer clic en **Invitar al Portal**
4. El cliente recibirá email con instrucciones de acceso

### URL del Portal
- **Producción**: https://portal.tuempresa.com
- **Desarrollo**: http://localhost:5173/portal

## 🔍 Verificación Final

### Checklist de Configuración Básica
- [ ] ✅ Datos de empresa configurados
- [ ] ✅ Al menos 1 ubicación de inventario creada
- [ ] ✅ Al menos 1 tipo de grúa configurado
- [ ] ✅ Al menos 1 vehículo registrado
- [ ] ✅ Al menos 1 cliente creado
- [ ] ✅ Al menos 1 servicio programado
- [ ] ✅ Portal de clientes activado
- [ ] ✅ PWA instalada en móvil

### Test de Funcionalidad
```bash
# Ejecutar tests básicos
npm run test:basic

# Verificar conectividad
curl http://localhost:5173/health

# Test del portal de clientes
curl http://localhost:5173/portal
```

### Métricas Iniciales
En el Dashboard deberías ver:
- **Servicios**: 1 programado
- **Clientes**: 1 activo
- **Vehículos**: 1 disponible
- **Inventario**: Productos configurados
- **Alertas**: Configuración activa

## 🎯 Próximos Pasos Recomendados

### Semana 1: Configuración Avanzada
1. **Lunes**: Completar registro de toda la flota
2. **Martes**: Cargar inventario completo
3. **Miércoles**: Configurar tarifas y precios
4. **Jueves**: Entrenar operadores en la app
5. **Viernes**: Probar facturación electrónica

### Semana 2: Operación Real
1. **Lunes**: Migrar servicios existentes
2. **Martes**: Activar notificaciones automáticas
3. **Miércoles**: Capacitar clientes en portal
4. **Jueves**: Configurar reportes automáticos
5. **Viernes**: Optimizar flujos de trabajo

### Recursos de Aprendizaje
- 📖 **[Manual del Administrador](../user-guides/admin-guide.md)**
- 🚛 **[Manual del Operador](../user-guides/operator-guide.md)**
- 🌐 **[Portal del Cliente](../user-guides/client-portal.md)**
- 🔧 **[Referencia de API](../development/api-reference.md)**

---

*¡Felicitaciones! Tu sistema TMS Grúas v2.1.0 está configurado y listo para usar.*

**¿Necesitas ayuda?** Consulta la [📚 documentación completa](../README.md) o [🐛 troubleshooting](../troubleshooting/common-issues.md).