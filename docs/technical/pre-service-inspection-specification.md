# Prompt Técnico: Formulario de Inspección Pre-Servicio

## 1. Resumen del Módulo

Este documento especifica la implementación completa del formulario de **Inspección Pre-Servicio** utilizado por operadores de grúa para documentar el estado de los vehículos antes del servicio. El módulo incluye formularios interactivos, captura fotográfica, firmas digitales táctiles, generación de PDF y persistencia offline.

---

## 2. Stack Tecnológico Requerido

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| React | ^18.3.x | Framework UI |
| TypeScript | ^5.x | Tipado estático |
| React Hook Form | ^7.x | Gestión de formularios |
| Zod | ^3.x | Validación de esquemas |
| TanStack Query | ^5.x | Server state y mutaciones |
| jsPDF + jspdf-autotable | ^3.x / ^5.x | Generación de PDF |
| react-signature-canvas | ^1.x | Firma digital táctil |
| Tailwind CSS | ^3.x | Estilos |
| Radix UI | - | Componentes accesibles |
| Supabase | ^2.x | Backend y base de datos |

---

## 3. Estructura de Archivos

```text
src/
├── pages/operator/
│   └── ServiceInspection.tsx          # Página principal
├── components/operator/
│   ├── inspection/
│   │   ├── InspectionForm.tsx          # Formulario principal
│   │   ├── InspectionHeader.tsx        # Header con navegación
│   │   ├── InspectionStatusCard.tsx    # Estado de firmas/fases
│   │   ├── InspectionLoadingState.tsx  # Estado de carga
│   │   └── InspectionErrorState.tsx    # Estado de error
│   ├── InspectionFormSections.tsx      # Secciones del formulario
│   ├── VehicleEquipmentChecklist.tsx   # Checklist de inventario
│   ├── PhotographicSet.tsx             # Set fotográfico por categorías
│   ├── SignaturePad.tsx                # Componente de firma digital
│   ├── ServiceDetailsCard.tsx          # Card de detalles del servicio
│   └── PDFProgress.tsx                 # Indicador de progreso PDF
├── hooks/
│   ├── useServiceInspection.ts         # Hook principal del módulo
│   ├── useOperatorService.ts           # Fetch de servicio individual
│   ├── useInspectionPersistence.ts     # Persistencia localStorage
│   └── inspection/
│       ├── useInspectionPDF.ts         # Generación de PDF
│       ├── useInitialInspectionPDF.ts  # PDF de fase inicial
│       ├── useInspectionEmail.ts       # Envío por email
│       └── useServiceStatusUpdate.ts   # Actualización de estado
├── schemas/
│   └── inspectionSchema.ts             # Esquema Zod de validación
├── data/
│   └── equipmentData.ts                # Datos del inventario
├── utils/
│   ├── photoProcessor.ts               # Procesamiento de imágenes
│   ├── photoStorage.ts                 # Almacenamiento localStorage
│   ├── inspectionValidation.ts         # Validaciones pre-submit
│   ├── enhancedPdfGenerator.ts         # Generador PDF con progreso
│   ├── inspectionPdfGenerator.ts       # Generador PDF principal
│   └── pdf/
│       ├── pdfTypes.ts                 # Tipos para PDF
│       ├── pdfHeader.ts                # Header corporativo
│       ├── pdfSections.ts              # Re-exports
│       ├── pdfPhotos.ts                # Sección fotográfica
│       ├── pdfSignatures.ts            # Firmas digitales
│       ├── pdfValidation.ts            # Validación datos PDF
│       ├── companyDataFetcher.ts       # Datos empresa desde BD
│       ├── sections/
│       │   ├── serviceInfo.ts          # Info del servicio
│       │   ├── equipmentChecklist.ts   # Tabla de inventario
│       │   └── observations.ts         # Observaciones
│       └── photos/
│           ├── photoProcessor.ts       # Compresión para PDF
│           └── photoStorage.ts         # Acceso a localStorage
└── types/
    └── photo.ts                        # Tipos de fotos
```

