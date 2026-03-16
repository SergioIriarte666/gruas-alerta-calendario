

## Agrandar modal de Nuevo Servicio en desktop

El modal actual usa `max-w-6xl w-[95vw] max-h-[90vh]` — en desktop esto limita el ancho a ~1152px y la altura al 90% del viewport.

### Cambio propuesto

En `src/components/services/ServicesDialogs.tsx` (línea 56), cambiar las clases del `DialogContent` del formulario de servicio:

- **Ancho**: De `max-w-6xl` a `max-w-[95vw] lg:max-w-[90vw] xl:max-w-[1400px]` — más amplio en pantallas grandes
- **Alto**: De `max-h-[90vh]` a `max-h-[95vh]` — aprovechar más espacio vertical
- **Padding**: Ajustar padding en desktop: `lg:p-8`

Clase final:
```
w-[95vw] lg:max-w-[90vw] xl:max-w-[1400px] max-h-[95vh] overflow-hidden p-3 sm:p-6 lg:p-8
```

Esto solo afecta la vista desktop (>1024px), manteniendo el comportamiento móvil/tablet intacto. Un solo archivo modificado.

