

# Plan: Vista Detallada del Proveedor

## Objetivo

Crear un modal de vista detallada para cada proveedor que muestre toda la información relacionada:
- Información general del proveedor
- Documentos/facturas asociadas
- Pagos realizados y pendientes
- Estado de cuenta (trazabilidad completa)
- Movimientos de inventario y piezas vinculadas

---

## Diseño de la Vista

### Estructura con Tabs

```text
┌─────────────────────────────────────────────────────────────────────┐
│  ✕  Detalles del Proveedor: [Nombre]                                │
├─────────────────────────────────────────────────────────────────────┤
│  [General] [Documentos] [Pagos] [Inventario] [Piezas]               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │ Total Pendiente      │  │ Total Pagado         │                 │
│  │ $1,234,567           │  │ $5,678,901           │                 │
│  │ ● 5 documentos       │  │ ● 12 pagos           │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                 │
│  │ Vencido              │  │ Movimientos          │                 │
│  │ $234,567             │  │ Inventario           │                 │
│  │ ● 2 documentos       │  │ ● 8 movimientos      │                 │
│  └──────────────────────┘  └──────────────────────┘                 │
│                                                                      │
│  [Contenido del tab activo...]                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tabs y Contenido

### Tab 1: General
- Información del proveedor (nombre, RUT, contacto, teléfono, email, dirección)
- Categoría
- Estado (activo/inactivo)
- Notas
- Fecha de creación

### Tab 2: Documentos (Facturas)
Tabla con:
| Folio | Fecha Emisión | Vencimiento | Monto Total | Estado | Saldo |
Lista desde `supplier_invoices` filtrada por `supplier_id`

### Tab 3: Pagos
Tabla con todos los pagos desde `supplier_payments`:
| Descripción | Ref. | Monto | Vencimiento | Estado | F. Pago |
- Indicador visual por estado (pendiente/pagado/vencido)
- Detalle de parte/pieza si aplica

### Tab 4: Inventario
Movimientos desde `inventory_movements` donde `supplier_id = proveedor`:
| Fecha | Tipo | Artículo | Cantidad | Costo Total |

### Tab 5: Piezas
Registros desde `crane_parts` donde `supplier_id = proveedor`:
| Fecha | Grúa | Pieza | Cantidad | Valor Total |

---

## Implementación Técnica

### Archivos a Crear

| # | Archivo | Descripción |
|---|---------|-------------|
| 1 | `src/components/suppliers/SupplierDetailModal.tsx` | Componente principal del modal |
| 2 | `src/components/suppliers/detail/SupplierGeneralTab.tsx` | Tab de información general |
| 3 | `src/components/suppliers/detail/SupplierDocumentsTab.tsx` | Tab de facturas/documentos |
| 4 | `src/components/suppliers/detail/SupplierPaymentsTab.tsx` | Tab de pagos |
| 5 | `src/components/suppliers/detail/SupplierInventoryTab.tsx` | Tab de movimientos inventario |
| 6 | `src/components/suppliers/detail/SupplierPartsTab.tsx` | Tab de piezas de grúas |
| 7 | `src/hooks/useSupplierDetail.ts` | Hook para cargar todos los datos del proveedor |

### Archivos a Modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/components/suppliers/SupplierList.tsx` | Agregar click en fila para abrir modal de detalle |

### Hook useSupplierDetail

```typescript
export const useSupplierDetail = (supplierId: string | null) => {
  // Queries paralelas:
  // 1. supplier_payments donde supplier_id = id
  // 2. supplier_invoices donde supplier_id = id
  // 3. inventory_movements donde supplier_id = id
  // 4. crane_parts donde supplier_id = id
  // 5. get_supplier_traceability_stats(id) (RPC existente)
  
  return {
    payments,
    invoices,
    inventoryMovements,
    craneParts,
    stats,
    isLoading
  };
};
```

### Componente Principal

```typescript
// SupplierDetailModal.tsx
interface SupplierDetailModalProps {
  supplier: Supplier | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SupplierDetailModal: React.FC<...> = ({...}) => {
  const { payments, invoices, inventoryMovements, craneParts, stats } = 
    useSupplierDetail(supplier?.id);

  return (
    <Dialog>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Detalles del Proveedor: {supplier.name}</DialogTitle>
        </DialogHeader>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard title="Pendiente" value={stats.pending} />
          <StatsCard title="Pagado" value={stats.paid} />
          <StatsCard title="Vencido" value={stats.overdue} />
          <StatsCard title="Inventario" value={stats.inventory} />
        </div>
        
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
            <TabsTrigger value="inventory">Inventario</TabsTrigger>
            <TabsTrigger value="parts">Piezas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general">
            <SupplierGeneralTab supplier={supplier} />
          </TabsContent>
          {/* ... más tabs */}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
```

### Modificación a SupplierList

```typescript
// Agregar estado y handler
const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

// En la tabla, hacer la fila clickeable
<TableRow 
  onClick={() => setSelectedSupplier(supplier)}
  className="cursor-pointer hover:bg-muted/50"
>

// Agregar el modal
{selectedSupplier && (
  <SupplierDetailModal
    supplier={selectedSupplier}
    isOpen={!!selectedSupplier}
    onClose={() => setSelectedSupplier(null)}
  />
)}
```

---

## Patrones de Diseño (siguiendo Costs Module)

### Cards de Estadísticas
```tsx
<Card className="bg-card border">
  <CardContent className="p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Total Pendiente</p>
        <p className="text-2xl font-bold text-foreground">$1,234,567</p>
      </div>
      <DollarSign className="h-8 w-8 text-yellow-500" />
    </div>
    <p className="text-xs text-muted-foreground mt-1">5 documentos</p>
  </CardContent>
</Card>
```

### Badges de Estado
```tsx
<Badge variant="outline" className={getStatusColor(status)}>
  {getStatusLabel(status)}
</Badge>
```

### Tablas con Scroll
```tsx
<div className="max-h-64 overflow-y-auto">
  <Table>...</Table>
</div>
```

---

## Queries de Base de Datos

```sql
-- Pagos del proveedor
SELECT * FROM supplier_payments 
WHERE supplier_id = :id 
ORDER BY due_date DESC;

-- Facturas del proveedor
SELECT * FROM supplier_invoices 
WHERE supplier_id = :id 
ORDER BY due_date DESC;

-- Movimientos de inventario
SELECT * FROM inventory_movements 
WHERE supplier_id = :id 
ORDER BY movement_date DESC;

-- Piezas de grúas
SELECT cp.*, c.license_plate, c.brand 
FROM crane_parts cp
LEFT JOIN cranes c ON cp.crane_id = c.id
WHERE cp.supplier_id = :id 
ORDER BY cp.date DESC;
```

---

## Resultado Esperado

Al hacer click en cualquier proveedor de la lista:
1. Se abre un modal con toda la información detallada
2. Se pueden ver las estadísticas resumidas (totales pendientes, pagados, vencidos)
3. Se navega entre tabs para ver documentos, pagos, inventario y piezas
4. Trazabilidad completa desde el proveedor hasta cada módulo relacionado

