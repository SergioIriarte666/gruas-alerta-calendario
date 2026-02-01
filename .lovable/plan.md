

# Plan: Mejorar Celdas de Registro del Vehiculo

## Objetivo
Convertir los campos de texto libre del "Registro del Vehiculo" en controles de seleccion visual mas intuitivos para uso en dispositivos moviles.

## Cambios Requeridos

### 1. Nivel de Combustible
**Estado Actual**: Input de texto con placeholder "Ej: 3/4, 1/2, Lleno"
**Nuevo Diseno**: ToggleGroup horizontal con 5 opciones visuales:
- `0` (Vacio)
- `1/4` (Un cuarto)  
- `1/2` (Medio tanque)
- `3/4` (Tres cuartos)
- `Full` (Lleno)

Implementacion con iconos de combustible y estados visuales claros (seleccionado = fondo violet-600).

### 2. Llaves del Vehiculo
**Estado Actual**: Input de texto con placeholder "Ej: Entregadas, No disponibles"
**Nuevo Diseno**: Dos botones toggle Si/No con checkbox visual:
- `SI` - Llaves entregadas (verde cuando seleccionado)
- `NO` - Sin llaves (rojo cuando seleccionado)

### 3. Documentacion del Vehiculo
**Estado Actual**: Input de texto con placeholder "Ej: Completa, Incompleta"  
**Nuevo Diseno**: Dos botones toggle Si/No:
- `SI` - Documentacion completa (verde cuando seleccionado)
- `NO` - Documentacion incompleta (rojo cuando seleccionado)

---

## Archivos a Modificar

### 1. `src/components/operator/InspectionFormSections.tsx`

```text
Cambios:
- Importar ToggleGroup y ToggleGroupItem de @/components/ui/toggle-group
- Importar Check y X de lucide-react para iconos

Campo Combustible (lineas 65-84):
- Reemplazar Input por ToggleGroup type="single"
- 5 ToggleGroupItem con valores: "0", "1/4", "1/2", "3/4", "full"
- Estilos: fondo blanco por defecto, violet-600 con texto blanco al seleccionar

Campo Llaves (lineas 86-105):
- Reemplazar Input por ToggleGroup type="single"
- 2 ToggleGroupItem: "si" y "no"
- Iconos Check/X para feedback visual
- Colores: verde (emerald-500) para SI, rojo (red-500) para NO

Campo Documentacion (lineas 107-126):
- Reemplazar Input por ToggleGroup type="single"
- 2 ToggleGroupItem: "si" y "no"
- Misma logica de colores que Llaves
```

### 2. `src/schemas/inspectionSchema.ts`

```text
Actualizar validaciones:
- combustible: z.enum(['0', '1/4', '1/2', '3/4', 'full']) 
- llaves: z.enum(['si', 'no'])
- documentacion: z.enum(['si', 'no'])
```

---

## Diseno Visual

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Registro del Vehiculo                                                      │
├──────────────┬─────────────────────────┬──────────────┬─────────────────────┤
│ Kilometraje  │  Nivel de Combustible   │ Llaves del   │ Documentacion del   │
│ Actual       │                         │ Vehiculo     │ Vehiculo            │
│              │                         │              │                     │
│ ┌──────────┐ │ ┌──┬────┬────┬────┬────┐│ ┌────┬────┐  │ ┌────┬────┐         │
│ │ 125000   │ │ │0 │1/4 │1/2 │3/4 │Full││ │ SI │ NO │  │ │ SI │ NO │         │
│ └──────────┘ │ └──┴────┴────┴────┴────┘│ └────┴────┘  │ └────┴────┘         │
│              │       [3/4 selected]    │  [SI green]  │  [NO red]           │
└──────────────┴─────────────────────────┴──────────────┴─────────────────────┘
```

---

## Comportamiento

1. **Toggle Groups**: Solo una opcion puede estar seleccionada a la vez (type="single")
2. **Valores requeridos**: El esquema Zod validara que se seleccione una opcion
3. **Persistencia**: Los valores se guardan en localStorage igual que antes
4. **PDF**: Los valores se exportaran como texto legible ("3/4", "Si", "No")

---

## Estilos Consistentes con Modulo de Costos

- Botones sin seleccionar: `bg-background border-border text-foreground`
- Boton seleccionado (Combustible): `bg-violet-600 text-white border-violet-600`
- Boton SI seleccionado: `bg-emerald-500 text-white`
- Boton NO seleccionado: `bg-red-500 text-white`
- Hover: Transicion suave con `transition-colors`