---

## 4. Esquema de Validación (Zod)

```typescript
// src/schemas/inspectionSchema.ts
import { z } from 'zod';

export const inspectionFormSchema = z.object({
  // Inventario de equipamiento (requerido)
  equipment: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Debes verificar el estado del equipamiento.",
  }),
  
  // Registro del vehículo
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
  
  // Observaciones
  vehicleObservations: z.string().optional(),
  
  // Firmas digitales
  operatorSignature: z.string().min(1, 'La firma del operador es requerida'),
  clientSignature: z.string().optional(),
  clientName: z.string().optional(),
  clientRut: z.string().optional(),
  vehicleReceptionSignature: z.string().optional(),
  receptionPersonName: z.string().optional(),
  
  // Set fotográfico (requerido mínimo 1 foto)
  photographicSet: z.array(z.object({
    fileName: z.string().min(1, 'El nombre del archivo es requerido'),
    category: z.enum(['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'])
  })).refine((value) => value.length > 0, {
    message: "Debes tomar al menos 1 fotografía para el set fotográfico.",
  }),
});

export type InspectionFormValues = z.infer<typeof inspectionFormSchema>;
```

---

## 5. Datos del Inventario

```typescript
// src/data/equipmentData.ts
export interface EquipmentItem {
  id: string;
  name: string;
}

export interface EquipmentCategory {
  id: string;
  name: string;
  items: EquipmentItem[];
}

export const vehicleEquipment: EquipmentCategory[] = [
  {
    id: 'vehicle-inspection',
    name: 'Inspección del Vehículo',
    items: [
      { id: 'antena', name: 'Antena' },
      { id: 'baliza', name: 'Baliza' },
      { id: 'bateria', name: 'Batería' },
      { id: 'botiquin', name: 'Botiquín' },
      { id: 'caja-invierno', name: 'Caja Invierno' },
      { id: 'cenicero', name: 'Cenicero' },
      { id: 'chaleco-reflectante', name: 'Chaleco Reflectante' },
      { id: 'cint-seguridad', name: 'Cint. Seguridad' },
      { id: 'consola', name: 'Consola' },
      { id: 'cunas', name: 'Cuñas' },
      { id: 'emblemas', name: 'Emblemas' },
      { id: 'encendedor', name: 'Encendedor' },
      { id: 'espejo-exterior', name: 'Espejo Exterior' },
      { id: 'espejo-interno', name: 'Espejo Interno' },
      { id: 'extintor', name: 'Extintor' },
      { id: 'extintor-10k', name: 'Extintor 10 K.' },
      { id: 'gata', name: 'Gata' },
      { id: 'limp-parab', name: 'Limp. Parab.' },
      { id: 'llave-rueda', name: 'Llave Rueda' },
      { id: 'neblineros', name: 'Neblineros' },
      { id: 'parlantes', name: 'Parlantes' },
      { id: 'pertiga', name: 'Pértiga' },
      { id: 'piso-goma', name: 'Piso Goma' },
      { id: 'radio', name: 'Radio' },
      { id: 'rueda-del-izq', name: 'Rueda Del Izq.' },
      { id: 'rueda-del-der', name: 'Rueda Del.Der.' },
      { id: 'rueda-rpto', name: 'Rueda Rpto.' },
      { id: 'rueda-tra-der', name: 'Rueda Tra.Der.' },
      { id: 'rueda-tra-izq', name: 'Rueda Tra.Izq.' },
      { id: 'sombrilla', name: 'Sombrilla' },
      { id: 'tag', name: 'TAG' },
      { id: 'tapa-bencina', name: 'Tapa Bencina' },
      { id: 'tapa-radiador', name: 'Tapa Radiador' },
      { id: 'tapa-ruedas', name: 'Tapa Ruedas' },
      { id: 'triangulos', name: 'Triángulos' }
    ]
  }
];
```

---

## 6. Componentes Principales

