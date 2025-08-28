# Resolución de Problemas - TMS Grúas v2.2.0

## Problemas de Acceso

### No puedo iniciar sesión
1. **Verificar credenciales**: Usuario y contraseña correctos
2. **Recuperación de contraseña**: Usar enlace "¿Olvidaste tu contraseña?"
3. **Limpiar cache del navegador**: Borrar datos de sitio
4. **Verificar estado del usuario**: Contactar administrador para verificar estado activo
5. **Revisar conexión**: Verificar conectividad a internet
6. **Probar en navegador privado**: Descartar problemas de extensiones

### App PWA no funciona
1. **Verificar instalación correcta**: Reinstalar desde navegador
2. **Limpiar datos de aplicación**: 
   - Chrome: Configuración → Privacidad → Borrar datos
   - Safari: Configuración → Safari → Borrar historial
3. **Verificar Service Worker**: F12 → Application → Service Workers
4. **Actualizar PWA**: Buscar notificación de actualización
5. **Verificar permisos**: Notificaciones, ubicación, cámara
6. **Revisar espacio disponible**: Liberar espacio en dispositivo

### Problemas de sincronización offline
1. **Verificar conexión**: Probar conectividad
2. **Forzar sincronización**: Usar botón "Sincronizar" en configuraciones
3. **Revisar datos pendientes**: Verificar en "Entradas Rápidas"
4. **Limpiar cache offline**: Configuraciones → Limpiar datos offline
5. **Reinstalar PWA**: Como último recurso

## Problemas de Datos

### Datos no cargan
1. **Verificar conexión a internet**: Test de velocidad
2. **Revisar permisos de usuario**: Contactar administrador
3. **Limpiar cache del navegador**: Borrar datos específicos del sitio
4. **Verificar estado de Supabase**: Revisar dashboard de administrador
5. **Probar en navegador diferente**: Descartar problemas específicos
6. **Revisar filtros activos**: Verificar que no haya filtros restrictivos

### Duplicados en inventario/grúas
1. **Usar herramienta de limpieza**: Dashboard → Herramientas → Limpiar duplicados
2. **Ejecutar sincronización**: Menú → Sincronizar inventario-grúas
3. **Revisar configuración de triggers**: Contactar administrador
4. **Verificar flujo de trabajo**: Seguir flujo recomendado Bodega → Grúas
5. **Resolver conflictos manualmente**: Revisar cada caso individual

### Inconsistencias de pagos
1. **Usar herramientas administrativas**:
   - Botón "Corregir Inconsistencias" (solo admin)
   - Función `fix_invoice_payment_inconsistencies()`
   - Validación de integridad de pagos
2. **Revisar aplicaciones de pago**: Verificar que los pagos estén correctamente aplicados
3. **Ejecutar diagnóstico completo**: `comprehensive_payment_diagnosis()`
4. **Revisar logs de auditoría**: Para identificar origen del problema
5. **Reconciliación manual**: En casos complejos

### Problemas de comisiones
1. **Resolver conflictos**: Usar función `resolve_commission_conflicts()`
2. **Verificar configuración**: Revisar porcentajes de comisión por operador
3. **Limpiar duplicados**: Herramientas → Limpiar comisiones duplicadas
4. **Revisar servicios cerrados**: Verificar que los servicios estén correctamente completados
5. **Regenerar comisiones**: Usar función de emergencia para cerrar servicios

## Problemas de Performance

### Sistema lento
1. **Verificar conexión**: Test de velocidad y latencia
2. **Optimizar consultas**:
   - Reducir rango de fechas en reportes
   - Usar filtros más específicos
   - Limitar resultados por página
3. **Limpiar cache**: Borrar datos temporales
4. **Cerrar pestañas innecesarias**: Liberar memoria del navegador
5. **Actualizar navegador**: Usar versión más reciente
6. **Verificar recursos del sistema**: CPU, memoria, disco

### Interface móvil no responsive
1. **Actualizar navegador móvil**: Instalar última versión
2. **Verificar orientación dispositivo**: Probar en horizontal y vertical
3. **Reinstalar PWA**: Desinstalar y volver a instalar
4. **Limpiar cache móvil**: Borrar datos de la aplicación
5. **Verificar resolución**: Problemas en pantallas muy pequeñas
6. **Probar en otros dispositivos**: Aislar problema específico

### Problemas de carga de imágenes
1. **Verificar formato**: Usar JPG, PNG, WebP
2. **Optimizar tamaño**: Máximo 5MB por imagen
3. **Comprobar conexión**: Velocidad de upload
4. **Limpiar cache de imágenes**: Borrar almacenamiento local
5. **Usar compresión**: Reducir calidad si es necesario

## Problemas de Inventario

### Stock inconsistente
1. **Ejecutar auditoría de inventario**:
   - Reportes → Auditoría de inventario
   - Comparar con conteo físico
   - Revisar movimientos duplicados
2. **Sincronizar movimientos**: Herramientas → Sincronizar stock
3. **Revisar entradas/salidas**: Verificar todos los movimientos
4. **Recalcular stock**: Función administrativa para recalcular
5. **Ajuste manual**: Crear movimiento de ajuste si es necesario

