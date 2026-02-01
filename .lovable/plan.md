

# Prompt Tecnico: Formulario de Inspeccion Pre-Servicio

## 1. Resumen del Modulo

Este documento especifica la implementacion completa del formulario de **Inspeccion Pre-Servicio** utilizado por operadores de grua para documentar el estado de los vehiculos antes del servicio. El modulo incluye formularios interactivos, captura fotografica, firmas digitales tactiles, generacion de PDF y persistencia offline.

---

## 2. Stack Tecnologico Requerido

| Tecnologia | Version | Proposito |
|------------|---------|-----------|
| React | ^18.3.x | Framework UI |
| TypeScript | ^5.x | Tipado estatico |
| React Hook Form | ^7.x | Gestion de formularios |
| Zod | ^3.x | Validacion de esquemas |
| TanStack Query | ^5.x | Server state y mutaciones |
| jsPDF + jspdf-autotable | ^3.x / ^5.x | Generacion de PDF |
| react-signature-canvas | ^1.x | Firma digital tactil |
| Tailwind CSS | ^3.x | Estilos |
| Radix UI | - | Componentes accesibles |
| Supabase | ^2.x | Backend y base de datos |

---

## 3. Estructura de Archivos

```text
src/
├── pages/operator/
│   └── ServiceInspection.tsx          # Pagina principal
├── components/operator/
│   ├── inspection/
│   │   ├── InspectionForm.tsx          # Formulario principal
│   │   ├── InspectionHeader.tsx        # Header con navegacion
│   │   ├── InspectionStatusCard.tsx    # Estado de firmas/fases
│   │   ├── InspectionLoadingState.tsx  # Estado de carga
│   │   └── InspectionErrorState.tsx    # Estado de error
│   ├── InspectionFormSections.tsx      # Secciones del formulario
│   ├── VehicleEquipmentChecklist.tsx   # Checklist de inventario
│   ├── PhotographicSet.tsx             # Set fotografico por categorias
│   ├── SignaturePad.tsx                # Componente de firma digital
│   ├── ServiceDetailsCard.tsx          # Card de detalles del servicio
│   └── PDFProgress.tsx                 # Indicador de progreso PDF
├── hooks/
│   ├── useServiceInspection.ts         # Hook principal del modulo
│   ├── useOperatorService.ts           # Fetch de servicio individual
│   ├── useInspectionPersistence.ts     # Persistencia localStorage
│   └── inspection/
│       ├── useInspectionPDF.ts         # Generacion de PDF
│       ├── useInitialInspectionPDF.ts  # PDF de fase inicial
│       ├── useInspectionEmail.ts       # Envio por email
│       └── useServiceStatusUpdate.ts   # Actualizacion de estado
├── schemas/
│   └── inspectionSchema.ts             # Esquema Zod de validacion
├── data/
│   └── equipmentData.ts                # Datos del inventario
├── utils/
│   ├── photoProcessor.ts               # Procesamiento de imagenes
│   ├── photoStorage.ts                 # Almacenamiento localStorage
│   ├── inspectionValidation.ts         # Validaciones pre-submit
│   ├── enhancedPdfGenerator.ts         # Generador PDF con progreso
│   ├── inspectionPdfGenerator.ts       # Generador PDF principal
│   └── pdf/
│       ├── pdfTypes.ts                 # Tipos para PDF
│       ├── pdfHeader.ts                # Header corporativo
│       ├── pdfSections.ts              # Re-exports
│       ├── pdfPhotos.ts                # Seccion fotografica
│       ├── pdfSignatures.ts            # Firmas digitales
│       ├── pdfValidation.ts            # Validacion datos PDF
│       ├── companyDataFetcher.ts       # Datos empresa desde BD
│       ├── sections/
│       │   ├── serviceInfo.ts          # Info del servicio
│       │   ├── equipmentChecklist.ts   # Tabla de inventario
│       │   └── observations.ts         # Observaciones
│       └── photos/
│           ├── photoProcessor.ts       # Compresion para PDF
│           └── photoStorage.ts         # Acceso a localStorage
└── types/
    └── photo.ts                        # Tipos de fotos
```

---

## 4. Esquema de Validacion (Zod)

