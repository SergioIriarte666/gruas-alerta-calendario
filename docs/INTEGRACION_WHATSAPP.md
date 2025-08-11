# Integración WhatsApp - TMS Grúas

## Tabla de Contenidos
- [Introducción](#introducción)
- [Análisis de Proveedores](#análisis-de-proveedores)
- [Arquitectura Propuesta](#arquitectura-propuesta)
- [Plan de Implementación](#plan-de-implementación)
- [Especificaciones Técnicas](#especificaciones-técnicas)
- [Configuración de Twilio](#configuración-de-twilio)
- [Ejemplos de Código](#ejemplos-de-código)
- [Consideraciones de Seguridad](#consideraciones-de-seguridad)
- [Costos y Limitaciones](#costos-y-limitaciones)
- [Testing y Troubleshooting](#testing-y-troubleshooting)

## Introducción

### Objetivo
Implementar notificaciones WhatsApp para operadores del sistema TMS Grúas, permitiendo:
- Notificaciones automáticas de servicios asignados
- Confirmaciones de recepción por parte de operadores
- Actualizaciones de estado de servicios
- Comunicación bidireccional en tiempo real

### Beneficios Esperados
- **Comunicación inmediata**: Notificaciones instantáneas a operadores
- **Mayor confiabilidad**: WhatsApp tiene alta tasa de entrega y lectura
- **Facilidad de uso**: Interface familiar para todos los operadores
- **Trazabilidad**: Registro completo de comunicaciones
- **Reducción de errores**: Confirmaciones automáticas de recepción

## Análisis de Proveedores

### Twilio WhatsApp Business API
**Ventajas:**
- API robusta y bien documentada
- Integración sencilla con Supabase Edge Functions
- Soporte para webhooks y respuestas bidireccionales
- Plantillas de mensajes pre-aprobadas
- Analytics y reporting integrados

**Desventajas:**
- Requiere proceso de aprobación de Meta
- Costo por mensaje enviado
- Limitaciones en tipos de mensajes
- Configuración inicial compleja

**Costo Estimado (Chile):**
- Mensaje de plantilla: ~$0.0085 USD por mensaje
- Mensaje de conversación: ~$0.015 USD por mensaje
- Setup inicial: Gratuito

### WhatsApp Business API (Meta)
**Ventajas:**
- API oficial de Meta
- Máxima compatibilidad y funcionalidades
- Mejor soporte a largo plazo

**Desventajas:**
- Configuración muy compleja
- Requiere infraestructura propia
- Proceso de verificación extenso
- No recomendado para implementaciones pequeñas

### Alternativas Consideradas
- **360Dialog**: Más simple que Meta directo, pero menos funcionalidades
- **MessageBird**: Similar a Twilio, menor presencia en LATAM
- **SendPulse**: Más económico, pero menor confiabilidad

**Recomendación:** Twilio WhatsApp Business API por su balance entre funcionalidad y facilidad de implementación.

## Arquitectura Propuesta

### Flujo de Datos
```
[Sistema TMS] → [Trigger de Notificación] → [Edge Function] → [Twilio API] → [WhatsApp] → [Operador]
     ↑                                                                                      ↓
[Actualización BD] ← [Webhook Handler] ← [Supabase] ← [Twilio Webhook] ← [Respuesta WhatsApp]
```

### Componentes del Sistema

#### 1. Base de Datos
```sql
-- Extensión tabla operators
ALTER TABLE operators ADD COLUMN whatsapp_phone VARCHAR(20);
ALTER TABLE operators ADD COLUMN whatsapp_enabled BOOLEAN DEFAULT false;
ALTER TABLE operators ADD COLUMN whatsapp_preferences JSONB DEFAULT '{}';

-- Nueva tabla para tracking de mensajes
CREATE TABLE whatsapp_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id),
  service_id UUID REFERENCES services(id),
  message_sid VARCHAR(100) UNIQUE,
  message_type VARCHAR(50), -- 'service_assigned', 'reminder', 'urgent_update'
  message_content TEXT,
  status VARCHAR(50), -- 'sent', 'delivered', 'read', 'failed'
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  operator_response TEXT,
  response_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### 2. Edge Functions
- `send-whatsapp-notification`: Enviar mensajes a operadores
- `handle-whatsapp-webhook`: Procesar respuestas y actualizaciones de estado
- `whatsapp-status-webhook`: Manejar cambios de estado de mensajes

#### 3. Integración con Sistema Existente
- Extensión de `useNotificationTriggers.ts`
- Nuevos hooks para gestión de WhatsApp
- Panel de configuración en Settings

## Plan de Implementación

### Fase 1: Configuración Inicial (1-2 semanas)

#### Objetivos
- Configurar cuenta Twilio WhatsApp Business
- Crear plantillas de mensajes
- Implementar Edge Functions básicas
- Realizar pruebas de envío

#### Tareas Técnicas
1. **Setup de Twilio**
   - Crear cuenta Twilio
   - Solicitar acceso a WhatsApp Business API
   - Configurar número de WhatsApp Business
   - Crear y aprobar plantillas de mensajes

2. **Base de Datos**
   - Ejecutar migraciones para nuevas tablas
   - Actualizar políticas RLS
   - Configurar índices necesarios

3. **Edge Functions Básicas**
   - Implementar `send-whatsapp-notification`
   - Configurar secrets de Twilio
   - Crear handlers de error básicos

4. **Testing Inicial**
   - Pruebas de envío de mensajes
   - Validación de plantillas
   - Test de webhooks básicos

### Fase 2: Integración con Sistema (2-3 semanas)

#### Objetivos
- Integrar notificaciones WhatsApp con el sistema existente
- Implementar webhooks para respuestas
- Crear panel de configuración

#### Tareas Técnicas
1. **Integración con Notificaciones**
   - Extender `useNotificationTriggers.ts`
   - Modificar triggers de servicios
   - Implementar lógica de preferencias

2. **Webhooks y Respuestas**
   - Implementar `handle-whatsapp-webhook`
   - Procesar respuestas de operadores
   - Actualizar estados automáticamente

3. **Panel de Configuración**
   - Agregar configuración WhatsApp en Settings
   - Interface para gestionar números de operadores
   - Configuración de preferencias de notificación

4. **Testing Integral**
   - Pruebas end-to-end
   - Validación de flujos completos
   - Test de casos edge

### Fase 3: Funcionalidades Avanzadas (1-2 semanas)

#### Objetivos
- Implementar respuestas interactivas
- Agregar comandos de operadores
- Crear sistema de escalación

#### Tareas Técnicas
1. **Comandos Interactivos**
   - Procesar comandos: CONFIRMO, CONSULTA, LLEGUE, TERMINADO
   - Actualización automática de estados
   - Respuestas contextuales

2. **Sistema de Escalación**
   - Recordatorios automáticos
   - Escalación a supervisores
   - Notificaciones de urgencia

3. **Mejoras UX**
   - Formateo avanzado de mensajes
   - Envío de ubicaciones
   - Adjuntos y media (futuro)

### Fase 4: Monitoreo y Optimización (1 semana)

#### Objetivos
- Implementar analytics y reportes
- Optimizar performance
- Documentar operación

#### Tareas Técnicas
1. **Analytics**
   - Dashboard de métricas WhatsApp
   - Reportes de entrega y respuesta
   - KPIs de comunicación

2. **Optimización**
   - Cache de plantillas
   - Rate limiting
   - Error recovery

3. **Documentación Operativa**
   - Manual de usuario
   - Guías de troubleshooting
   - Procedimientos de soporte

## Especificaciones Técnicas

### Plantillas de Mensajes

#### 1. Servicio Asignado
```
🚛 *Nuevo Servicio Asignado*

📋 Folio: {{folio}}
👤 Cliente: {{client_name}}
📍 Dirección: {{address}}
📅 Fecha: {{service_date}}
🕐 Hora: {{service_time}}
🏗️ Tipo: {{service_type}}

Responde CONFIRMO para confirmar recepción.

Para más detalles: {{app_url}}/services/{{service_id}}
```

#### 2. Recordatorio
```
⏰ *Recordatorio - Servicio Pendiente*

📋 Folio: {{folio}}
👤 Cliente: {{client_name}}
📅 Programado: {{service_date}} {{service_time}}

¿Has visto este servicio? Responde CONFIRMO si lo recibiste.

{{app_url}}/services/{{service_id}}
```

#### 3. Actualización Urgente
```
🚨 *Actualización Urgente*

📋 Folio: {{folio}}
📝 Cambio: {{change_description}}

Revisa la app para más detalles:
{{app_url}}/services/{{service_id}}
```

### Comandos de Operadores

| Comando | Acción | Respuesta |
|---------|--------|-----------|
| `CONFIRMO` | Confirma recepción del servicio | ✅ Confirmado. Gracias. |
| `LLEGUE` | Marca llegada al sitio | 📍 Llegada registrada a las {{time}} |
| `TERMINADO` | Marca servicio como completado | ✅ Servicio marcado como completado |
| `CONSULTA` | Solicita información adicional | 📞 Se notificó al supervisor. Te contactarán pronto. |
| `AYUDA` | Muestra comandos disponibles | Lista de comandos disponibles |

### Variables de Entorno Requeridas

```env
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Webhooks
WHATSAPP_WEBHOOK_URL=https://xxxxx.supabase.co/functions/v1/handle-whatsapp-webhook
WHATSAPP_STATUS_WEBHOOK_URL=https://xxxxx.supabase.co/functions/v1/whatsapp-status-webhook

# App Configuration
APP_BASE_URL=https://your-app-domain.com
WHATSAPP_ENABLED=true
```

## Configuración de Twilio

### Paso 1: Crear Cuenta y Configurar Proyecto

1. **Registro en Twilio**
   ```bash
   # Ir a https://www.twilio.com/
   # Crear cuenta y verificar teléfono
   # Acceder a Console Dashboard
   ```

2. **Configurar WhatsApp Sandbox (Desarrollo)**
   ```bash
   # En Twilio Console:
   # Messaging > Try it out > Send a WhatsApp message
   # Seguir instrucciones para configurar sandbox
   # Probar envío de mensajes básicos
   ```

3. **Solicitar WhatsApp Business API (Producción)**
   ```bash
   # En Twilio Console:
   # Messaging > WhatsApp > Request Access
   # Completar formulario de aplicación
   # Proporcionar información de negocio
   # Esperar aprobación (1-2 semanas)
   ```

### Paso 2: Configurar Plantillas de Mensajes

1. **Crear Plantillas**
   ```bash
   # En Twilio Console:
   # Messaging > WhatsApp > Senders
   # Content Templates > Create new template
   # Definir categoría: UTILITY (para notificaciones)
   # Configurar variables {{1}}, {{2}}, etc.
   ```

2. **Enviar para Aprobación**
   ```bash
   # Revisar políticas de Meta
   # Enviar plantillas para aprobación
   # Esperar confirmación (24-48 horas)
   ```

### Paso 3: Configurar Webhooks

1. **Configurar Webhook de Estado**
   ```bash
   # En Twilio Console:
   # Messaging > Settings > WhatsApp sandbox settings
   # Status callback URL: 
   # https://[project-id].supabase.co/functions/v1/whatsapp-status-webhook
   ```

2. **Configurar Webhook de Mensajes Entrantes**
   ```bash
   # Incoming messages URL:
   # https://[project-id].supabase.co/functions/v1/handle-whatsapp-webhook
   ```

## Ejemplos de Código

### Edge Function: send-whatsapp-notification

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppRequest {
  operatorId: string;
  serviceId: string;
  messageType: 'service_assigned' | 'reminder' | 'urgent_update';
  templateData: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { operatorId, serviceId, messageType, templateData }: WhatsAppRequest = await req.json();

    // Obtener datos del operador
    const { data: operator, error: operatorError } = await supabase
      .from('operators')
      .select('name, whatsapp_phone, whatsapp_enabled')
      .eq('id', operatorId)
      .single();

    if (operatorError || !operator?.whatsapp_enabled || !operator?.whatsapp_phone) {
      throw new Error('Operador no tiene WhatsApp configurado');
    }

    // Preparar mensaje según plantilla
    const templateName = getTemplateName(messageType);
    const messageBody = formatMessage(templateName, templateData);

    // Enviar mensaje via Twilio
    const twilioResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${Deno.env.get('TWILIO_ACCOUNT_SID')}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${Deno.env.get('TWILIO_ACCOUNT_SID')}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${Deno.env.get('TWILIO_WHATSAPP_NUMBER')}`,
        To: `whatsapp:${operator.whatsapp_phone}`,
        Body: messageBody,
      }),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      throw new Error(`Twilio error: ${twilioData.message}`);
    }

    // Registrar notificación en BD
    const { error: logError } = await supabase
      .from('whatsapp_notifications')
      .insert({
        operator_id: operatorId,
        service_id: serviceId,
        message_sid: twilioData.sid,
        message_type: messageType,
        message_content: messageBody,
        status: 'sent'
      });

    if (logError) {
      console.error('Error logging notification:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageSid: twilioData.sid 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getTemplateName(messageType: string): string {
  const templates = {
    'service_assigned': 'nuevo_servicio',
    'reminder': 'recordatorio_servicio', 
    'urgent_update': 'actualizacion_urgente'
  };
  return templates[messageType] || 'mensaje_generico';
}

function formatMessage(template: string, data: Record<string, string>): string {
  const templates = {
    'nuevo_servicio': `🚛 *Nuevo Servicio Asignado*

📋 Folio: ${data.folio}
👤 Cliente: ${data.clientName}
📍 Dirección: ${data.address}
📅 Fecha: ${data.serviceDate}
🏗️ Tipo: ${data.serviceType}

Responde CONFIRMO para confirmar recepción.`,

    'recordatorio_servicio': `⏰ *Recordatorio - Servicio Pendiente*

📋 Folio: ${data.folio}
👤 Cliente: ${data.clientName}
📅 Programado: ${data.serviceDate}

¿Has visto este servicio? Responde CONFIRMO si lo recibiste.`,

    'actualizacion_urgente': `🚨 *Actualización Urgente*

📋 Folio: ${data.folio}
📝 Cambio: ${data.changeDescription}

Revisa la app para más detalles.`
  };

  return templates[template] || `Mensaje: ${JSON.stringify(data)}`;
}
```

### Edge Function: handle-whatsapp-webhook

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const formData = await req.formData();
    const messageBody = formData.get('Body')?.toString().toUpperCase().trim() || '';
    const fromNumber = formData.get('From')?.toString().replace('whatsapp:', '') || '';
    const messageSid = formData.get('MessageSid')?.toString() || '';

    console.log('WhatsApp webhook received:', { messageBody, fromNumber, messageSid });

    // Buscar operador por número de teléfono
    const { data: operator, error: operatorError } = await supabase
      .from('operators')
      .select('id, name')
      .eq('whatsapp_phone', fromNumber)
      .single();

    if (operatorError || !operator) {
      console.log('Operador no encontrado para número:', fromNumber);
      return new Response('OK', { status: 200 });
    }

    // Procesar comando
    const response = await processOperatorCommand(supabase, operator, messageBody);

    // Registrar respuesta del operador
    const { error: updateError } = await supabase
      .from('whatsapp_notifications')
      .update({
        operator_response: messageBody,
        response_at: new Date().toISOString()
      })
      .eq('operator_id', operator.id)
      .order('sent_at', { ascending: false })
      .limit(1);

    if (updateError) {
      console.error('Error updating notification:', updateError);
    }

    // Enviar respuesta automática si es necesario
    if (response) {
      await sendAutoResponse(fromNumber, response);
    }

    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    return new Response('Error', { status: 500 });
  }
});

async function processOperatorCommand(supabase: any, operator: any, command: string): Promise<string | null> {
  const commands = {
    'CONFIRMO': async () => {
      // Buscar último servicio pendiente del operador
      const { data: service, error } = await supabase
        .from('services')
        .select('id, folio')
        .eq('operator_id', operator.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !service) {
        return 'No se encontraron servicios pendientes para confirmar.';
      }

      // Actualizar estado del servicio
      await supabase
        .from('services')
        .update({ 
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', service.id);

      return `✅ Servicio ${service.folio} confirmado. Gracias.`;
    },

    'LLEGUE': async () => {
      // Buscar último servicio confirmado del operador
      const { data: service, error } = await supabase
        .from('services')
        .select('id, folio')
        .eq('operator_id', operator.id)
        .in('status', ['confirmed', 'in_progress'])
        .order('service_date', { ascending: false })
        .limit(1)
        .single();

      if (error || !service) {
        return 'No se encontraron servicios activos.';
      }

      // Actualizar estado
      await supabase
        .from('services')
        .update({ 
          status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', service.id);

      const now = new Date().toLocaleTimeString('es-CL');
      return `📍 Llegada registrada para servicio ${service.folio} a las ${now}`;
    },

    'TERMINADO': async () => {
      // Buscar último servicio en progreso del operador
      const { data: service, error } = await supabase
        .from('services')
        .select('id, folio')
        .eq('operator_id', operator.id)
        .eq('status', 'in_progress')
        .order('service_date', { ascending: false })
        .limit(1)
        .single();

      if (error || !service) {
        return 'No se encontraron servicios en progreso.';
      }

      // Actualizar estado
      await supabase
        .from('services')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', service.id);

      return `✅ Servicio ${service.folio} marcado como completado.`;
    },

    'CONSULTA': async () => {
      // Notificar a supervisores (implementar lógica específica)
      return '📞 Se notificó al supervisor. Te contactarán pronto.';
    },

    'AYUDA': async () => {
      return `📋 *Comandos disponibles:*

CONFIRMO - Confirmar recepción de servicio
LLEGUE - Registrar llegada al sitio
TERMINADO - Marcar servicio como completado
CONSULTA - Solicitar ayuda del supervisor
AYUDA - Mostrar estos comandos`;
    }
  };

  const handler = commands[command];
  if (handler) {
    return await handler();
  }

  return 'Comando no reconocido. Responde AYUDA para ver comandos disponibles.';
}

async function sendAutoResponse(toNumber: string, message: string): Promise<void> {
  try {
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${Deno.env.get('TWILIO_ACCOUNT_SID')}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`${Deno.env.get('TWILIO_ACCOUNT_SID')}:${Deno.env.get('TWILIO_AUTH_TOKEN')}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${Deno.env.get('TWILIO_WHATSAPP_NUMBER')}`,
        To: `whatsapp:${toNumber}`,
        Body: message,
      }),
    });
  } catch (error) {
    console.error('Error sending auto response:', error);
  }
}
```

### Hook: useWhatsAppNotifications

```typescript
// src/hooks/useWhatsAppNotifications.ts
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/custom-toast';

interface WhatsAppNotificationRequest {
  operatorId: string;
  serviceId: string;
  messageType: 'service_assigned' | 'reminder' | 'urgent_update';
  templateData: Record<string, string>;
}

export const useWhatsAppNotifications = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const sendNotification = async (request: WhatsAppNotificationRequest) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: request
      });

      if (error) throw error;

      toast({
        type: "success",
        title: "Notificación enviada",
        description: "El mensaje WhatsApp ha sido enviado al operador."
      });

      return data;
    } catch (error: any) {
      console.error('Error sending WhatsApp notification:', error);
      toast({
        type: "error",
        title: "Error",
        description: "No se pudo enviar la notificación WhatsApp."
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const sendServiceAssignedNotification = async (operatorId: string, serviceData: any) => {
    return sendNotification({
      operatorId,
      serviceId: serviceData.id,
      messageType: 'service_assigned',
      templateData: {
        folio: serviceData.folio,
        clientName: serviceData.client.name,
        address: serviceData.address,
        serviceDate: serviceData.serviceDate,
        serviceType: serviceData.serviceType.name
      }
    });
  };

  const sendReminderNotification = async (operatorId: string, serviceData: any) => {
    return sendNotification({
      operatorId,
      serviceId: serviceData.id,
      messageType: 'reminder',
      templateData: {
        folio: serviceData.folio,
        clientName: serviceData.client.name,
        serviceDate: serviceData.serviceDate
      }
    });
  };

  const sendUrgentUpdateNotification = async (operatorId: string, serviceData: any, changeDescription: string) => {
    return sendNotification({
      operatorId,
      serviceId: serviceData.id,
      messageType: 'urgent_update',
      templateData: {
        folio: serviceData.folio,
        changeDescription
      }
    });
  };

  return {
    loading,
    sendNotification,
    sendServiceAssignedNotification,
    sendReminderNotification,
    sendUrgentUpdateNotification
  };
};
```

## Consideraciones de Seguridad

### Protección de Datos
- **Números de teléfono**: Almacenar con formato internacional (+56XXXXXXXXX)
- **Mensajes**: No incluir información sensible en templates
- **Webhooks**: Validar origen usando Twilio signatures
- **Rate limiting**: Implementar límites por operador/hora

### Validaciones de Webhook
```typescript
// Validar signature de Twilio
import { createHmac } from 'https://deno.land/std@0.168.0/node/crypto.ts';

function validateTwilioSignature(signature: string, url: string, params: Record<string, string>): boolean {
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const expectedSignature = createHmac('sha1', authToken)
    .update(url + Object.keys(params).sort().map(key => key + params[key]).join(''))
    .digest('base64');
  
  return signature === expectedSignature;
}
```

### Políticas RLS
```sql
-- Política para whatsapp_notifications
CREATE POLICY "Operadores pueden ver sus notificaciones WhatsApp" 
ON whatsapp_notifications FOR SELECT 
USING (
  operator_id = (SELECT id FROM operators WHERE user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Solo admins pueden insertar notificaciones WhatsApp" 
ON whatsapp_notifications FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
```

## Costos y Limitaciones

### Estructura de Costos Twilio (USD)

#### Mensajes WhatsApp Business API
- **Mensaje de plantilla (template)**: $0.0085 por mensaje (Chile)
- **Mensaje de conversación**: $0.015 por mensaje (Chile)
- **Mensaje de marketing**: $0.025 por mensaje (Chile)

#### Estimación de Uso Mensual
**Escenario Base: 50 servicios/día, 5 operadores**
- Notificaciones de servicio: 50 msg/día × 30 días = 1,500 mensajes
- Recordatorios (20%): 300 mensajes
- Confirmaciones de operadores: 1,500 mensajes (gratuitas en ventana de 24h)
- **Costo mensual estimado**: ~$15-20 USD

**Escenario Alto: 150 servicios/día, 10 operadores**
- Notificaciones de servicio: 4,500 mensajes
- Recordatorios y urgentes: 900 mensajes
- **Costo mensual estimado**: ~$45-60 USD

### Limitaciones Técnicas

#### Twilio WhatsApp Business API
- **Rate limits**: 80 mensajes/segundo por número
- **Plantillas**: Máximo 20 plantillas activas
- **Ventana de conversación**: 24 horas para mensajes gratuitos
- **Tipos de media**: Imágenes, PDFs, audio (con limitaciones)

#### Meta WhatsApp Business API
- **Proceso de aprobación**: 1-2 semanas
- **Plantillas obligatorias**: Para mensajes iniciados por empresa
- **Restricciones de contenido**: No spam, no automatización excesiva
- **Números verificados**: Solo números verificados de empresa

### Alternativas de Bajo Costo

#### Opción 1: WhatsApp Web Automation (No recomendado)
- **Costo**: Gratuito
- **Riesgos**: Violación de términos de servicio, baneos de cuenta
- **Limitaciones**: No API oficial, inestable

#### Opción 2: SMS como Fallback
- **Costo**: ~$0.02 por SMS (Chile)
- **Ventajas**: Mayor confiabilidad, no requiere aprobaciones
- **Desventajas**: Menor engagement, sin funcionalidades multimedia

#### Opción 3: Implementación Híbrida
- WhatsApp para notificaciones importantes
- SMS para recordatorios
- Push notifications como backup

## Testing y Troubleshooting

### Setup de Testing

#### 1. Configuración de Sandbox
```bash
# Twilio Sandbox WhatsApp
# Número de sandbox: +1 415 523 8886
# Mensaje de activación: "join [sandbox-code]"
# Ejemplo: "join gravity-falcon"
```

#### 2. Variables de Test
```env
# Para desarrollo
TWILIO_ACCOUNT_SID=ACxxxxx_TEST_xxxxx
TWILIO_AUTH_TOKEN=xxxxx_TEST_xxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_TEST_MODE=true
```

#### 3. Script de Testing
```typescript
// test-whatsapp.ts
const testWhatsAppIntegration = async () => {
  const testCases = [
    {
      name: 'Envío básico',
      data: {
        operatorId: 'test-operator-id',
        serviceId: 'test-service-id',
        messageType: 'service_assigned',
        templateData: {
          folio: 'TEST-001',
          clientName: 'Cliente de Prueba',
          address: 'Dirección de prueba',
          serviceDate: '2024-12-15',
          serviceType: 'Mantención'
        }
      }
    },
    {
      name: 'Comando de confirmación',
      webhook: {
        Body: 'CONFIRMO',
        From: 'whatsapp:+56912345678',
        MessageSid: 'test-message-sid'
      }
    }
  ];

  for (const test of testCases) {
    console.log(`Testing: ${test.name}`);
    // Implementar lógica de testing
  }
};
```

### Problemas Comunes y Soluciones

#### 1. Mensajes No Entregados
**Síntomas:**
- Status "failed" en Twilio Console
- Error 21610: "Recipient not available"

**Soluciones:**
```typescript
// Verificar formato de número
const formatPhoneNumber = (phone: string): string => {
  // Remover espacios y caracteres especiales
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Agregar código de país si no existe
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('56')) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('9')) {
      cleaned = '+56' + cleaned;
    } else {
      cleaned = '+569' + cleaned;
    }
  }
  
  return cleaned;
};

// Validar número antes de enviar
const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+56[9]\d{8}$/;
  return phoneRegex.test(phone);
};
```

#### 2. Webhooks No Recibidos
**Síntomas:**
- Respuestas de operadores no procesadas
- Estados no actualizados

**Debug:**
```typescript
// Agregar logs detallados en webhook handler
console.log('Webhook headers:', Object.fromEntries(req.headers.entries()));
console.log('Webhook body raw:', await req.text());

// Verificar configuración de webhook en Twilio Console
// Messaging > WhatsApp > Senders > [tu-numero] > Webhook configuration
```

#### 3. Rate Limiting
**Síntomas:**
- Error 429: "Too Many Requests"
- Mensajes rechazados

**Solución:**
```typescript
// Implementar cola de mensajes
import { Queue } from 'https://deno.land/x/queue@1.2.0/mod.ts';

const messageQueue = new Queue();

const processMessageQueue = async () => {
  while (true) {
    const message = await messageQueue.pop();
    if (message) {
      await sendWhatsAppMessage(message);
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo entre mensajes
    }
  }
};
```

#### 4. Plantillas Rechazadas
**Síntomas:**
- Error 63016: "Template not approved"
- Mensajes no enviados

**Solución:**
1. Revisar políticas de plantillas de Meta
2. Evitar URLs acortadas
3. No usar emojis en exceso
4. Incluir opt-out instructions
5. Re-enviar para aprobación

#### 5. Problemas de Encoding
**Síntomas:**
- Caracteres especiales mal mostrados
- Emojis no renderizados

**Solución:**
```typescript
// Asegurar UTF-8 encoding
const encodeMessage = (message: string): string => {
  return encodeURIComponent(message).replace(/%20/g, '+');
};

// Validar caracteres especiales
const sanitizeMessage = (message: string): string => {
  return message
    .replace(/[^\u0000-\u007F\u00A0-\u00FF\u2600-\u26FF\u2700-\u27BF]/g, '')
    .trim();
};
```

### Logs y Monitoring

#### 1. Dashboard de Métricas
```sql
-- Query para métricas de WhatsApp
SELECT 
  DATE(sent_at) as date,
  message_type,
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
  COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
  COUNT(CASE WHEN operator_response IS NOT NULL THEN 1 END) as responses
FROM whatsapp_notifications 
WHERE sent_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(sent_at), message_type, status
ORDER BY date DESC;
```

#### 2. Alertas Automáticas
```typescript
// Verificar mensajes no entregados
const checkFailedMessages = async () => {
  const { data: failedMessages } = await supabase
    .from('whatsapp_notifications')
    .select('*')
    .eq('status', 'failed')
    .gte('sent_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

  if (failedMessages && failedMessages.length > 5) {
    // Enviar alerta a administradores
    await sendAdminAlert(`${failedMessages.length} mensajes WhatsApp fallaron en la última hora`);
  }
};
```

#### 3. Health Check
```typescript
// Edge function: whatsapp-health-check
serve(async (req) => {
  const healthData = {
    twilioConnection: await testTwilioConnection(),
    webhookUrl: Deno.env.get('WHATSAPP_WEBHOOK_URL'),
    lastMessage: await getLastMessageTime(),
    failedMessages: await getFailedMessageCount(),
    timestamp: new Date().toISOString()
  };

  return new Response(JSON.stringify(healthData), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

## Conclusiones y Próximos Pasos

### Beneficios Esperados
1. **Comunicación más efectiva** con operadores en campo
2. **Reducción de errores** por falta de confirmación
3. **Mejora en tiempos de respuesta** y coordinación
4. **Trazabilidad completa** de comunicaciones
5. **Automatización** de procesos repetitivos

### Próximos Pasos Recomendados
1. **Evaluación de proveedores**: Completar análisis de costos con Twilio
2. **Prueba de concepto**: Implementar sandbox de desarrollo
3. **Capacitación de operadores**: Preparar manual de uso
4. **Plan de migración**: Definir estrategia de rollout gradual
5. **Métricas de éxito**: Establecer KPIs de adopción y efectividad

### Riesgos y Mitigaciones
- **Dependencia externa**: Tener plan de contingencia con SMS
- **Costos escalables**: Implementar alertas de presupuesto
- **Aprobación de plantillas**: Tener templates de backup aprobadas
- **Capacitación de usuarios**: Plan de onboarding gradual

---

**Documento preparado para:** TMS Grúas  
**Fecha:** Diciembre 2024  
**Versión:** 1.0  
**Estado:** Pendiente de implementación

Para cualquier consulta técnica sobre esta integración, contactar al equipo de desarrollo.