

# Agregar filtro "Vence esta semana" en Facturacion

## Que se hara

Agregar un nuevo boton de filtro en la barra de estados de facturas que muestre solo las facturas cuya fecha de vencimiento cae dentro de la semana en curso (lunes a domingo). Este filtro es independiente del estado -- mostrara facturas enviadas o borradores que vencen esta semana, no las ya pagadas ni anuladas.

## Cambios

### Archivo: `src/pages/Invoices.tsx`

1. **Agregar entrada al mapa de filtros** (linea 26-33): Agregar la clave `due_this_week` con label "Vence esta semana" al objeto `INVOICE_STATUS_MAP`, posicionandola entre "Enviada" y "Pagada".

2. **Actualizar logica de filtrado** (linea 108): Modificar la condicion `matchesStatus` para que cuando `statusFilter === 'due_this_week'`, filtre facturas cuya `dueDate` este entre el lunes y domingo de la semana actual, y cuyo estado no sea `paid` ni `cancelled`.

```
Logica del filtro:
- Calcular inicio de semana (lunes) y fin de semana (domingo)
- Incluir facturas donde: dueDate >= lunes AND dueDate <= domingo
- Excluir facturas con estado "paid" o "cancelled"
```

### Resultado

- Aparece un nuevo boton "Vence esta semana" en la barra de filtros, con el mismo estilo visual que los demas
- Al hacer clic, muestra solo facturas activas (no pagadas/anuladas) con vencimiento en la semana en curso
- Las metricas y paginacion se recalculan automaticamente con el filtro aplicado

