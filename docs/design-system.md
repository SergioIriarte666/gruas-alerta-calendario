# Guía visual de TMS Grúas

Esta guía es la única fuente normativa para crear, modificar o revisar la interfaz visual de la aplicación. Aplica al sistema administrativo, portal de operador, portal de cliente, PWA y diálogos compartidos.

## Autoridad y archivos canónicos

La responsabilidad está separada para evitar duplicaciones:

1. Este documento define las reglas y decisiones de uso.
2. `src/index.css` contiene los valores efectivos de los tokens para tema claro, oscuro y superficies operativas.
3. `tailwind.config.ts` expone esos tokens como utilidades semánticas.
4. `src/components/ui` contiene las primitivas reutilizables.
5. `src/utils/__tests__/globalVisualContract.test.ts` impide reintroducir estilos físicos o improvisados.

Ningún módulo puede declarar una paleta alternativa, rescatar clases antiguas con `!important` ni mantener una guía visual propia. Si otro documento contradice esta guía, prevalece esta guía y el otro documento debe corregirse.

## Dirección visual

TMS es una interfaz operacional de alta frecuencia: clara, compacta, sobria y trazable. La jerarquía se obtiene mediante tipografía, espaciado, superficie y contraste; el color se reserva para marca, foco y estados con significado.

Las superficies operativas comparten el lenguaje carbón + lima definido por los tokens `--dashboard-*`. Es una capa semántica sobre el sistema global, no una segunda paleta independiente. Los módulos no deben redefinir esos valores.

## Contrato de color

Los componentes consumen roles, nunca colores físicos.

| Rol | Uso obligatorio |
| --- | --- |
| `background` | fondo general de una vista |
| `card` / `surface` | tarjetas y bloques de contenido |
| `popover` / `surface-elevated` | menús, popovers y superficies elevadas |
| `muted` / `surface-sunken` | áreas secundarias, filtros y fondos suaves |
| `foreground` / `text` | texto principal |
| `text-strong` | encabezados de máxima jerarquía |
| `muted-foreground` / `text-muted` | texto secundario |
| `border` | separadores y bordes normales |
| `input` | borde de controles editables |
| `ring` | foco visible |
| `primary` | marca, acción principal y selección |
| `success` | resultado exitoso o completado |
| `warning` | atención, pendiente o próximo a vencer |
| `danger` | error, vencido o acción destructiva |
| `info` | información y progreso neutral |

Cada estado dispone de tres funciones:

- base: fondo sólido o icono destacado;
- `foreground`: contenido colocado sobre el fondo sólido;
- `text` y `soft`: texto legible y fondo suave para badges, alertas o filas.

Ejemplo válido:

```tsx
<div className="border border-warning/30 bg-warning-soft text-warning-text">
  Pago próximo a vencer
</div>
```

No se permiten clases basadas en nombres de paletas físicas, colores hexadecimales, RGB/HSL numérico dentro de componentes ni aliases históricos. Tampoco se permite compensar una clase incorrecta mediante CSS global.

### Excepciones de salida

Los artefactos que no heredan CSS —PDF, imágenes rasterizadas y ventanas HTML independientes— pueden necesitar valores estáticos. Esos valores representan roles de impresión, deben estar nombrados por función y no pueden reutilizarse como estilos de interfaz. El fondo blanco aplicado al convertir una imagen transparente a JPEG es una excepción técnica explícita.

## Apariencia configurable

Configuración → Apariencia permite ajustes seguros:

- tema claro, oscuro o sincronizado con el sistema;
- densidad cómoda o compacta;
- escala de lectura admitida por la aplicación;
- reducción de movimiento;
- menú lateral expandido o contraído;
- restauración de valores predeterminados.

`AppearanceContext` aplica los atributos de documento, guarda un respaldo local y sincroniza las preferencias por usuario en `user_settings`. `ThemeContext` resuelve y aplica el tema.

La pantalla de Apariencia no ofrece edición libre de colores, bordes, sombras o radios. Esos valores afectan contraste, estados, componentes y ambos temas; modificarlos individualmente rompería el contrato global. Una nueva personalización de marca solo puede incorporarse como un conjunto validado de tokens, nunca como valores libres por componente.

## Tipografía

- Familia principal: Montserrat con fallbacks del sistema.
- Cuerpo y controles: `text-sm` o `text-base` según densidad.
- Ayudas, metadatos y badges: `text-xs`.
- Título de sección: `text-base` o `text-lg` con peso semibold.
- Título de página: `text-2xl` con peso bold y tracking tight.
- KPI principal: `text-2xl` o mayor cuando el contenedor lo permita.
- Valores financieros: usar cifras tabulares cuando la comparación vertical sea importante.

No se admiten tamaños tipográficos arbitrarios. La densidad se controla mediante espaciado y las preferencias globales, no inventando escalas locales.

## Espaciado, tamaño y disposición