### 6.1 Página Principal (ServiceInspection.tsx)

**Responsabilidades:**
- Obtener ID del servicio desde URL params
- Cargar datos del servicio vía `useServiceInspection`
- Renderizar estados de carga, error o formulario
- Mostrar progreso de generación de PDF

**Estados manejados:**
- Loading: Spinner con mensaje "Cargando servicio..."
- Error: Mensaje con opción de reintentar
- Sin ID: Mensaje de URL inválida
- OK: Renderiza formulario completo

### 6.2 Formulario Principal (InspectionForm.tsx)

**Responsabilidades:**
- Inicializar React Hook Form con esquema Zod
- Cargar datos persistidos desde localStorage
- Manejar fases (initial/final) del flujo de inspección
- Auto-guardar datos en cada cambio
- Validar antes de submit
- Llamar a la mutación de procesamiento

**Props:**
```typescript
interface InspectionFormProps {
  service: Service;
  serviceId: string;
  onSubmit: (values: InspectionFormValues, phase: 'initial' | 'final') => void;
  isProcessing: boolean;
  isGeneratingPDF: boolean;
  isUpdatingStatus: boolean;
}
```

### 6.3 Secciones del Formulario (InspectionFormSections.tsx)

**Orden de secciones:**
1. **Registro del Vehículo** - Kilometraje, Combustible, Llaves, Documentación
2. **Inventario del Vehículo** - Checklist de 35 items
3. **Set Fotográfico** - 6 categorías de fotos
4. **Observaciones y Firmas** - Textarea + 3 pads de firma

### 6.4 Checklist de Inventario (VehicleEquipmentChecklist.tsx)

**Características:**
- Grid de 3 columnas (responsive)
- Toggle visual con iconos Check/X
- Botones "Marcar Todo" y "Desmarcar Todo"
- Items clickeables con feedback visual
- Estado verde (SÍ) o rojo (NO)

### 6.5 Set Fotográfico (PhotographicSet.tsx)

**Categorías:**
- Izquierda, Derecha, Frontal, Trasera, Interior, Motor

**Características:**
- Tabs para cada categoría
- Indicador visual de fotos tomadas
- Captura directa desde cámara del dispositivo
- Preview de foto con opción de eliminar
- Contador de fotos/categorías completadas
- Almacenamiento en localStorage

### 6.6 Firma Digital (SignaturePad.tsx)

**Características:**
- Canvas táctil responsivo
- Soporte para dedo y stylus
- Prevención de scroll durante firma
- Botón limpiar firma
- Restauración de firma desde estado
- Exportación a base64 PNG
- Indicador visual de firma capturada

### 6.7 Controles de Registro del Vehículo (ToggleGroups)

Los campos de registro del vehículo utilizan controles ToggleGroup de Radix UI para una experiencia táctil optimizada en móviles.

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
```text
┌──────────────────────────────────────────────────────────────────┐
│  Registro del Vehículo                                           │
├──────────────┬─────────────────────┬────────────┬───────────────┤
│ Kilometraje  │ Nivel Combustible   │ Llaves     │ Documentación │
│ ┌──────────┐ │ ┌──┬────┬────┬────┬────┐ │ ┌────┬────┐ │ ┌────┬────┐ │
│ │ 125000   │ │ │0 │1/4 │1/2 │3/4 │Full│ │ │ SÍ │ NO │ │ │ SÍ │ NO │ │
│ └──────────┘ │ └──┴────┴────┴────┴────┘ │ └────┴────┘ │ └────┴────┘ │
└──────────────┴─────────────────────┴────────────┴───────────────┘
```

**Comportamiento:**
- Solo una opción puede estar seleccionada a la vez
- Validación Zod asegura selección obligatoria
- Persistencia en localStorage igual que otros campos
- Exportación a PDF como texto legible ("3/4", "Sí", "No")

**Implementación del campo Combustible:**
```typescript
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
```

