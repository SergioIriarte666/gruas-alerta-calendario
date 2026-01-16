# Prompt: Subida por Lotes de Servicios y Carga de XML para Costos

> Documento técnico para replicar las funcionalidades de carga masiva de servicios (CSV/Excel) y carga de gastos desde XML en otro proyecto de Lovable.
> Versión 1.0 - Enero 2025

---

## 📋 Tabla de Contenidos

1. [Subida por Lotes de Servicios (CSV/Excel)](#1-subida-por-lotes-de-servicios-csvexcel)
2. [Carga de XML para Costos](#2-carga-de-xml-para-costos)
3. [Sistema de Animaciones](#3-sistema-de-animaciones)
4. [Interfaces TypeScript](#4-interfaces-typescript)
5. [Validaciones](#5-validaciones)
6. [Estructura de Archivos](#6-estructura-de-archivos)
7. [Dependencias](#7-dependencias)
8. [Patrones y Buenas Prácticas](#8-patrones-y-buenas-prácticas)

---

## 1. Subida por Lotes de Servicios (CSV/Excel)

### 1.1 Descripción General

Sistema inteligente de carga masiva de servicios con las siguientes características:
- Soporte para archivos CSV y Excel (.xlsx, .xls)
- Mapeo automático de headers (español → inglés)
- Validación en tiempo real de datos
- Mapeo de entidades por RUT/patente
- Verificación de folios duplicados
- Carga en lotes con progreso visual
- Animaciones de partículas y confetti
- Sincronización automática de folios post-carga

### 1.2 Componente Principal: `EnhancedCSVUploadServices.tsx`

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, Download, Eye, CheckCircle, XCircle, AlertTriangle,
  FileText, Loader2, BarChart3, AlertCircle, Sparkles
} from 'lucide-react';
import { useEnhancedCSVUpload } from '@/hooks/useEnhancedCSVUpload';
import { ValidationError } from '@/utils/enhancedCsvUpload';
import { BatchUploadAnimations } from './BatchUploadAnimations';
import { AnimatedProgress } from './AnimatedProgress';
import { AnimatedStatCard } from './AnimatedStatCard';
import { cn } from '@/lib/utils';

interface EnhancedCSVUploadServicesProps {
  onClose?: () => void;
  onSuccess?: (count: number) => void;
}

export const EnhancedCSVUploadServices = ({ onClose, onSuccess }: EnhancedCSVUploadServicesProps) => {
  const {
    file, csvData, validationResult, isInitialized, isValidating, isUploading,
    uploadProgress, uploadResult, setFile, parseFile, validateData,
    uploadServices, downloadTemplate, downloadExcelTemplate, reset, initializeUploader
  } = useEnhancedCSVUpload();

  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    initializeUploader();
  }, [initializeUploader]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    const allowedTypes = [
      'text/csv', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'application/vnd.ms-excel'
    ];
    
    if (selectedFile && allowedTypes.includes(selectedFile.type)) {
      setFile(selectedFile);
    } else {
      alert('Por favor seleccione un archivo CSV o Excel válido.');
    }
  }, [setFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files[0];
    const allowedTypes = [
      'text/csv', 
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
      'application/vnd.ms-excel'
    ];
    
    if (droppedFile && allowedTypes.includes(droppedFile.type)) {
      setFile(droppedFile);
    }
  }, [setFile]);

  const handlePreview = async () => {
    if (isValidating) return;
    
    try {
      const parsedData = await parseFile();
      if (parsedData && parsedData.length > 0) {
        await validateData(parsedData);
      }
    } catch (error) {
      alert(`Error al procesar el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const handleUpload = async () => {
    const result = await uploadServices();
    if (result?.success && onSuccess) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      onSuccess(result.processed);
    }
  };

  return (
    <div className="space-y-6">
      {/* Particle Animation System */}
      <BatchUploadAnimations
        isActive={isUploading}
        onComplete={showConfetti}
        sourceRef={uploadButtonRef}
        targetRef={progressBarRef}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Upload className="w-6 h-6 text-primary" />
            Carga Masiva Inteligente
          </h2>
          <p className="text-muted-foreground mt-1">
            Sistema avanzado de importación con validación automática
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Plantilla CSV
          </Button>
          <Button variant="outline" onClick={downloadExcelTemplate}>
            <Download className="w-4 h-4 mr-2" />
            Plantilla Excel
          </Button>
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-all",
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary"
            )}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="mb-4">Arrastra tu archivo CSV o Excel aquí</p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload">
              <Button asChild><span>Seleccionar Archivo</span></Button>
            </label>
          </div>

          {file && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg flex justify-between items-center">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePreview} disabled={isValidating}>
                  {isValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  Analizar & Validar
                </Button>
                <Button variant="outline" size="sm" onClick={reset}>Limpiar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Progress */}
      {uploadProgress && (
        <Card>
          <CardContent className="pt-6" ref={progressBarRef}>
            <AnimatedProgress value={uploadProgress.percentage} showPulse />
            <p className="text-sm mt-2">
              {uploadProgress.stage === 'uploading' 
                ? `Lote ${uploadProgress.currentBatch} de ${uploadProgress.totalBatches}`
                : 'Procesando...'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {validationResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validationResult.isValid 
                ? <CheckCircle className="w-5 h-5 text-green-500" />
                : <AlertCircle className="w-5 h-5 text-orange-500" />}
              Resultado del Análisis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <AnimatedStatCard label="Total de Filas" value={validationResult.totalRows} variant="total" />
              <AnimatedStatCard label="Válidas" value={validationResult.validCount} variant="valid" />
              <AnimatedStatCard label="Errores" value={validationResult.errorCount} variant="error" />
              <AnimatedStatCard label="Advertencias" value={validationResult.warningCount} variant="warning" />
            </div>

            {validationResult.validCount > 0 && (
              <Button 
                ref={uploadButtonRef}
                onClick={handleUpload}
                disabled={isUploading}
                className="mt-4 w-full"
              >
                {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Upload className="mr-2" />}
                Cargar {validationResult.validCount} Servicios
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
```

### 1.3 Clase Principal: `EnhancedCSVUploader`

```typescript
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DataMapper, MappedServiceData } from './dataMapper';

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: any;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validRows: MappedServiceData[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
}

export interface UploadProgress {
  total: number;
  processed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  stage: 'parsing' | 'validating' | 'mapping' | 'uploading';
}

export interface UploadResult {
  success: boolean;
  processed: number;
  errors: number;
  message: string;
  failedRows?: number[];
  errorDetails?: ValidationError[];
  insertedFolios?: string[];
}

export class EnhancedCSVUploader {
  private dataMapper: DataMapper;
  private batchSize = 25;

  constructor() {
    this.dataMapper = new DataMapper();
  }

  async initialize() {
    await this.dataMapper.initialize();
  }

  async parseFile(file: File, onProgress?: (progress: UploadProgress) => void): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (onProgress) {
        onProgress({ total: 100, processed: 0, percentage: 0, currentBatch: 1, totalBatches: 1, stage: 'parsing' });
      }

      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

      if (isExcel) {
        this.parseExcelFile(file, resolve, reject, onProgress);
      } else {
        this.parseCSVFile(file, resolve, reject, onProgress);
      }
    });
  }

  private parseCSVFile(file: File, resolve: Function, reject: Function, onProgress?: Function) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`Error parsing CSV: ${results.errors[0].message}`));
        } else {
          resolve(results.data as any[]);
        }
      },
      error: (error) => reject(new Error(`Error reading CSV: ${error.message}`))
    });
  }

  private parseExcelFile(file: File, resolve: Function, reject: Function, onProgress?: Function) {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
          header: 1, defval: '', raw: false, dateNF: 'yyyy-mm-dd'
        });
        
        if (jsonData.length < 2) {
          resolve([]);
          return;
        }

        const headers = jsonData[0] as string[];
        const rows = jsonData.slice(1) as any[][];

        const processedData = rows
          .filter(row => row.some(cell => cell !== ''))
          .map((row) => {
            const rowObject: any = {};
            headers.forEach((header, index) => {
              let value = row[index];
              // Handle date conversion
              if (typeof value === 'string' && value.includes('/')) {
                const date = new Date(value);
                if (!isNaN(date.getTime())) {
                  value = date.toISOString().split('T')[0];
                }
              }
              rowObject[header.trim()] = value || '';
            });
            return rowObject;
          });

        resolve(processedData);
      } catch (error) {
        reject(new Error(`Error processing Excel: ${error instanceof Error ? error.message : 'Unknown'}`));
      }
    };
    
    reader.readAsArrayBuffer(file);
  }

  async validateAndMapData(
    csvData: any[],
    existingFolios: string[] = [],
    onProgress?: (progress: UploadProgress) => void
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const validRows: MappedServiceData[] = [];
    let warningCount = 0;

    // Validate headers
    if (csvData.length > 0) {
      const headers = Object.keys(csvData[0]);
      const headerValidation = this.dataMapper.validateHeaders(headers);
      
      if (!headerValidation.valid) {
        headerValidation.missing.forEach(missing => {
          errors.push({
            row: -1, field: 'headers',
            message: `Columna requerida faltante: ${missing}`,
            value: missing, severity: 'error'
          });
        });
      }
    }

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      if (onProgress) {
        onProgress({
          total: csvData.length, processed: i + 1,
          percentage: Math.round(((i + 1) / csvData.length) * 100),
          currentBatch: 1, totalBatches: 1, stage: 'mapping'
        });
      }

      // Map headers
      const mappedRow: any = {};
      const mappedHeaders = this.dataMapper.mapHeaders(Object.keys(row));
      Object.keys(row).forEach((key, index) => {
        mappedRow[mappedHeaders[index]] = row[key];
      });

      // Check duplicate folios
      if (mappedRow.folio && existingFolios.includes(mappedRow.folio.toString())) {
        errors.push({
          row: i, field: 'folio',
          message: `Folio duplicado: ${mappedRow.folio}`,
          value: mappedRow.folio, severity: 'error'
        });
      }

      // Map data to IDs
      const mappingResult = await this.dataMapper.mapRowData(mappedRow);
      
      if (!mappingResult.success) {
        mappingResult.errors.forEach(error => {
          errors.push({ row: i, field: 'mapping', message: error, value: mappedRow, severity: 'error' });
        });
      } else {
        validRows.push(mappingResult.data!);
      }

      if (mappingResult.warnings) {
        mappingResult.warnings.forEach(warning => {
          errors.push({ row: i, field: 'warning', message: warning, value: mappedRow, severity: 'warning' });
          warningCount++;
        });
      }
    }

    const errorCount = errors.filter(e => e.severity === 'error').length;
    
    return {
      isValid: errorCount === 0,
      errors, validRows,
      totalRows: csvData.length,
      validCount: validRows.length,
      errorCount, warningCount
    };
  }

  async uploadServices(
    services: MappedServiceData[],
    createService: (service: any) => Promise<any>,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    const total = services.length;
    const totalBatches = Math.ceil(total / this.batchSize);
    let processed = 0;
    let errors = 0;
    const insertedFolios: string[] = [];

    for (let i = 0; i < totalBatches; i++) {
      const batch = services.slice(i * this.batchSize, (i + 1) * this.batchSize);

      for (const service of batch) {
        try {
          const serviceData = {
            folio: service.folio,
            requestDate: service.requestDate,
            serviceDate: service.serviceDate,
            client: service.clientId,
            vehicleBrand: service.vehicleBrand,
            vehicleModel: service.vehicleModel,
            licensePlate: service.licensePlate,
            origin: service.origin,
            destination: service.destination,
            serviceType: service.serviceTypeId,
            value: service.value,
            crane: service.craneId,
            operators: [{ operatorId: service.operatorId, commission: service.operatorCommission }],
            status: 'pending' as const,
            observations: service.observations || ''
          };

          await createService(serviceData);
          processed++;
          insertedFolios.push(service.folio);
        } catch (error) {
          errors++;
        }
      }

      if (onProgress) {
        onProgress({
          total, processed, percentage: Math.round((processed / total) * 100),
          currentBatch: i + 1, totalBatches, stage: 'uploading'
        });
      }

      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      success: errors === 0,
      processed, errors,
      message: errors === 0 ? 'Todos los servicios cargados' : `${processed} cargados, ${errors} fallidos`,
      insertedFolios
    };
  }
}
```

### 1.4 Mapeo de Headers: `HeaderMapper`

```typescript
export class HeaderMapper {
  private headerMap: { [key: string]: string } = {
    // Headers principales (español → inglés)
    'Folio': 'folio',
    'Fecha Solicitud': 'requestDate',
    'Fecha Servicio': 'serviceDate',
    'Cliente RUT': 'clientRut',
    'Cliente Nombre': 'clientName',
    'Cliente Departamento': 'clientDepartment',
    'Vehículo Marca': 'vehicleBrand',
    'Vehículo Modelo': 'vehicleModel',
    'Patente': 'licensePlate',
    'Origen': 'origin',
    'Destino': 'destination',
    'Tipo Servicio': 'serviceType',
    'Valor': 'value',
    'Grúa Patente': 'craneLicensePlate',
    'Operador RUT': 'operatorRut',
    'Comisión Operador': 'operatorCommission',
    'Observaciones': 'observations',
    
    // Variaciones adicionales (mayúsculas, minúsculas, etc.)
    'FOLIO': 'folio',
    'folio': 'folio',
    'FECHA SOLICITUD': 'requestDate',
    'RUT Cliente': 'clientRut',
    'Nombre Cliente': 'clientName',
    'Departamento': 'clientDepartment',
    'Marca Vehículo': 'vehicleBrand',
    'Modelo Vehículo': 'vehicleModel',
    'Placa': 'licensePlate',
    'Origin': 'origin',
    'Destination': 'destination',
    'Servicio': 'serviceType',
    'Precio': 'value',
    'Patente Grúa': 'craneLicensePlate',
    'RUT Operador': 'operatorRut',
    'Notes': 'observations',
    'Notas': 'observations',
    'Comentarios': 'observations'
  };

  mapHeaders(headers: string[]): string[] {
    return headers.map(header => {
      const trimmed = header.trim();
      const mapped = this.headerMap[trimmed];
      
      if (mapped) return mapped;
      
      // Fallback: convert to camelCase
      return trimmed.toLowerCase().replace(/\s+/g, '');
    });
  }

  validateHeaders(headers: string[]): { valid: boolean; missing: string[]; extra: string[] } {
    const required = [
      'folio', 'requestDate', 'serviceDate', 'clientRut', 'clientName', 'clientDepartment',
      'vehicleBrand', 'vehicleModel', 'licensePlate', 'origin', 'destination',
      'serviceType', 'value', 'craneLicensePlate', 'operatorRut', 'operatorCommission'
    ];

    const mappedHeaders = this.mapHeaders(headers);
    const missing = required.filter(req => !mappedHeaders.includes(req));
    const extra = mappedHeaders.filter(h => !required.includes(h) && h !== 'observations');

    return { valid: missing.length === 0, missing, extra };
  }
}
```

### 1.5 Generación de Plantillas

```typescript
import * as XLSX from 'xlsx';

export class TemplateGenerator {
  static downloadTemplate(): void {
    const headers = [
      'Folio', 'Fecha Solicitud', 'Fecha Servicio', 'Cliente RUT', 'Cliente Nombre',
      'Cliente Departamento', 'Vehículo Marca', 'Vehículo Modelo', 'Patente',
      'Origen', 'Destino', 'Tipo Servicio', 'Valor', 'Grúa Patente',
      'Operador RUT', 'Comisión Operador', 'Observaciones'
    ];

    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plantilla_servicios_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  static downloadExcelTemplate(): void {
    const headers = [
      'Folio', 'Fecha Solicitud', 'Fecha Servicio', 'Cliente RUT', 'Cliente Nombre',
      'Cliente Departamento', 'Vehículo Marca', 'Vehículo Modelo', 'Patente',
      'Origen', 'Destino', 'Tipo Servicio', 'Valor', 'Grúa Patente',
      'Operador RUT', 'Comisión Operador', 'Observaciones'
    ];

    const sampleData = [
      ['SRV-001', '2024-01-15', '2024-01-16', '76123456-7', 'Transportes Santiago Ltda.', 
       'Administración', 'Mercedes-Benz', 'Actros', 'ABCD-12', 'Santiago Centro', 
       'Las Condes', 'Grúa Pesada', '150000', 'GR-001', '12345678-9', '15000', 'Ejemplo'],
      ['SRV-002', '2024-01-17', '2024-01-18', '96987654-3', 'Empresa Logística Norte S.A.', 
       'Operaciones', 'Volvo', 'FH', 'MNOP-34', 'Valparaíso', 'Santiago', 
       'Grúa Mediana', '85000', 'GR-002', '98765432-1', '8500', 'Cuidado especial']
    ];

    const wb = XLSX.utils.book_new();
    const wsData = [headers, ...sampleData];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 30 },
      { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 20 },
      { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 15 }, { wch: 35 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
    XLSX.writeFile(wb, `plantilla_servicios_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }
}
```

---

## 2. Carga de XML para Costos

### 2.1 Descripción General

Sistema de carga de gastos desde archivos XML con las siguientes características:
- Detección automática de estructura XML (DTE chileno, genérico, facturas)
- Mapeo inteligente de campos
- Categorización automática por proveedor
- Vista previa con mapeo editable de categorías
- Integración con `BatchProgressModal`

### 2.2 Componente Principal: `XMLCostUpload.tsx`

```typescript
import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { 
  Upload, FileText, CheckCircle, AlertTriangle, AlertCircle, 
  Loader2, Code, Database, Calendar, DollarSign
} from 'lucide-react';
import { XMLCostParser } from '@/utils/xmlParser/xmlCostParser';
import { XMLCostData, XMLParseResult } from '@/types/costs';
import { useAddCost } from '@/hooks/useCosts';
import { useCostCategories } from '@/hooks/useCostCategories';
import { toast } from 'sonner';

interface XMLCostUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (count: number) => void;
}

export const XMLCostUpload = ({ isOpen, onClose, onSuccess }: XMLCostUploadProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<XMLParseResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [categoryMappings, setCategoryMappings] = useState<{ [key: string]: string }>({});
  const batchProgress = useBatchProgress();
  
  const { mutate: addCost } = useAddCost();
  const { data: categories = [] } = useCostCategories();
  const parser = new XMLCostParser();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/xml') {
      setFile(selectedFile);
      setParseResult(null);
    } else {
      toast.error('Por favor seleccione un archivo XML válido');
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/xml') {
      setFile(droppedFile);
      setParseResult(null);
    } else {
      toast.error('Por favor seleccione un archivo XML válido');
    }
  }, []);

  const handleAnalyzeFile = async () => {
    if (!file) return;
    
    try {
      const result = await parser.parseXMLFile(file);
      setParseResult(result);
      
      if (result.success) {
        toast.success(`XML analizado: ${result.validRows} gastos encontrados`);
      } else {
        toast.error(`Error: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      toast.error('Error procesando el archivo XML');
    }
  };

  const getDefaultCategoryId = (categoria?: string): string => {
    if (!categoria) return categories[0]?.id || '';
    
    const normalized = categoria.toLowerCase();
    
    if (normalized.includes('combustible') || normalized.includes('gasolina')) {
      return categories.find(c => c.name.toLowerCase().includes('combustible'))?.id || categories[0]?.id || '';
    }
    if (normalized.includes('mantenimiento') || normalized.includes('reparacion')) {
      return categories.find(c => c.name.toLowerCase().includes('mantenimiento'))?.id || categories[0]?.id || '';
    }
    
    return categories[0]?.id || '';
  };

  const handleUploadCosts = async () => {
    if (!parseResult || !parseResult.success) return;
    
    setIsUploading(true);
    batchProgress.start('Cargando Gastos desde XML', parseResult.data.length);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < parseResult.data.length; i++) {
      const xmlCost = parseResult.data[i];
      batchProgress.update(i + 1, xmlCost.descripcion.substring(0, 40));
      
      const categoryId = categoryMappings[`${i}-categoria`] || getDefaultCategoryId(xmlCost.categoria);
      
      const costData = {
        date: typeof xmlCost.fecha === 'string' ? xmlCost.fecha : xmlCost.fecha.toISOString().split('T')[0],
        description: xmlCost.descripcion,
        amount: xmlCost.monto,
        category_id: categoryId,
        notes: [
          xmlCost.proveedor ? `Proveedor: ${xmlCost.proveedor}` : '',
          xmlCost.numeroFactura ? `Factura: ${xmlCost.numeroFactura}` : '',
          xmlCost.rut ? `RUT: ${xmlCost.rut}` : ''
        ].filter(Boolean).join(' | ') || null
      };

      await new Promise<void>((resolve) => {
        addCost(costData, {
          onSuccess: () => { successCount++; resolve(); },
          onError: () => { errorCount++; resolve(); }
        });
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (errorCount === 0) {
      batchProgress.complete();
      setTimeout(() => {
        onSuccess?.(successCount);
        onClose();
        batchProgress.close();
      }, 1500);
    } else {
      batchProgress.error(`${errorCount} con error`);
    }
    
    setIsUploading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-primary" />
            Cargar Gastos desde XML
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Upload Area */}
          <Card>
            <CardContent className="pt-6">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => document.getElementById('xml-upload')?.click()}
              >
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="mb-4">Arrastra tu archivo XML aquí</p>
                <input type="file" accept=".xml" onChange={handleFileSelect} className="hidden" id="xml-upload" />
                <Button variant="outline">Seleccionar XML</Button>
              </div>

              {file && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <Button onClick={handleAnalyzeFile}>
                    <Code className="w-4 h-4 mr-2" />
                    Analizar XML
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results */}
          {parseResult && parseResult.success && (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Descripción</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Categoría</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parseResult.data.slice(0, 10).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          {typeof item.fecha === 'string' 
                            ? new Date(item.fecha).toLocaleDateString('es-CL')
                            : item.fecha.toLocaleDateString('es-CL')}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{item.descripcion}</TableCell>
                        <TableCell>${item.monto.toLocaleString('es-CL')}</TableCell>
                        <TableCell>{item.proveedor || '-'}</TableCell>
                        <TableCell>
                          <Select
                            value={categoryMappings[`${index}-categoria`] || getDefaultCategoryId(item.categoria)}
                            onValueChange={(value) => setCategoryMappings(prev => ({...prev, [`${index}-categoria`]: value}))}
                          >
                            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {categories.map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button onClick={handleUploadCosts} disabled={isUploading}>
                    {isUploading ? <Loader2 className="animate-spin mr-2" /> : <Database className="mr-2" />}
                    Cargar {parseResult.validRows} Gastos
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <BatchProgressModal {...batchProgress} />
      </DialogContent>
    </Dialog>
  );
};
```

### 2.3 Parser XML: `XMLCostParser`

```typescript
import { XMLCostData, XMLParseResult, XMLStructure } from '@/types/costs';

export class XMLCostParser {
  private parser: DOMParser;

  constructor() {
    this.parser = new DOMParser();
  }

  public async parseXMLFile(file: File): Promise<XMLParseResult> {
    try {
      const text = await this.readFileAsText(file);
      return this.parseXMLString(text);
    } catch (error) {
      return {
        success: false, data: [], errors: [`Error leyendo archivo: ${error}`],
        warnings: [], totalRows: 0, validRows: 0
      };
    }
  }

  public parseXMLString(xmlString: string): XMLParseResult {
    try {
      const doc = this.parser.parseFromString(xmlString, 'text/xml');
      
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        return { success: false, data: [], errors: ['XML no válido'], warnings: [], totalRows: 0, validRows: 0 };
      }

      const structure = this.detectXMLStructure(doc);
      const data = this.extractDataFromXML(doc, structure);
      const validation = this.validateData(data);

      return {
        success: validation.errors.length === 0,
        data, errors: validation.errors, warnings: validation.warnings,
        totalRows: data.length, validRows: data.filter(item => this.isValidItem(item)).length
      };
    } catch (error) {
      return { success: false, data: [], errors: [`Error: ${error}`], warnings: [], totalRows: 0, validRows: 0 };
    }
  }

  private detectXMLStructure(doc: Document): XMLStructure {
    // DTE chileno (Factura Electrónica SII)
    if (doc.querySelector('DTE')) {
      return {
        rootElement: 'DTE',
        itemElement: 'Documento',
        fields: [
          { xmlField: 'Encabezado/IdDoc/FchEmis', targetField: 'fecha', required: true },
          { xmlField: 'Encabezado/Totales/MntTotal', targetField: 'monto', required: true, transform: (v) => parseFloat(v) },
          { xmlField: 'Encabezado/Emisor/RznSoc', targetField: 'proveedor', required: true },
          { xmlField: 'Encabezado/Emisor/RUTEmisor', targetField: 'rut', required: false },
          { xmlField: 'Encabezado/IdDoc/Folio', targetField: 'numeroFactura', required: false },
          { xmlField: 'Encabezado/Emisor/GiroEmis', targetField: 'descripcion', required: false }
        ],
        detectedFields: []
      };
    }

    // Gastos genéricos
    if (doc.querySelector('gastos') || doc.querySelector('expenses')) {
      return {
        rootElement: 'gastos',
        itemElement: 'gasto',
        fields: [
          { xmlField: 'fecha', targetField: 'fecha', required: true },
          { xmlField: 'monto', targetField: 'monto', required: true, transform: (v) => parseFloat(v) },
          { xmlField: 'descripcion', targetField: 'descripcion', required: true },
          { xmlField: 'proveedor', targetField: 'proveedor', required: false },
          { xmlField: 'categoria', targetField: 'categoria', required: false }
        ],
        detectedFields: []
      };
    }

    // Facturas genéricas
    if (doc.querySelector('facturas') || doc.querySelector('invoices')) {
      return {
        rootElement: 'facturas',
        itemElement: 'factura',
        fields: [
          { xmlField: 'fecha', targetField: 'fecha', required: true },
          { xmlField: 'total', targetField: 'monto', required: true, transform: (v) => parseFloat(v) },
          { xmlField: 'descripcion', targetField: 'descripcion', required: true },
          { xmlField: 'proveedor', targetField: 'proveedor', required: false },
          { xmlField: 'numero', targetField: 'numeroFactura', required: false }
        ],
        detectedFields: []
      };
    }

    // Detección automática
    return this.detectAutomaticStructure(doc);
  }

  private extractDataFromXML(doc: Document, structure: XMLStructure): XMLCostData[] {
    const items = doc.querySelectorAll(structure.itemElement);
    const data: XMLCostData[] = [];

    items.forEach((item) => {
      const costData: any = {};
      
      structure.fields.forEach(fieldMapping => {
        let element: Element | null = null;
        
        if (structure.rootElement === 'DTE') {
          element = this.getNestedElement(item, fieldMapping.xmlField);
        } else {
          element = item.querySelector(fieldMapping.xmlField);
        }
        
        if (element) {
          let value = element.textContent?.trim() || '';
          if (fieldMapping.transform) {
            value = fieldMapping.transform(value);
          }
          costData[fieldMapping.targetField] = value;
        }
      });
      
      // Categorización automática para DTEs
      if (structure.rootElement === 'DTE' && costData.proveedor) {
        costData.categoria = this.categorizarPorProveedor(costData.proveedor);
        if (!costData.descripcion) {
          costData.descripcion = `Factura de ${costData.proveedor}`;
        }
      }
      
      if (costData.fecha && costData.monto && (costData.descripcion || costData.proveedor)) {
        data.push(costData as XMLCostData);
      }
    });

    return data;
  }

  private getNestedElement(parent: Element, path: string): Element | null {
    const parts = path.split('/');
    let current = parent;
    
    for (const part of parts) {
      const child = current.querySelector(part);
      if (!child) return null;
      current = child;
    }
    
    return current;
  }

  private categorizarPorProveedor(proveedor: string): string {
    const lower = proveedor.toLowerCase();
    
    if (lower.includes('seguro') || lower.includes('hdi')) return 'Seguros';
    if (lower.includes('combustible') || lower.includes('petro') || lower.includes('shell') || lower.includes('copec')) return 'Combustible';
    if (lower.includes('mantenimiento') || lower.includes('taller') || lower.includes('repuesto')) return 'Mantenimiento';
    if (lower.includes('peaje') || lower.includes('toll')) return 'Peajes';
    
    return 'Otros';
  }

  private validateData(data: XMLCostData[]): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    data.forEach((item, index) => {
      if (!item.fecha) errors.push(`Fila ${index + 1}: Fecha requerida`);
      if (!item.monto || item.monto <= 0) errors.push(`Fila ${index + 1}: Monto debe ser mayor a 0`);
      if (!item.descripcion) errors.push(`Fila ${index + 1}: Descripción requerida`);
      if (!item.proveedor) warnings.push(`Fila ${index + 1}: Proveedor no especificado`);
      if (!item.categoria) warnings.push(`Fila ${index + 1}: Categoría se asignará por defecto`);
    });

    return { errors, warnings };
  }

  private isValidItem(item: XMLCostData): boolean {
    return !!(item.fecha && item.monto && item.monto > 0 && item.descripcion?.trim());
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Error leyendo archivo'));
      reader.readAsText(file, 'utf-8');
    });
  }
}
```

### 2.4 Estructuras XML Soportadas

#### DTE Chileno (Factura Electrónica SII)
```xml
<DTE>
  <Documento>
    <Encabezado>
      <IdDoc>
        <TipoDTE>33</TipoDTE>
        <Folio>12345</Folio>
        <FchEmis>2024-01-15</FchEmis>
      </IdDoc>
      <Emisor>
        <RUTEmisor>76123456-7</RUTEmisor>
        <RznSoc>Proveedor SA</RznSoc>
        <GiroEmis>Servicios de mantenimiento</GiroEmis>
      </Emisor>
      <Totales>
        <MntTotal>150000</MntTotal>
      </Totales>
    </Encabezado>
  </Documento>
</DTE>
```

#### Gastos Genéricos
```xml
<gastos>
  <gasto>
    <fecha>2024-01-15</fecha>
    <monto>50000</monto>
    <descripcion>Combustible</descripcion>
    <proveedor>Shell</proveedor>
    <categoria>Combustible</categoria>
  </gasto>
</gastos>
```

#### Facturas Genéricas
```xml
<facturas>
  <factura>
    <fecha>2024-01-15</fecha>
    <total>85000</total>
    <descripcion>Servicio de mantenimiento</descripcion>
    <proveedor>Taller Mecánico</proveedor>
    <numero>F-001</numero>
  </factura>
</facturas>
```

---

## 3. Sistema de Animaciones

### 3.1 AnimatedProgress

```typescript
import React, { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface AnimatedProgressProps {
  value: number;
  className?: string;
  showPulse?: boolean;
}

export const AnimatedProgress: React.FC<AnimatedProgressProps> = ({
  value, className, showPulse = true
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAtMilestone, setIsAtMilestone] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplayValue(prev => prev < value ? Math.min(prev + 1, value) : prev);
    }, 20);
    return () => clearInterval(interval);
  }, [value]);

  useEffect(() => {
    const milestones = [25, 50, 75, 100];
    if (milestones.includes(Math.floor(displayValue))) {
      setIsAtMilestone(true);
      const timeout = setTimeout(() => setIsAtMilestone(false), 600);
      return () => clearTimeout(timeout);
    }
  }, [displayValue]);

  const getColorClass = () => {
    if (displayValue < 25) return 'bg-blue-500';
    if (displayValue < 50) return 'bg-cyan-500';
    if (displayValue < 75) return 'bg-tms-green';
    if (displayValue < 100) return 'bg-green-500';
    return 'bg-primary';
  };

  const getGlowClass = () => {
    if (displayValue < 25) return 'shadow-[0_0_20px_rgba(59,130,246,0.5)]';
    if (displayValue < 50) return 'shadow-[0_0_20px_rgba(6,182,212,0.5)]';
    if (displayValue < 75) return 'shadow-[0_0_20px_rgba(156,250,36,0.5)]';
    return 'shadow-[0_0_20px_rgba(34,197,94,0.5)]';
  };

  return (
    <div className="relative">
      <Progress value={displayValue} className={cn("h-3", className)} />
      <div 
        className={cn(
          "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
          getColorClass(),
          showPulse && "animate-progress-flow",
          isAtMilestone && "animate-scale-pulse",
          isAtMilestone && getGlowClass()
        )}
        style={{ 
          width: `${displayValue}%`,
          background: displayValue >= 25 
            ? 'linear-gradient(90deg, hsl(84, 100%, 58%), hsl(84, 100%, 65%), hsl(84, 100%, 58%))'
            : undefined,
          backgroundSize: '200% 100%'
        }}
      >
        {showPulse && (
          <div 
            className="absolute inset-0 animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              backgroundSize: '200% 100%'
            }}
          />
        )}
      </div>
    </div>
  );
};
```

### 3.2 AnimatedStatCard

```typescript
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedStatCardProps {
  label: string;
  value: number;
  variant: 'total' | 'valid' | 'error' | 'warning';
  isAnimating?: boolean;
}

export const AnimatedStatCard: React.FC<AnimatedStatCardProps> = ({
  label, value, variant, isAnimating = false
}) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 1000;
    const increment = value / (duration / 16);

    const animate = () => {
      start += increment;
      if (start < value) {
        setDisplayValue(Math.floor(start));
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    };

    animate();
  }, [value]);

  const variantStyles = {
    total: { bg: 'bg-blue-500/20', text: 'text-blue-600', glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]' },
    valid: { bg: 'bg-green-500/20', text: 'text-green-600', glow: 'shadow-[0_0_20px_rgba(34,197,94,0.3)]' },
    error: { bg: 'bg-red-500/20', text: 'text-red-600', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]' },
    warning: { bg: 'bg-yellow-500/20', text: 'text-yellow-600', glow: 'shadow-[0_0_20px_rgba(234,179,8,0.3)]' }
  };

  const style = variantStyles[variant];

  return (
    <div className={cn(
      "p-4 rounded-lg transition-all duration-500 border border-border/50",
      style.bg,
      isAnimating && "animate-scale-pulse",
      isAnimating && style.glow
    )}>
      <p className={cn("text-sm font-medium mb-1", style.text)}>{label}</p>
      <p className={cn("text-2xl font-bold", isAnimating && "animate-bounce-in")}>
        {displayValue}
      </p>
    </div>
  );
};
```

### 3.3 BatchUploadAnimations (Partículas y Confetti)

```typescript
import React, { useCallback, useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; life: number;
  targetX: number; targetY: number;
}

interface ConfettiParticle {
  x: number; y: number; vx: number; vy: number;
  color: string; size: number; rotation: number;
  rotationSpeed: number; life: number;
}

interface BatchUploadAnimationsProps {
  isActive: boolean;
  onComplete: boolean;
  sourceRef: React.RefObject<HTMLElement>;
  targetRef: React.RefObject<HTMLElement>;
}

export const BatchUploadAnimations: React.FC<BatchUploadAnimationsProps> = ({
  isActive, onComplete, sourceRef, targetRef
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const confettiRef = useRef<ConfettiParticle[]>([]);
  const animationFrameRef = useRef<number>();

  const createParticle = useCallback(() => {
    if (!sourceRef.current || !targetRef.current) return;
    
    const sourceRect = sourceRef.current.getBoundingClientRect();
    const targetRect = targetRef.current.getBoundingClientRect();
    
    const colors = ['#9CFA24', '#22C55E', '#3B82F6', '#FBBF24', '#EF4444'];
    
    particlesRef.current.push({
      x: sourceRect.left + sourceRect.width / 2,
      y: sourceRect.top + sourceRect.height / 2,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 6 + 2,
      life: 1,
      targetX: targetRect.left + Math.random() * targetRect.width,
      targetY: targetRect.top + targetRect.height / 2
    });
  }, [sourceRef, targetRef]);

  const createConfetti = useCallback(() => {
    const colors = ['#9CFA24', '#22C55E', '#3B82F6', '#FBBF24', '#EF4444', '#A855F7'];
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    for (let i = 0; i < 100; i++) {
      confettiRef.current.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 20 - 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 10 + 5,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        life: 1
      });
    }
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(p => {
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      p.x += dx * 0.05 + p.vx;
      p.y += dy * 0.05 + p.vy;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= 0.01;

      if (p.life > 0) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      }
      return false;
    });

    // Update and draw confetti
    confettiRef.current = confettiRef.current.filter(c => {
      c.x += c.vx;
      c.y += c.vy;
      c.vy += 0.3; // gravity
      c.rotation += c.rotationSpeed;
      c.life -= 0.01;

      if (c.life > 0) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rotation);
        ctx.fillStyle = c.color;
        ctx.globalAlpha = c.life;
        ctx.fillRect(-c.size / 2, -c.size / 2, c.size, c.size / 2);
        ctx.restore();
        ctx.globalAlpha = 1;
        return true;
      }
      return false;
    });

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    animate();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [animate]);

  useEffect(() => {
    if (isActive && sourceRef.current && targetRef.current) {
      const interval = setInterval(createParticle, 50);
      return () => clearInterval(interval);
    }
  }, [isActive, createParticle, sourceRef, targetRef]);

  useEffect(() => {
    if (onComplete) createConfetti();
  }, [onComplete, createConfetti]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
};
```

---

## 4. Interfaces TypeScript

```typescript
// ========== CSV/Excel Upload ==========

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  value: any;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  validRows: MappedServiceData[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
}

export interface UploadProgress {
  total: number;
  processed: number;
  percentage: number;
  currentBatch: number;
  totalBatches: number;
  stage: 'parsing' | 'validating' | 'mapping' | 'uploading';
}

export interface UploadResult {
  success: boolean;
  processed: number;
  errors: number;
  message: string;
  failedRows?: number[];
  errorDetails?: ValidationError[];
  insertedFolios?: string[];
}

export interface MappedServiceData {
  folio: string;
  requestDate: string;
  serviceDate: string;
  clientId: string;
  vehicleBrand: string;
  vehicleModel: string;
  licensePlate: string;
  origin: string;
  destination: string;
  serviceTypeId: string;
  value: number;
  craneId: string;
  operatorId: string;
  operatorCommission: number;
  observations?: string;
}

export interface MappingResult {
  success: boolean;
  data?: MappedServiceData;
  errors: string[];
  warnings?: string[];
}

// ========== XML Upload ==========

export interface XMLCostData {
  fecha: string | Date;
  descripcion: string;
  monto: number;
  proveedor?: string;
  categoria?: string;
  subcategoria?: string;
  numeroFactura?: string;
  rut?: string;
  telefono?: string;
  cantidad?: number;
  precioUnitario?: number;
  notas?: string;
}

export interface XMLParseResult {
  success: boolean;
  data: XMLCostData[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
}

export interface XMLValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface XMLFieldMapping {
  xmlField: string;
  targetField: keyof XMLCostData;
  required: boolean;
  transform?: (value: any) => any;
}

export interface XMLStructure {
  rootElement: string;
  itemElement: string;
  fields: XMLFieldMapping[];
  detectedFields: string[];
}
```

---

## 5. Validaciones

### 5.1 Validaciones para Servicios (CSV/Excel)

| Campo | Validación | Ejemplo Válido |
|-------|------------|----------------|
| `folio` | Requerido, único en archivo y BD | `SRV-001` |
| `requestDate` | Fecha formato YYYY-MM-DD | `2024-01-15` |
| `serviceDate` | Fecha formato YYYY-MM-DD | `2024-01-16` |
| `clientRut` | RUT chileno formato X.XXX.XXX-X | `76.123.456-7` |
| `clientName` | Requerido | `Transportes Ltda.` |
| `clientDepartment` | Requerido | `Administración` |
| `vehicleBrand` | Requerido | `Mercedes-Benz` |
| `vehicleModel` | Requerido | `Actros` |
| `licensePlate` | Formato AAAA-00 | `ABCD-12` |
| `origin` | Requerido | `Santiago Centro` |
| `destination` | Requerido | `Las Condes` |
| `serviceType` | Debe existir en BD | `Grúa Pesada` |
| `value` | Número > 0 | `150000` |
| `craneLicensePlate` | Debe existir en BD | `GR-001` |
| `operatorRut` | Debe existir en BD | `12.345.678-9` |
| `operatorCommission` | Número >= 0 | `15000` |

### 5.2 Validaciones para Costos (XML)

| Campo | Validación | Requerido |
|-------|------------|-----------|
| `fecha` | Fecha válida y parseable | ✅ |
| `monto` | Número > 0 | ✅ |
| `descripcion` | Texto no vacío | ✅ |
| `proveedor` | Texto (advertencia si falta) | ❌ |
| `categoria` | Texto (se asigna por defecto) | ❌ |
| `numeroFactura` | Texto | ❌ |
| `rut` | RUT chileno | ❌ |

---

## 6. Estructura de Archivos

```
src/
├── components/
│   ├── services/
│   │   ├── EnhancedCSVUploadServices.tsx  # Componente principal CSV/Excel
│   │   ├── CSVUploadServices.tsx           # Versión básica
│   │   ├── BatchUploadAnimations.tsx       # Partículas y confetti
│   │   ├── AnimatedProgress.tsx            # Barra de progreso animada
│   │   └── AnimatedStatCard.tsx            # Tarjetas de estadísticas
│   ├── costs/
│   │   └── XMLCostUpload.tsx               # Componente principal XML
│   └── ui/
│       └── batch-progress-modal.tsx        # Modal de progreso retro
├── hooks/
│   ├── useEnhancedCSVUpload.ts             # Hook orquestador CSV
│   ├── useCSVUpload.ts                     # Hook básico CSV
│   └── useFolioGenerator.ts                # Sincronización de folios
├── utils/
│   ├── enhancedCsvUpload.ts                # Clase EnhancedCSVUploader
│   ├── csvValidations.ts                   # Validaciones CSV
│   ├── csvUpload/
│   │   ├── templateGenerator.ts            # Generador de plantillas
│   │   ├── serviceUploader.ts              # Uploader básico
│   │   └── types.ts                        # Tipos CSV
│   ├── dataMapper/
│   │   ├── index.ts                        # DataMapper principal
│   │   ├── headerMapping.ts                # Mapeo de headers
│   │   ├── rowMapper.ts                    # Mapeo de filas
│   │   ├── entityFinders.ts                # Búsqueda de entidades
│   │   ├── dataLoaders.ts                  # Cargadores de datos
│   │   ├── dataValidators.ts               # Validadores
│   │   └── types.ts                        # Tipos DataMapper
│   └── xmlParser/
│       └── xmlCostParser.ts                # Parser XML para costos
└── types/
    └── costs.ts                            # Tipos XML
```

---

## 7. Dependencias

```json
{
  "papaparse": "^5.5.3",
  "@types/papaparse": "^5.3.16",
  "xlsx": "^0.18.5",
  "@tanstack/react-query": "^5.56.2",
  "@supabase/supabase-js": "^2.50.0",
  "lucide-react": "^0.462.0",
  "sonner": "^1.5.0",
  "date-fns": "^4.1.0"
}
```

---

## 8. Patrones y Buenas Prácticas

### 8.1 Procesamiento en Lotes
- Tamaño de lote: 25 servicios por batch
- Delay entre batches: 100ms para evitar sobrecarga
- Progreso visual por lote

### 8.2 Feedback Visual
- Animaciones de partículas durante carga
- Confetti al completar exitosamente
- Cambio de colores en barra de progreso según porcentaje
- Estadísticas animadas con count-up

### 8.3 Mapeo Inteligente
- Headers flexibles con múltiples aliases
- Búsqueda de entidades por RUT, patente, nombre
- Categorización automática por proveedor (XML)
- Detección automática de estructura XML

### 8.4 Validación Incremental
- Validación por fila con acumulación de errores
- Separación de errores y advertencias
- Continúa con filas válidas si hay errores

### 8.5 Sincronización Post-Carga
- Actualización automática del contador de folios
- Invalidación de queries para refrescar UI
- Notificación de éxito/error con sonner

### 8.6 Recuperación de Errores
- Identificación de filas fallidas
- Detalles de error por fila
- Opción de reintentar solo las fallidas

---

## 9. Ejemplo de Uso

### 9.1 Integración del Upload de Servicios

```typescript
import { EnhancedCSVUploadServices } from '@/components/services/EnhancedCSVUploadServices';

function ServicesPage() {
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div>
      <Button onClick={() => setShowUpload(true)}>
        <Upload className="mr-2" />
        Carga Masiva
      </Button>

      {showUpload && (
        <Dialog open={showUpload} onOpenChange={setShowUpload}>
          <DialogContent className="max-w-5xl">
            <EnhancedCSVUploadServices
              onClose={() => setShowUpload(false)}
              onSuccess={(count) => {
                toast.success(`${count} servicios cargados correctamente`);
                setShowUpload(false);
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
```

### 9.2 Integración del Upload de XML

```typescript
import { XMLCostUpload } from '@/components/costs/XMLCostUpload';

function CostsPage() {
  const [showXMLUpload, setShowXMLUpload] = useState(false);

  return (
    <div>
      <Button onClick={() => setShowXMLUpload(true)}>
        <Code className="mr-2" />
        Cargar desde XML
      </Button>

      <XMLCostUpload
        isOpen={showXMLUpload}
        onClose={() => setShowXMLUpload(false)}
        onSuccess={(count) => {
          toast.success(`${count} gastos cargados desde XML`);
        }}
      />
    </div>
  );
}
```

---

## 10. Notas de Implementación

1. **Inicialización**: El `EnhancedCSVUploader` requiere inicialización asíncrona para cargar datos de referencia (clientes, grúas, operadores).

2. **Parseo Excel**: Usa la librería `xlsx` con opciones específicas para fechas y celdas vacías.

3. **Validación RUT**: Implementar algoritmo de validación de RUT chileno con dígito verificador.

4. **Folios**: Después de la carga masiva, sincronizar el contador de folios en `company_data`.

5. **Animaciones CSS**: Agregar en `tailwind.config.ts`:
   ```javascript
   animation: {
     'shimmer': 'shimmer 2s infinite',
     'scale-pulse': 'scale-pulse 0.6s ease-out',
     'bounce-in': 'bounce-in 0.5s ease-out',
     'progress-flow': 'progress-flow 1s infinite'
   }
   ```

6. **Audio Retro**: Opcional - agregar sonidos 8-bit para feedback de éxito/error.

---

*Documento generado para replicación del sistema TMS en proyectos Lovable.*