### Problemas de integración con grúas
1. **Verificar configuración**: Configuraciones → Integración → Inventario-Grúas
2. **Sincronizar manualmente**: Herramientas → Sync inventario-grúas
3. **Revisar categorías**: Verificar mapeo de categorías
4. **Resolver conflictos**: Revisar alertas de duplicados
5. **Seguir flujo recomendado**: Usar siempre Bodega → Grúas

## Problemas de Backup y Restauración

### Backup falla
1. **Verificar permisos**: Solo administradores pueden generar backups
2. **Comprobar espacio**: Verificar espacio disponible en storage
3. **Revisar logs**: Dashboard → Logs de backup
4. **Probar backup manual**: Generar backup de prueba
5. **Contactar administrador**: Si persiste el problema

### Restauración no funciona
1. **Verificar formato del backup**: Asegurar que el archivo no esté corrupto
2. **Comprobar permisos**: Solo administradores pueden restaurar
3. **Revisar logs de restauración**: Para identificar errores específicos
4. **Backup preventivo**: Crear backup antes de restaurar
5. **Restauración parcial**: Si falla completa, intentar por módulos

## Problemas de Notificaciones

### Push notifications no llegan
1. **Verificar permisos del navegador**: Permitir notificaciones
2. **Comprobar configuración**: Configuraciones → Notificaciones
3. **Verificar suscripción**: Revisar que la suscripción esté activa
4. **Probar notificación de prueba**: Enviar notificación manual
5. **Revisar "No molestar"**: Configuración del dispositivo
6. **Reactivar suscripción**: Desactivar y volver a activar

### Emails no se envían
1. **Verificar configuración SMTP**: Contactar administrador
2. **Revisar plantillas de email**: Verificar formato correcto
3. **Comprobar direcciones**: Validar emails de destinatarios
4. **Revisar logs de email**: Dashboard → Logs de notificaciones
5. **Probar envío manual**: Usar función de test

## Problemas de Reportes

### Reportes no generan
1. **Verificar rango de fechas**: No usar rangos muy amplios
2. **Comprobar filtros**: Verificar que haya datos para los filtros aplicados
3. **Revisar permisos**: Verificar acceso a los datos solicitados
4. **Intentar formato diferente**: PDF vs Excel
5. **Generar reporte simple**: Probar con menos datos

### Datos incorrectos en reportes
1. **Verificar fuente de datos**: Revisar registros originales
2. **Comprobar filtros aplicados**: Verificar configuración
3. **Revisar fecha de corte**: Confirmar período solicitado
4. **Regenerar reporte**: Volver a generar con mismos parámetros
5. **Comparar con dashboard**: Verificar consistencia

## Herramientas de Diagnóstico

### Para Administradores

#### Funciones de Diagnóstico Disponibles
- `runAuthDiagnostic()`: Diagnóstico completo de autenticación
- `comprehensive_payment_diagnosis()`: Análisis del sistema de pagos
- `validate_payment_system_integrity()`: Validación de integridad
- `diagnose_maintenance_cost_integration()`: Diagnóstico de integración
- `diagnose_service_update_issues()`: Problemas de actualización de servicios

#### Funciones de Reparación
- `attemptAuthRepair()`: Reparación automática de auth
- `fix_invoice_payment_inconsistencies()`: Corrección de pagos
- `resolve_commission_conflicts()`: Resolución de conflictos
- `emergency_close_service()`: Cierre de emergencia de servicios
- `fix_unlinked_maintenance_costs()`: Vincular costos de mantenimiento

### Logs del Sistema
- **Ubicación**: Dashboard → Administración → Logs
- **Tipos de Log**:
  - Logs de auditoría (todas las operaciones)
  - Logs de backup (respaldos y restauraciones)
  - Logs de notificaciones (emails y push)
  - Logs de errores (errores del sistema)
  - Logs de performance (métricas de rendimiento)

## Contacto de Soporte

### Soporte Técnico Urgente
- **Email**: soporte@tmsgruas.cl
- **WhatsApp**: +56 9 XXXX XXXX  
- **Horario**: 24/7 para emergencias críticas
- **Nivel de Soporte**: Problemas que afectan operaciones críticas

### Soporte General
- **Email**: ayuda@tmsgruas.cl
- **Horario**: Lunes-Viernes 8:00-18:00
- **Tiempo de Respuesta**: 24 horas máximo
- **Nivel de Soporte**: Consultas generales, capacitación, mejoras

### Información a Incluir en Solicitudes
1. **Descripción detallada** del problema
2. **Pasos para reproducir** el error
3. **Navegador y versión** utilizada
4. **Dispositivo** (desktop/móvil)
5. **Usuario y rol** afectado
6. **Screenshots** si es aplicable
7. **Logs de error** si están disponibles

### Escalamiento de Problemas
1. **Nivel 1**: Soporte general (ayuda@tmsgruas.cl)
2. **Nivel 2**: Soporte técnico (soporte@tmsgruas.cl)
3. **Nivel 3**: Soporte crítico (WhatsApp directo)
4. **Desarrollo**: Para bugs críticos o nuevas funcionalidades

---
*Guía actualizada para TMS Grúas v2.2.0 - Incluye todas las nuevas funcionalidades y herramientas de diagnóstico*