**Implementación del campo Llaves:**
```typescript
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

## 7. Hooks Principales

### 7.1 useServiceInspection

Hook orquestador principal que combina:
- `useOperatorService` - Carga de datos del servicio
- `useInspectionPDF` - Generación de PDF
- `useInspectionEmail` - Envío por email
- `useServiceStatusUpdate` - Actualización de estado

**Retorna:**
```typescript
{
  id: string;
  service: Service;
  isLoading: boolean;
  error: Error;
  pdfProgress: number;
  pdfStep: string;
  isGeneratingPDF: boolean;
  processInspectionMutation: UseMutationResult;
  handleRetry: () => Promise<void>;
  navigate: NavigateFunction;
}
```

### 7.2 useInspectionPersistence

Maneja persistencia en localStorage:
- Guarda datos del formulario automáticamente
- Guarda metadatos de fase y firmas
- Recupera datos al volver a la página
- Detecta fase inicial completada

```typescript
interface InspectionPhaseMetadata {
  inspection_phase: 'initial' | 'final';
  initial_completion_date?: string;
  signatures_status: {
    operator: boolean;
    client: boolean;
    reception: boolean;
  };
  service_id: string;
}
```

### 7.3 useInspectionPDF

Genera PDF con progreso visual:
- Callback de progreso (0-100%)
- Mensajes de paso actual
- URL de descarga para fallback
- Descarga automática

---

## 8. Utilidades de Fotos

### 8.1 PhotoProcessor

```typescript
class PhotoProcessor {
  static generateFileName(prefix: string): string;
  static processImage(file: File, titlePrefix: string): Promise<{name: string; dataUrl: string}>;
  static validateImageFile(file: File): boolean;
}
```

**Características:**
- Redimensiona a max 800x600
- Comprime a JPEG 80%
- Genera nombre único con timestamp

### 8.2 PhotoStorage

```typescript
class PhotoStorage {
  static save(photo: PhotoData): void;        // localStorage.setItem(`photo-${name}`, dataUrl)
  static load(photoName: string): PhotoData | null;
  static remove(photoName: string): void;
  static loadMultiple(photoNames: string[]): PhotoData[];
}
```

---

## 9. Generación de PDF

### 9.1 Estructura del PDF

1. **Header Corporativo**
   - Logo de empresa
   - Título: "REPORTE DE INSPECCIÓN PRE-SERVICIO"
   - Datos empresa (nombre, RUT, dirección, teléfono, email)
   - Folio y fecha de generación

2. **Información del Servicio**
   - Tabla con: Folio, Cliente, Fecha, Origen, Destino
   - Datos vehículo: Marca, Modelo, Patente
   - Registro: Kilometraje, Combustible, Llaves, Documentación
   - Grúa y Operador asignados

3. **Inventario de Equipos**
   - Tabla de 3 columnas
   - Items con estado SÍ/NO (verde/rojo)
   - Resumen: X de Y elementos verificados
   - Porcentaje de completitud

4. **Set Fotográfico**
   - Fotos organizadas por categoría
   - 2 fotos por fila
   - Título de categoría
   - Timestamp en cada foto
   - Salto de página automático

5. **Firmas Digitales**
   - 3 firmas en fila
   - Operador, Cliente, Recepción
   - Nombre debajo de cada firma

6. **Observaciones**
   - Texto libre del operador
   - Footer con datos de empresa

### 9.2 Flujo de Generación

```typescript
const generatePDF = async (service, inspection, isFinal) => {
  // 1. Validar datos (10%)
  // 2. Cargar datos empresa (20%)
  // 3. Procesar fotos (40-60%)
  // 4. Generar documento (80%)
  // 5. Crear URL descarga (95%)
  // 6. Descarga automática (100%)
};
```

---

## 10. Flujo de Estados del Servicio

```text
pending → inspection_completed → completed
   │              │                   │
   │              │                   └── Fase final completada
   │              └── Fase inicial completada (PDF retiro)
   └── Servicio asignado al operador