```typescript
// src/schemas/inspectionSchema.ts
import { z } from 'zod';

export const inspectionFormSchema = z.object({
  // Inventario de equipamiento (requerido)
  equipment: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Debes verificar el estado del equipamiento.",
  }),
  
  // Registro del vehiculo
  kilometraje: z.string().min(1, 'El kilometraje es requerido'),
  combustible: z.string().min(1, 'El nivel de combustible es requerido'),
  llaves: z.string().min(1, 'El estado de las llaves es requerido'),
  documentacion: z.string().min(1, 'El estado de la documentacion es requerido'),
  
  // Observaciones
  vehicleObservations: z.string().optional(),
  
  // Firmas digitales
  operatorSignature: z.string().min(1, 'La firma del operador es requerida'),
  clientSignature: z.string().optional(),
  clientName: z.string().optional(),
  clientRut: z.string().optional(),
  vehicleReceptionSignature: z.string().optional(),
  receptionPersonName: z.string().optional(),
  
  // Set fotografico (requerido minimo 1 foto)
  photographicSet: z.array(z.object({
    fileName: z.string().min(1, 'El nombre del archivo es requerido'),
    category: z.enum(['izquierdo', 'derecho', 'frontal', 'trasero', 'interior', 'motor'])
  })).refine((value) => value.length > 0, {
    message: "Debes tomar al menos 1 fotografia para el set fotografico.",
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
    name: 'Inspeccion del Vehiculo',
    items: [
      { id: 'antena', name: 'Antena' },
      { id: 'baliza', name: 'Baliza' },
      { id: 'bateria', name: 'Bateria' },
      { id: 'botiquin', name: 'Botiquin' },
      { id: 'caja-invierno', name: 'Caja Invierno' },
      { id: 'cenicero', name: 'Cenicero' },
      { id: 'chaleco-reflectante', name: 'Chaleco Reflectante' },
      { id: 'cint-seguridad', name: 'Cint. Seguridad' },
      { id: 'consola', name: 'Consola' },
      { id: 'cunas', name: 'Cunas' },
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
      { id: 'pertiga', name: 'Pertiga' },
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
      { id: 'triangulos', name: 'Triangulos' }
    ]
  }
];
```

---

## 6. Componentes Principales

### 6.1 Pagina Principal (ServiceInspection.tsx)

Responsabilidades:
- Obtener ID del servicio desde URL params
- Cargar datos del servicio via `useServiceInspection`
- Renderizar estados de carga, error o formulario
- Mostrar progreso de generacion de PDF

Estados manejados:
- Loading: Spinner con mensaje "Cargando servicio..."
- Error: Mensaje con opcion de reintentar
- Sin ID: Mensaje de URL invalida
- OK: Renderiza formulario completo

### 6.2 Formulario Principal (InspectionForm.tsx)

Responsabilidades:
- Inicializar React Hook Form con esquema Zod
- Cargar datos persistidos desde localStorage
- Manejar fases (initial/final) del flujo de inspeccion
- Auto-guardar datos en cada cambio
- Validar antes de submit
- Llamar a la mutacion de procesamiento

Props:
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

Orden de secciones:
1. **Registro del Vehiculo** - Kilometraje, Combustible, Llaves, Documentacion
2. **Inventario del Vehiculo** - Checklist de 35 items
3. **Set Fotografico** - 6 categorias de fotos
4. **Observaciones y Firmas** - Textarea + 3 pads de firma

### 6.4 Checklist de Inventario (VehicleEquipmentChecklist.tsx)

Caracteristicas:
- Grid de 3 columnas (responsive)
- Toggle visual con iconos Check/X
- Botones "Marcar Todo" y "Desmarcar Todo"
- Items clickeables con feedback visual
- Estado verde (SI) o rojo (NO)

### 6.5 Set Fotografico (PhotographicSet.tsx)

Categorias:
- Izquierda, Derecha, Frontal, Trasera, Interior, Motor

Caracteristicas:
- Tabs para cada categoria
- Indicador visual de fotos tomadas
- Captura directa desde camara del dispositivo
- Preview de foto con opcion de eliminar
- Contador de fotos/categorias completadas
- Almacenamiento en localStorage

### 6.6 Firma Digital (SignaturePad.tsx)

