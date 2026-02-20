
# Fix: Scroll automatico en dropdowns Select

## Problema

Los Select dropdowns no se desplazan automaticamente al pasar el mouse sobre las flechas de scroll cuando estan dentro de Dialog/modales. Afecta Reportes (Costos, Finanzas) y cualquier otro modulo que use Select dentro de dialogos.

La causa es que Radix Dialog aplica `pointer-events: none` y los botones de scroll del Select no reciben el evento hover necesario para activar el auto-scroll.

## Solucion

### Archivo: `src/components/ui/select.tsx`

Agregar `pointer-events-auto` en 3 lugares:

1. **SelectScrollUpButton** (clase CSS) - para que la flecha superior reciba hover
2. **SelectScrollDownButton** (clase CSS) - para que la flecha inferior reciba hover  
3. **SelectContent** (clase CSS) - para que todo el contenido del dropdown reciba eventos de puntero

Esto es el mismo patron que ya se aplico exitosamente al componente Calendar.
