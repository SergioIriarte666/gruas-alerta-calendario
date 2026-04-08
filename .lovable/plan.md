

# Plan: Chat con tus Datos + Toggle en Configuración

## Resumen
Implementar el asistente de chat IA que consulta datos del TMS en lenguaje natural, junto con un toggle en Configuración > Sistema para activar/desactivar la funcionalidad.

## Cambios

### 1. Migración: agregar columna `ai_chat_enabled` a `system_settings`
```sql
ALTER TABLE system_settings 
ADD COLUMN ai_chat_enabled boolean NOT NULL DEFAULT true;
```

### 2. Edge Function `chat-with-data`
- Recibe `{ messages: [{role, content}] }` con historial de conversación
- System prompt incluye esquema resumido de tablas principales (services, costs, invoices, clients, cranes, operators, payments, incomes, crane_maintenance, inventory_items, debts)
- Flujo en 2 pasos: IA genera SQL (solo SELECT, whitelist de tablas) → ejecuta query → IA formatea respuesta en lenguaje natural
- Usa `OPENAI_API_KEY` con `gpt-4o-mini` (consistente con classify-cost y parse-receipt-image)
- Validación JWT + validación estricta de solo SELECT
- Timeout 5s por query, max 1000 filas

### 3. Componente `DataChatWidget`
- FAB flotante (icono MessageSquare) en esquina inferior derecha, posicionado sobre el QuickEntryFAB existente
- Panel expandible 400x600px con historial de mensajes + input
- Renderizado con `react-markdown` para tablas y formato
- Estado efímero (no persiste en BD)
- Indicador de "pensando..." mientras procesa
- Solo visible si `ai_chat_enabled` está activo en system_settings

### 4. Componente `ChatMessage`
- Burbuja de mensaje con diferenciación user/assistant
- Soporte markdown (tablas, listas, negrita)

### 5. Hook `useAiChatEnabled`
- Lee `ai_chat_enabled` de `system_settings` 
- Retorna boolean para condicionar la visibilidad del widget

### 6. Toggle en `SystemSettingsTab`
- Nueva sección "Asistente IA" con icono Bot/MessageSquare
- Switch para activar/desactivar el chat con datos
- Descripción: "Permite consultar datos del sistema usando lenguaje natural"
- Se guarda junto con el resto de system settings (misma lógica existente)

### 7. Integración en `Layout.tsx`
- Agregar `DataChatWidget` condicionado a `ai_chat_enabled`
- Solo visible para usuarios autenticados

## Archivos a crear
- `supabase/functions/chat-with-data/index.ts`
- `src/components/chat/DataChatWidget.tsx`
- `src/components/chat/ChatMessage.tsx`
- `src/hooks/useAiChatEnabled.ts`

## Archivos a modificar
- Migración SQL (nueva columna en system_settings)
- `src/hooks/useSystemSettings.ts` — agregar `ai_chat_enabled` al fetch/save
- `src/types/settings.ts` — agregar `aiChatEnabled` a `SystemSettings`
- `src/components/settings/SystemSettingsTab.tsx` — agregar sección toggle IA
- `src/components/layout/Layout.tsx` — montar widget

## Dependencias
- `react-markdown` (instalar)

