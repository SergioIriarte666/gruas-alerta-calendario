

# Plan: Actualizar Documentación con Controles ToggleGroup

## Objetivo
Actualizar el archivo `docs/technical/pre-service-inspection-specification.md` para incluir la implementación de los controles visuales de selección (ToggleGroup) para Combustible, Llaves y Documentación del vehículo.

---

## Cambios a Realizar

### 1. Sección 4 - Esquema de Validación (Zod)

Actualizar el esquema para reflejar los nuevos tipos `z.enum`:

```typescript
// Antes (líneas 98-101):
kilometraje: z.string().min(1, 'El kilometraje es requerido'),
combustible: z.string().min(1, 'El nivel de combustible es requerido'),
llaves: z.string().min(1, 'El estado de las llaves es requerido'),
documentacion: z.string().min(1, 'El estado de la documentación es requerido'),

// Después:
kilometraje: z.string().min(1, 'El kilometraje es requerido'),
combustible: z.enum(['0', '1/4', '1/2', '3/4', 'full'], {
  required_error: 'El nivel de combustible es requerido',
}),
llaves: z.enum(['si', 'no'], {
  required_error: 'El estado de las llaves es requerido',
}),
documentacion: z.enum(['si', 'no'], {
  required_error: 'El estado de la documentación es requerido',
}),
```

---

### 2. Nueva Sección 6.7 - Controles de Registro del Vehículo

Agregar documentación detallada de los nuevos componentes ToggleGroup:

```text
### 6.7 Controles de Registro del Vehículo (ToggleGroups)

Los campos de registro del vehículo utilizan controles ToggleGroup 
de Radix UI para una experiencia táctil optimizada en móviles.

#### Nivel de Combustible
- Componente: `ToggleGroup` con `type="single"`
- Opciones: `0`, `1/4`, `1/2`, `3/4`, `Full`
- Estilo seleccionado: `bg-violet-600 text-white border-violet-600`
- Estilo no seleccionado: `bg-background border-border text-foreground`

#### Llaves del Vehículo
- Componente: `ToggleGroup` con `type="single"`
- Opciones: `SÍ` (con icono Check), `NO` (con icono X)
- Estilo SÍ seleccionado: `bg-emerald-500 text-white border-emerald-500`
- Estilo NO seleccionado: `bg-red-500 text-white border-red-500`

#### Documentación del Vehículo
- Misma implementación que Llaves del Vehículo
- Valores: `si` | `no`

**Diseño Visual:**
┌──────────────────────────────────────────────────────────────────┐
│  Registro del Vehículo                                           │
├──────────────┬─────────────────────┬────────────┬───────────────┤
│ Kilometraje  │ Nivel Combustible   │ Llaves     │ Documentación │
│ ┌──────────┐ │ ┌──┬────┬────┬────┬────┐ │ ┌────┬────┐ │ ┌────┬────┐ │
│ │ 125000   │ │ │0 │1/4 │1/2 │3/4 │Full│ │ │ SÍ │ NO │ │ │ SÍ │ NO │ │
│ └──────────┘ │ └──┴────┴────┴────┴────┘ │ └────┴────┘ │ └────┴────┘ │
└──────────────┴─────────────────────┴────────────┴───────────────┘

**Comportamiento:**
- Solo una opción puede estar seleccionada a la vez
- Validación Zod asegura selección obligatoria
- Persistencia en localStorage igual que otros campos
- Exportación a PDF como texto legible ("3/4", "Sí", "No")
```

---

### 3. Actualizar Sección 15 - Dependencias

Agregar la dependencia de ToggleGroup:

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toggle-group": "^1.1.0",  // NUEVO
    "jspdf": "^3.0.1",
    "jspdf-autotable": "^5.0.2",
    "lucide-react": "^0.462.0",
    "react-hook-form": "^7.53.0",
    "react-signature-canvas": "^1.1.0-alpha.2",
    "zod": "^3.23.8"
  }
}
```

---

### 4. Agregar Sección de Implementación de Controles

Insertar código de referencia para los ToggleGroups:

```typescript
// Ejemplo de implementación del campo Combustible
<FormField
  control={form.control}
  name="combustible"
  render={({ field }) => (
    <FormItem>
      <FormLabel className="flex items-center gap-2 text-foreground">
        <Fuel className="w-4 h-4" />
        Nivel de Combustible
      </FormLabel>
      <FormControl>
        <ToggleGroup 
          type="single" 
          value={field.value} 
          onValueChange={(value) => value && field.onChange(value)}
          className="flex flex-wrap gap-1"
        >
          {['0', '1/4', '1/2', '3/4', 'full'].map((level) => (
            <ToggleGroupItem
              key={level}
              value={level}
              className={`px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
                field.value === level
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-background border-border text-foreground hover:bg-muted'
              }`}
            >
              {level === 'full' ? 'Full' : level}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>

// Ejemplo de implementación del campo Llaves
<FormField
  control={form.control}
  name="llaves"
  render={({ field }) => (
    <FormItem>
      <FormLabel className="flex items-center gap-2 text-foreground">
        <Key className="w-4 h-4" />
        Llaves del Vehículo
      </FormLabel>
      <FormControl>
        <ToggleGroup 
          type="single" 
          value={field.value} 
          onValueChange={(value) => value && field.onChange(value)}
          className="flex gap-2"
        >
          <ToggleGroupItem
            value="si"
            className={`px-4 py-2 text-sm font-medium border rounded-md transition-colors flex items-center gap-2 ${
              field.value === 'si'
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-background border-border text-foreground hover:bg-muted'
            }`}
          >
            <Check className="w-4 h-4" />
            SÍ
          </ToggleGroupItem>
          <ToggleGroupItem
            value="no"
            className={`px-4 py-2 text-sm font-medium border rounded-md transition-colors flex items-center gap-2 ${
              field.value === 'no'
                ? 'bg-red-500 text-white border-red-500'
                : 'bg-background border-border text-foreground hover:bg-muted'
            }`}
          >
            <X className="w-4 h-4" />
            NO
          </ToggleGroupItem>
        </ToggleGroup>
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `docs/technical/pre-service-inspection-specification.md` | Actualizar esquema Zod, agregar sección 6.7, actualizar dependencias, agregar ejemplos de código |

---

## Resultado Esperado

El documento técnico quedará completamente actualizado con:
1. Esquema Zod con tipos `z.enum` para combustible, llaves y documentación
2. Nueva sección documentando los controles ToggleGroup
3. Diseño visual ASCII del layout
4. Ejemplos de código completos para replicar la implementación
5. Dependencia `@radix-ui/react-toggle-group` incluida