Caracteristicas:
- Canvas tactil responsivo
- Soporte para dedo y stylus
- Prevencion de scroll durante firma
- Boton limpiar firma
- Restauracion de firma desde estado
- Exportacion a base64 PNG
- Indicador visual de firma capturada

---

## 7. Hooks Principales

### 7.1 useServiceInspection

Hook orquestador principal que combina:
- `useOperatorService` - Carga de datos del servicio
- `useInspectionPDF` - Generacion de PDF
- `useInspectionEmail` - Envio por email
- `useServiceStatusUpdate` - Actualizacion de estado

Retorna:
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
- Guarda datos del formulario automaticamente
- Guarda metadatos de fase y firmas
- Recupera datos al volver a la pagina
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
- Descarga automatica

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

Caracteristicas:
- Redimensiona a max 800x600
- Comprime a JPEG 80%
- Genera nombre unico con timestamp

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

## 9. Generacion de PDF

### 9.1 Estructura del PDF

1. **Header Corporativo**
   - Logo de empresa
   - Titulo: "REPORTE DE INSPECCION PRE-SERVICIO"
   - Datos empresa (nombre, RUT, direccion, telefono, email)
   - Folio y fecha de generacion

2. **Informacion del Servicio**
   - Tabla con: Folio, Cliente, Fecha, Origen, Destino
   - Datos vehiculo: Marca, Modelo, Patente
   - Registro: Kilometraje, Combustible, Llaves, Documentacion
   - Grua y Operador asignados

3. **Inventario de Equipos**
   - Tabla de 3 columnas
   - Items con estado SI/NO (verde/rojo)
   - Resumen: X de Y elementos verificados
   - Porcentaje de completitud

4. **Set Fotografico**
   - Fotos organizadas por categoria
   - 2 fotos por fila
   - Titulo de categoria
   - Timestamp en cada foto
   - Salto de pagina automatico

5. **Firmas Digitales**
   - 3 firmas en fila
   - Operador, Cliente, Recepcion
   - Nombre debajo de cada firma

6. **Observaciones**
   - Texto libre del operador
   - Footer con datos de empresa

### 9.2 Flujo de Generacion

```typescript
const generatePDF = async (service, inspection, isFinal) => {
  // 1. Validar datos (10%)
  // 2. Cargar datos empresa (20%)
  // 3. Procesar fotos (40-60%)
  // 4. Generar documento (80%)
  // 5. Crear URL descarga (95%)
  // 6. Descarga automatica (100%)
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
- Al menos 1 foto en el set fotografico

### Fase Final:
- Firma de recepcion (obligatoria)
- Nombre de quien recibe (obligatorio)

---

## 12. Estilos y Tema

Siguiendo el patron del modulo de Costos:
- Fondo: `bg-background` / `bg-card`
- Texto: `text-foreground` / `text-muted-foreground`
- Bordes: `border-border`
- Acento primario: `violet-600` para botones principales
- Estados: Verde (`emerald-500`) para exito, Rojo (`red-500`) para error
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

## 14. Criterios de Aceptacion

- [ ] Formulario carga datos del servicio correctamente
- [ ] Checklist de 35 items funciona con toggle visual
- [ ] Botones Marcar/Desmarcar todo funcionan
- [ ] Captura de fotos desde camara del dispositivo
- [ ] Preview de fotos con opcion eliminar
- [ ] Firmas digitales tactiles funcionan en movil
- [ ] Restauracion de firmas desde estado guardado
- [ ] Persistencia automatica en localStorage
- [ ] Validaciones muestran errores claros
- [ ] PDF se genera con progreso visual
- [ ] PDF incluye todas las secciones documentadas
- [ ] Fotos aparecen correctamente en PDF
- [ ] Firmas aparecen correctamente en PDF
- [ ] Descarga automatica del PDF funciona
- [ ] Estado del servicio se actualiza correctamente
- [ ] Navegacion de vuelta al dashboard funciona
- [ ] Responsive en dispositivos moviles

---

## 15. Dependencias NPM Requeridas

```json
{
  "dependencies": {
    "@hookform/resolvers": "^3.9.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "jspdf": "^3.0.1",
    "jspdf-autotable": "^5.0.2",
    "lucide-react": "^0.462.0",
    "react-hook-form": "^7.53.0",
    "react-signature-canvas": "^1.1.0-alpha.2",
    "zod": "^3.23.8"
  }
}
```

