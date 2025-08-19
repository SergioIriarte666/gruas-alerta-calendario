# PROMPT CRÍTICO PARA IA: Solución Definitiva del Sistema de Comisiones

## 🚨 PROBLEMA CRÍTICO IDENTIFICADO

El sistema de comisiones del TMS Grúas v2.1.0 tiene un BUG CRÍTICO donde las comisiones NO aparecen en el módulo de comisiones a pesar de existir en la base de datos.

## 📊 CONTEXTO TÉCNICO COMPLETO

### Stack Tecnológico
- **Frontend**: React 18.3.1 + TypeScript + Supabase
- **Backend**: Supabase PostgreSQL con RLS
- **Query**: React Query (@tanstack/react-query)

### Estructura de Datos Actual

#### Tabla `costs` (donde se almacenan las comisiones)
```sql
-- Estructura crítica de la tabla costs
CREATE TABLE public.costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL, -- Para comisiones: '440296d4-09c2-4f3a-b02b-835f861df4c4'
  subcategory TEXT, -- 'comisiones' | 'comisiones_pagadas' | NULL
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  operator_id UUID, -- ESTE CAMPO ES CRÍTICO - debe estar presente
  service_id UUID,
  service_folio TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID
);
```

#### Función SQL Crítica
```sql
-- Esta función es la que usa el frontend para obtener comisiones
CREATE OR REPLACE FUNCTION public.get_commissions_with_details()
RETURNS TABLE (
  id UUID,
  date DATE,
  description TEXT,
  amount NUMERIC,
  operator_id UUID,
  service_id UUID,
  service_folio TEXT,
  subcategory TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  service_value NUMERIC,
  service_date DATE,
  client_name TEXT,
  operator_name TEXT,
  operator_rut TEXT
) 
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id, c.date, c.description, c.amount, c.operator_id, c.service_id,
    c.service_folio, c.subcategory, c.created_at, c.updated_at,
    s.value as service_value, s.service_date,
    cl.name as client_name, o.name as operator_name, o.rut as operator_rut
  FROM public.costs c
  LEFT JOIN public.services s ON c.service_id = s.id
  LEFT JOIN public.clients cl ON s.client_id = cl.id  
  LEFT JOIN public.operators o ON c.operator_id = o.id
  WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
    AND c.operator_id IS NOT NULL  -- FILTRO CRÍTICO
    AND (c.subcategory = 'comisiones' OR c.subcategory = 'comisiones_pagadas' OR c.subcategory IS NULL)
  ORDER BY c.created_at DESC;
END;
$$;
```

### Hook Frontend Crítico
```typescript
// src/hooks/commissions/useCommissions.ts
export const useCommissions = () => {
  return useQuery({
    queryKey: ['commissions'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_commissions_with_details');
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
};
```

## 🔍 PROBLEMA ESPECÍFICO DETECTADO

### Caso Problemático: Servicio 3008437-1
- **Service ID Real**: `2a67bcf6-93e5-4b46-94f1-2a706caeb72e`
- **Folio**: `3008437-1`
- **Operador**: Jesus Rojas (ID: `33c85259-f9d5-4c1b-87f4-c8b5b7c8a5d3`)

### Estado Actual de la Comisión
```sql
-- Query que muestra el problema
SELECT 
  id, description, amount, operator_id, service_id, service_folio, subcategory
FROM costs 
WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
  AND service_folio = '3008437-1';

-- RESULTADO PROBLEMÁTICO:
-- La comisión existe pero operator_id puede estar NULL o mal asignado
```

## 🚨 CAUSAS IDENTIFICADAS

1. **operator_id faltante**: Comisiones sin `operator_id` no aparecen en el módulo
2. **service_id incorrecto**: Relaciones rotas entre servicios y comisiones
3. **Generación automática defectuosa**: Los triggers fueron deshabilitados pero la generación manual es inconsistente

## 🛠️ SOLUCIÓN REQUERIDA (DEFINITIVA)

### 1. DIAGNÓSTICO COMPLETO
Ejecutar esta query para identificar TODAS las comisiones problemáticas:

```sql
-- Encuentra todas las comisiones sin operator_id
SELECT 
  c.id, c.service_folio, c.description, c.amount,
  c.operator_id, c.service_id, c.subcategory,
  s.operator_id as service_operator_id,
  o.name as operator_name
FROM costs c
LEFT JOIN services s ON c.service_id = s.id
LEFT JOIN operators o ON s.operator_id = o.id
WHERE c.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
  AND c.operator_id IS NULL
ORDER BY c.created_at DESC;
```

### 2. CORRECCIÓN MASIVA
Script para corregir todas las comisiones sin operator_id:

```sql
-- Actualizar todas las comisiones faltantes de operator_id
UPDATE costs 
SET operator_id = services.operator_id,
    updated_at = now()
FROM services 
WHERE costs.service_id = services.id 
  AND costs.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
  AND costs.operator_id IS NULL
  AND services.operator_id IS NOT NULL;
```

### 3. VERIFICACIÓN POST-CORRECCIÓN
```sql
-- Verificar que no queden comisiones sin operator_id
SELECT COUNT(*) as comisiones_sin_operador
FROM costs 
WHERE category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4'
  AND operator_id IS NULL;

-- Debe retornar 0
```

### 4. PREVENCIÓN FUTURA
Crear trigger para asegurar consistencia:

```sql
-- Trigger para asegurar que todas las comisiones tengan operator_id
CREATE OR REPLACE FUNCTION ensure_commission_operator_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Si es una comisión y no tiene operator_id, intentar obtenerlo del servicio
  IF NEW.category_id = '440296d4-09c2-4f3a-b02b-835f861df4c4' 
     AND NEW.operator_id IS NULL 
     AND NEW.service_id IS NOT NULL THEN
    
    SELECT operator_id INTO NEW.operator_id 
    FROM services 
    WHERE id = NEW.service_id;
    
    -- Si aún no tiene operator_id, evitar la inserción
    IF NEW.operator_id IS NULL THEN
      RAISE EXCEPTION 'Las comisiones deben tener un operator_id válido';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_commission_operator_id
  BEFORE INSERT OR UPDATE ON costs
  FOR EACH ROW
  EXECUTE FUNCTION ensure_commission_operator_id();
```

## 📝 ACCIONES PARA LA IA

1. **EJECUTAR** el diagnóstico completo para identificar todas las comisiones problemáticas
2. **CORREGIR** todas las comisiones sin operator_id usando el script de corrección masiva
3. **VERIFICAR** que no queden comisiones sin operator_id
4. **IMPLEMENTAR** el trigger de prevención
5. **PROBAR** el módulo de comisiones para confirmar que todas aparecen correctamente
6. **DOCUMENTAR** los cambios realizados

## 🔧 ARCHIVOS CRÍTICOS A REVISAR

- `src/hooks/commissions/useCommissions.ts` - Hook principal
- `src/pages/Commissions.tsx` - Página del módulo
- `supabase/migrations/20250723210632-*` - Función SQL actual
- `docs/COMMISSIONS.md` - Documentación del sistema

## ⚠️ REGLAS CRÍTICAS

1. **NO TOCAR** la lógica de negocio de generación de comisiones
2. **SOLO CORREGIR** los datos inconsistentes existentes
3. **ASEGURAR** que todas las comisiones tengan operator_id válido
4. **VERIFICAR** que la función SQL retorne todos los registros esperados
5. **DOCUMENTAR** todos los cambios en `docs/CRISIS_COMISIONES.md`

## 🎯 RESULTADO ESPERADO

Después de la corrección:
- ✅ Todas las comisiones aparecen en el módulo de comisiones
- ✅ No hay comisiones sin operator_id
- ✅ La función `get_commissions_with_details()` retorna todos los registros
- ✅ El sistema es consistente y confiable

## 📞 CONTEXTO FINAL

Este es un sistema financiero crítico donde las comisiones representan dinero real. 
**NO SE PERMITEN PARCHES** - necesita una solución definitiva y robusta.

La corrección debe ser **COMPLETA**, **VERIFICADA** y **DOCUMENTADA**.