```

---

## 11. Validaciones Pre-Submit

### Fase Inicial:
- Firma del operador (obligatoria)
- Al menos 1 elemento del inventario seleccionado
- Kilometraje completado
- Combustible completado
- Al menos 1 foto en el set fotográfico

### Fase Final:
- Firma de recepción (obligatoria)
- Nombre de quien recibe (obligatorio)

---

## 12. Estilos y Tema

Siguiendo el patrón del módulo de Costos:
- Fondo: `bg-background` / `bg-card`
- Texto: `text-foreground` / `text-muted-foreground`
- Bordes: `border-border`
- Acento primario: `violet-600` para botones principales
- Estados: Verde (`emerald-500`) para éxito, Rojo (`red-500`) para error
- Cards con `CardHeader` y `CardTitle` para secciones
- Iconos de Lucide React

---

## 13. Tabla de Base de Datos

### Tabla: services (campos relevantes)
```sql
id UUID PRIMARY KEY,
folio TEXT,
status TEXT CHECK (status IN ('pending', 'in_progress', 'inspection_completed', 'completed', 'cancelled')),
client_id UUID REFERENCES clients(id),
operator_id UUID REFERENCES operators(id),
crane_id UUID REFERENCES cranes(id),
origin TEXT,
destination TEXT,
vehicle_brand TEXT,
vehicle_model TEXT,
license_plate TEXT,
service_date DATE,
service_type_id UUID REFERENCES service_types(id)
```

### Tabla: company_data
```sql
id UUID PRIMARY KEY,
business_name TEXT,
rut TEXT,
address TEXT,
phone TEXT,
email TEXT,
logo_url TEXT
```

---

## 14. Criterios de Aceptación

- [ ] Formulario carga datos del servicio correctamente
- [ ] Checklist de 35 items funciona con toggle visual
- [ ] Botones Marcar/Desmarcar todo funcionan
- [ ] Captura de fotos desde cámara del dispositivo
- [ ] Preview de fotos con opción eliminar
- [ ] Firmas digitales táctiles funcionan en móvil
- [ ] Restauración de firmas desde estado guardado
- [ ] Persistencia automática en localStorage
- [ ] Validaciones muestran errores claros
- [ ] PDF se genera con progreso visual
- [ ] PDF incluye todas las secciones documentadas
- [ ] Fotos aparecen correctamente en PDF
- [ ] Firmas aparecen correctamente en PDF
- [ ] Descarga automática del PDF funciona
- [ ] Estado del servicio se actualiza correctamente
- [ ] Navegación de vuelta al dashboard funciona
- [ ] Responsive en dispositivos móviles

---

## 15. Dependencias NPM Requeridas

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-toggle-group": "^1.1.0",
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

## 16. Ejemplo de Uso

### Integración en Rutas

```typescript
// src/App.tsx
import ServiceInspection from '@/pages/operator/ServiceInspection';

<Route path="/operator/service/:id/inspection" element={<ServiceInspection />} />
```

### Navegación desde Dashboard

```typescript
// Desde lista de servicios del operador
navigate(`/operator/service/${serviceId}/inspection`);
```

---

## 17. Consideraciones de Rendimiento

- **Lazy loading** de componentes pesados (SignaturePad, PhotographicSet)
- **Compresión de imágenes** antes de almacenar en localStorage
- **Debounce** en auto-guardado de formulario
- **Memoización** de listas de equipamiento
- **Suspense boundaries** para carga de secciones

---

## 18. Manejo de Errores

```typescript
// Errores comunes manejados:
- Red no disponible → Persistencia local, sincronización posterior
- Cámara no accesible → Mensaje explicativo, opción de subir archivo
- localStorage lleno → Aviso de limpieza, continuar sin persistencia
- PDF fallido → Reintentar con datos guardados
- Servicio no encontrado → Mensaje con navegación a dashboard
```

---

*Documento generado como referencia técnica para replicar el módulo de Inspección Pre-Servicio.*
