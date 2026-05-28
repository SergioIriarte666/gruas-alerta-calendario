# Guía de configuración WhatsApp Business — TMS Grúas 5 Norte

## Resumen del sistema

La integración usa **Meta WhatsApp Cloud API** con **Supabase Edge Functions** para enviar notificaciones automáticas y manuales a operadores y administradores.

---

## Arquitectura

```
App TMS → Supabase Edge Functions → Meta Cloud API → WhatsApp del destinatario
```

**Funciones desplegadas:**
- `send-whatsapp-operator` — notifica al operador cuando se le asigna un servicio
- `send-whatsapp-admin` — notifica a los administradores según el evento
- `whatsapp-daily-alerts` — alertas programadas diarias (documentos, pagos, etc.)
- `whatsapp-webhook` — recibe confirmaciones de entrega/lectura de Meta

---

## Parte 1 — Configuración en Meta

### 1.1 Crear la app en Meta for Developers

1. Ve a [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Clic en **"Crear app"** → tipo **"Business"**
3. Nombre: `TMS-Gruas` | Portfolio: `Grúas 5 Norte`
4. Agregar producto **WhatsApp** → **"Configurar"**

### 1.2 Registrar el número de producción

1. En Meta Dev Console → **Paso 2: Configuración de producción**
2. Sección **"Registra tu número de teléfono de WhatsApp"**
3. Clic en **"Registrar"** en el número `+56 9 3779 4309`
4. Verificar por SMS o llamada de voz
5. Estado debe quedar: **Registrado** ✅
6. Anotar el **Phone Number ID**: `10816191917​09850`
7. Anotar el **WhatsApp Business Account ID**: `1669902947383662`

### 1.3 Crear token permanente

1. Ve a [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users?business_id=1294981072287183)
2. Clic en **"+ Agregar"** → nombre: `tmsgruas-api` | rol: **Administrador**
3. Clic en **"Asignar activos"**:
   - Apps → `TMS-Gruas` → Acceso total
   - Cuentas de WhatsApp → `Grúas 5 Norte` → Acceso total
4. Clic en **"Generar token"**:
   - App: `TMS-Gruas`
   - Vencimiento: **Nunca**
   - Permisos: `whatsapp_business_messaging` + `whatsapp_business_management`
5. **Copiar y guardar el token** — solo se muestra una vez

> ⚠️ Nunca compartas el token. Si se expone accidentalmente, revócalo en "Revocar tokens" y genera uno nuevo.

### 1.4 Configurar webhook

1. En Meta Dev Console → **Paso 2** → **"Configurar webhooks"**
2. **URL de devolución de llamada:**
   ```
   https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/whatsapp-webhook
   ```
3. **Token de verificación:** el valor del secret `WHATSAPP_VERIFY_TOKEN`
4. Clic en **"Verificar y guardar"**
5. Activar toggle **"Suscribir webhooks"** en el número de producción

### 1.5 Agregar método de pago

1. En Meta Dev Console → **Paso 2** → **"Agrega la información de pago"**
2. Agregar tarjeta de crédito/débito
3. Verificar en [business.facebook.com/billing_hub](https://business.facebook.com/billing_hub/accounts?business_id=1294981072287183) que la cuenta **Grúas 5 Norte** tenga la tarjeta asignada

### 1.6 Verificación del negocio

1. Ve a [business.facebook.com/settings](https://business.facebook.com/settings/security?business_id=1294981072287183)
2. Sección **"Verificación del negocio"** → **"Iniciar verificación"**
3. Documentos requeridos:
   - RUT de la empresa
   - Certificado de inicio de actividades SII o escritura
4. Tiempo de revisión: 2-7 días hábiles
5. Una vez verificado: puedes enviar a cualquier número sin restricciones

> ⚠️ Mientras el negocio no esté verificado, solo puedes enviar a números registrados como **testers** en Meta Dev Console (máximo 5).

---

## Parte 2 — Plantillas de mensajes

Las plantillas deben crearse en la cuenta **Grúas 5 Norte** (no en Test WhatsApp Business Account).

Ve a: [business.facebook.com/wa/manage/message-templates](https://business.facebook.com/wa/manage/message-templates/?business_id=1294981072287183)

Verifica que el selector arriba a la derecha diga **"Grúas 5 Norte"**.

### Plantillas requeridas (Fase 1)

Todas deben crearse con:
- **Categoría:** Utilidad
- **Tipo:** Predeterminado  
- **Idioma:** Spanish (CHL)

---

#### `servicio_asignado`
```
Hola {{1}}, se te ha asignado el servicio *{{2}}*.

📅 Fecha: {{3}}
📍 Origen: {{4}}
📍 Destino: {{5}}
👤 Cliente: {{6}}
📞 Teléfono: {{7}}

Ante cualquier duda contacta a coordinación.
```
| Variable | Ejemplo |
|---|---|
| `{{1}}` | Juan Pérez |
| `{{2}}` | SRV-2025-001 |
| `{{3}}` | lunes, 26 de mayo de 2025 |
| `{{4}}` | Av. Providencia 1234, Santiago |
| `{{5}}` | Aeropuerto SCL, Pudahuel |
| `{{6}}` | María González |
| `{{7}}` | +56912345678 |

---

#### `admin_servicio_completado`
```
✅ Servicio completado

Folio: *{{1}}*
Operador: {{2}}
Cliente: {{3}}
Fecha de cierre: {{4}}

Revisa el sistema para continuar con la facturación.
```
| Variable | Ejemplo |
|---|---|
| `{{1}}` | SRV-2025-001 |
| `{{2}}` | Juan Pérez |
| `{{3}}` | María González |
| `{{4}}` | lunes, 26 de mayo de 2025 |

---

#### `admin_documento_vence`
```
⚠️ Documento próximo a vencer

Tipo: {{1}}
Entidad: {{2}}
Vencimiento: {{3}}
Días restantes: {{4}}

Revisa el sistema para tomar acción.
```
| Variable | Ejemplo |
|---|---|
| `{{1}}` | Licencia de conducir |
| `{{2}}` | Juan Pérez |
| `{{3}}` | 15 de junio de 2025 |
| `{{4}}` | 20 |

---

#### `admin_pago_pendiente`
```
💰 Pago pendiente

Cliente: {{1}}
Folio: *{{2}}*
Monto: ${{3}}
Días vencido: {{4}}

Revisa el sistema para gestionar el cobro.
```
| Variable | Ejemplo |
|---|---|
| `{{1}}` | María González |
| `{{2}}` | SRV-2025-001 |
| `{{3}}` | 150.000 |
| `{{4}}` | 5 |

---

#### `admin_servicio_sin_cotizacion`
```
📋 Servicio sin cotización

Folio: *{{1}}*
Cliente: {{2}}
Fecha de servicio: {{3}}

El servicio fue creado sin cotización asociada. Revisa el sistema para regularizar.
```
| Variable | Ejemplo |
|---|---|
| `{{1}}` | SRV-2025-001 |
| `{{2}}` | María González |
| `{{3}}` | lunes, 26 de mayo de 2025 |

---

#### `admin_orden_compra`
```
🛒 Orden de compra pendiente

Proveedor: {{1}}
Monto: ${{2}}
Descripción: {{3}}

Revisa el sistema para aprobar o gestionar la orden.
```
| Variable | Ejemplo |
|---|---|
| `{{1}}` | Repuestos del Sur Ltda. |
| `{{2}}` | 85.000 |
| `{{3}}` | Filtros de aceite y correas distribución |

---

#### `admin_cierre_mensual`
```
📊 Resumen cierre mensual

Período: {{1}} {{2}}
Total servicios: {{3}}
Total ingresos: ${{4}}

Revisa el sistema para completar el cierre y generar los reportes.
```
| Variable | Ejemplo |
|---|---|
| `{{1}}` | Mayo |
| `{{2}}` | 2025 |
| `{{3}}` | 48 |
| `{{4}}` | 12.350.000 |

---

## Parte 3 — Configuración en Supabase

### 3.1 Secrets requeridos

Ve a **Supabase → Edge Functions → Secrets** y configura:

| Secret | Descripción | Valor |
|---|---|---|
| `WHATSAPP_TOKEN` | Token permanente de Meta | Generado en paso 1.3 |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de producción | `10816191917​09850` (copiar desde Meta) |
| `WHATSAPP_VERIFY_TOKEN` | Token para verificar webhook | Texto secreto a elección ej: `gruas5norte_webhook_2026` |
| `ADMIN_WHATSAPP_1` | Número admin 1 (fallback) | `569XXXXXXXX` |
| `ADMIN_WHATSAPP_2` | Número admin 2 (fallback) | `569XXXXXXXX` |
| `SUPABASE_ANON_KEY` | Anon key del proyecto | Desde Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Desde Supabase → Settings → API |

> Los números de administradores también se pueden configurar desde la app en **Configuración → Alertas → WhatsApp Business**. Los secrets `ADMIN_WHATSAPP_1` y `ADMIN_WHATSAPP_2` son fallback si la BD no tiene datos.

### 3.2 Deploy de funciones

Desde la raíz del repositorio:

```bash
npx supabase functions deploy send-whatsapp-admin
npx supabase functions deploy send-whatsapp-operator
npx supabase functions deploy whatsapp-daily-alerts
npx supabase functions deploy whatsapp-webhook
```

> El WARNING "Docker is not running" es normal y no afecta el deploy.

### 3.3 Configuración desde la app

1. Ve a **Configuración → Alertas → WhatsApp Business**
2. Ingresa los números de los 2 administradores en formato `+56 9 XXXX XXXX`
3. Activa/desactiva los switches según las notificaciones deseadas
4. Haz clic en **"Guardar configuración"**
5. Usa **"Enviar prueba"** para verificar que la integración funciona

---

## Parte 4 — Renovar token cuando vence

Si el token vence (solo aplica a tokens temporales):

1. Ve a [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users?business_id=1294981072287183)
2. Clic en `tmsgruas-api` → **"Revocar tokens"**
3. Clic en **"Generar token"** → misma configuración de siempre
4. Actualiza `WHATSAPP_TOKEN` en Supabase Secrets
5. Redespliega las funciones:
   ```bash
   npx supabase functions deploy send-whatsapp-admin
   npx supabase functions deploy send-whatsapp-operator
   npx supabase functions deploy whatsapp-daily-alerts
   ```

> Con el token **"Nunca"** esto no debería ser necesario. Solo aplica si por alguna razón se usa un token temporal.

---

## Parte 5 — Agregar testers (mientras el negocio no está verificado)

Mientras la verificación del negocio está en curso, solo puedes enviar mensajes a números registrados como testers.

1. Ve a [developers.facebook.com/apps/1359043289375000/whatsapp-business/wa-dev-console](https://developers.facebook.com/apps/1359043289375000/whatsapp-business/wa-dev-console/?business_id=1294981072287183)
2. En **"Envía un mensaje desde tu número de prueba"** → campo **"Destinatario"**
3. Clic en **"Administrar lista de números de teléfono"**
4. **"Agregar número de teléfono"** → ingresar número chileno → verificar con código SMS
5. Máximo 5 testers simultáneos

Una vez verificado el negocio, este paso ya no es necesario.

---

## Parte 6 — Solución de problemas frecuentes

| Error | Causa | Solución |
|---|---|---|
| `[132001] Template name does not exist` | Plantilla no existe en esa cuenta o idioma incorrecto | Verificar que las plantillas estén en cuenta **Grúas 5 Norte** con idioma **Spanish (CHL)** |
| `[100] Object does not exist or missing permissions` | Phone Number ID incorrecto o token sin permisos | Copiar Phone Number ID directamente desde Meta (evitar escribirlo a mano) y regenerar token |
| `[190] Authentication Error` | Token vencido o revocado | Regenerar token en Usuarios del sistema |
| `EarlyDrop` en logs Supabase | Variables de entorno faltantes | Verificar que `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` están en secrets |
| Mensaje enviado pero no llega | Número no es tester y negocio no verificado | Agregar número como tester o esperar verificación del negocio |
| `Edge Function returned non-2xx` | Error interno en la función | Revisar logs en Supabase → Edge Functions → send-whatsapp-admin → Logs |

---

## Parte 7 — Datos de referencia

| Dato | Valor |
|---|---|
| App ID Meta | `1359043289375000` |
| Business ID | `1294981072287183` |
| WhatsApp Business Account ID | `1669902947383662` |
| Phone Number ID (producción) | Copiar desde Meta Dev Console |
| Número de producción | `+56 9 3779 4309` |
| Supabase Project ID | `jqszxljtfuknhuvuheko` |
| URL Edge Functions | `https://jqszxljtfuknhuvuheko.supabase.co/functions/v1/` |

---

## Parte 8 — Próximos pasos (Fase 1.5)

Cuando el sistema de Fase 1 esté estable, las siguientes notificaciones están documentadas en `whatsapp-notificaciones-roadmap.md`:

- Recordatorio al operador el día anterior al servicio
- Aviso al operador cuando su servicio es modificado o cancelado
- Alerta de mantención de grúas próxima a vencer
- Factura vencida sin pago
- Notificaciones a clientes (Fase 2)
