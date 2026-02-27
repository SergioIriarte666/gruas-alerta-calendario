
# Plan: Hacer colapsable la seccion "Top Categorias"

## Cambio
Convertir la Card de "Top Categorias" en un componente colapsable usando `Collapsible` de Radix UI (ya disponible en el proyecto). La seccion iniciara colapsada por defecto para ahorrar espacio.

## Archivo a modificar
**`src/components/costs/CostsDashboard.tsx`** (lineas 228-258)

### Detalle
- Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` desde `@/components/ui/collapsible`
- Importar `ChevronDown` de lucide-react (si no esta importado)
- Envolver el contenido de la Card con `Collapsible` (defaultOpen={false})
- El titulo "Top Categorias (periodo)" se convierte en `CollapsibleTrigger` con un icono chevron que rota al abrir
- La lista de categorias va dentro de `CollapsibleContent`
- Estilo del trigger: cursor pointer, flex con justify-between, chevron con transicion de rotacion

### Resultado visual
- Por defecto: se ve solo el titulo "Top Categorias (periodo)" con un chevron a la derecha
- Al hacer clic: se expande mostrando las barras de progreso por categoria
- Ocupa minimo espacio cuando esta cerrado