- Usar la escala estándar de Tailwind para padding, gap, alto y ancho.
- La unidad base de composición es 4 px; los tamaños táctiles deben alcanzar al menos 44 × 44 px.
- Una tabla puede declarar un ancho mínimo estructural en `rem` cuando necesita desplazamiento horizontal.
- Un overlay puede usar cálculos de viewport o variables de Radix para respetar el espacio disponible.
- Las medidas arbitrarias en píxeles están prohibidas en componentes.
- Móvil no es una tabla comprimida: debe priorizar tarjetas, columnas apiladas y acciones alcanzables.

Los valores estructurales en `rem`, `dvh`, `vw`, `calc()` o variables CSS son aceptables cuando expresan una restricción real de layout y no sustituyen una utilidad estándar.

## Bordes, radios y elevación

- Borde normal: `border` + `border-border` cuando sea necesario explicitarlo.
- Borde de estado: token semántico con opacidad moderada.
- Radio de control: `rounded-md` o el radio de la primitiva.
- Tarjeta: `rounded-xl`.
- Panel o diálogo destacado: `rounded-2xl` solo cuando la jerarquía lo justifique.
- Sombra: `shadow-sm`, `shadow-md` o `shadow-lg` según elevación.
- Glow: exclusivamente las utilidades semánticas declaradas en Tailwind.

No se permiten sombras arbitrarias en JSX. Las sombras especiales del shell operacional viven como tokens en `src/index.css`.

## Componentes canónicos

Antes de crear una estructura nueva, usar o extender una primitiva existente:

- `PageHeader`: título, descripción, badges y acciones de página;
- `MetricCard`: métricas con tonos semánticos;
- `StatusBadge` o `Badge`: estados de negocio;
- `SectionCard` y `Card`: agrupación de contenido;
- `Button`: acciones y estados destructivos;
- `Dialog`, `Sheet`, `Popover` y menús: overlays con foco y elevación consistentes;
- `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`: formularios;
- `Table`: datos tabulares;
- `Tabs`: navegación local;
- `Skeleton`, `Spinner`, alertas y toasts: feedback de sistema.

Las variantes nuevas deben definir fondo, texto, borde, hover, foco y estado deshabilitado con roles semánticos. No deben depender del selector de un scope para volverse legibles.

## Estados e interacción

- Hover comunica posibilidad de interacción sin alterar el significado del estado.
- Focus visible siempre usa `ring` y debe conservar contraste.
- Disabled reduce énfasis, pero mantiene texto reconocible.
- Selected usa `primary` o el rol operacional previsto.
- Destructive usa la variante destructiva de la primitiva.
- Pending, overdue, paid y completed se expresan por significado, no por un color hardcodeado.
- El texto y el icono deben acompañar al color; el color nunca es la única señal.

## Tema oscuro y contraste

El tema oscuro redefine los mismos roles en `.dark`; ningún componente necesita una paleta `dark:` paralela para corregir un color físico. Todo cambio visual debe revisarse en claro y oscuro.

Requisitos mínimos:

- contraste AA para texto normal y controles;
- foco visible por teclado;
- targets táctiles suficientes;
- zoom y escala de texto sin pérdida de contenido;
- soporte para `prefers-reduced-motion` y la preferencia interna;
- estados comprensibles sin depender únicamente del color.

## Gráficos, mapas y contenido externo

- Gráficos: consumir `--chart-1` a `--chart-6` o un rol semántico.
- Mapas: resolver tokens CSS con `resolveThemeColor`; no duplicar conversiones locales.
- Marcadores y popups: usar roles de estado y texto.
- PDF y exportaciones: usar roles estáticos de impresión con nombres funcionales.
- Logos e imágenes de terceros conservan sus colores oficiales y no definen la interfaz.

## Ejemplo de implementación

```tsx
<Card className="border-border/70 bg-card">
  <CardHeader>
    <CardTitle className="text-foreground">Resumen de pagos</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    <Badge variant="success">Pagado</Badge>
    <Button variant="outline">Ver detalle</Button>
  </CardContent>
</Card>
```

## Validación obligatoria

Antes de cerrar un cambio visual:

```bash
npx vitest run src/utils/__tests__/globalVisualContract.test.ts
npx tsc --noEmit
npm run lint
npm test -- --run
npm run build
npm run build:operator-mobile
git diff --check
```

El contrato global recorre `src` y rechaza colores físicos, colores arbitrarios, medidas fijas en píxeles, tipografía fuera de escala, colores directos y opacidades mal formadas.

## Cómo extender el sistema

Si un caso no está cubierto:

1. demostrar que no corresponde a un rol existente;
2. definir el nuevo rol en tema claro y oscuro dentro de `src/index.css`;
3. mapearlo en `tailwind.config.ts` si será consumido desde JSX;
4. extender la primitiva adecuada;
5. agregar o actualizar pruebas;
6. documentar el propósito aquí;
7. verificar todas las superficies afectadas.

No se crea el token si solo resuelve una pantalla, un color preferido o una excepción visual evitable.

## Estado de saneamiento

La migración global de módulos está cerrada. No existe una lista de estilos físicos “pendientes para después”, ni una capa de compatibilidad destinada a ocultarlos. Cualquier nueva infracción debe fallar en el contrato visual y corregirse antes de integrar el cambio.
