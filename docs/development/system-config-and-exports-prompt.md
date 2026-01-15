# System Configuration & Exports - Complete Implementation Guide

## Descripción General

Este documento describe la implementación completa de:
1. **Exportación PDF y Excel** con configuración dinámica de columnas
2. **Upload de archivos XML** para carga masiva de datos
3. **Gestión de logotipo de empresa** almacenado en base de datos
4. **Integración de logo en Sidebar** y reportes
5. **Sistema global de estados** para servicios, cierres y facturas

---

## 1. Configuración de Exportación PDF y Excel

### 1.1 Dependencias

```json
{
  "jspdf": "^3.0.1",
  "jspdf-autotable": "^5.0.2",
  "xlsx": "^0.18.5",
  "date-fns": "^4.1.0"
}
```

### 1.2 Configuración de Columnas Dinámicas

```typescript
// src/types/reportColumnConfig.ts

export interface ReportColumnConfig {
  visible: boolean;
  width: number;      // Porcentaje del ancho (3-25%)
  label: string;
}

export interface ReportColumnsConfig {
  columns: {
    fecha: ReportColumnConfig;
    folio: ReportColumnConfig;
    cliente: ReportColumnConfig;
    asegurado: ReportColumnConfig;
    cotizacion: ReportColumnConfig;
    oc: ReportColumnConfig;
    factura: ReportColumnConfig;
    tipoServicio: ReportColumnConfig;
    patente: ReportColumnConfig;
    origen: ReportColumnConfig;
    destino: ReportColumnConfig;
    estado: ReportColumnConfig;
    valor: ReportColumnConfig;
  };
}

export type ColumnKey = keyof ReportColumnsConfig['columns'];

export const defaultReportColumnConfig: ReportColumnsConfig = {
  columns: {
    fecha: { visible: true, width: 6, label: 'Fecha' },
    folio: { visible: true, width: 6, label: 'Folio' },
    cliente: { visible: true, width: 11, label: 'Cliente' },
    asegurado: { visible: true, width: 11, label: 'Asegurado' },
    cotizacion: { visible: true, width: 6, label: 'Cotización' },
    oc: { visible: true, width: 5, label: 'OC' },
    factura: { visible: true, width: 4, label: 'Factura' },
    tipoServicio: { visible: true, width: 7, label: 'Tipo Servicio' },
    patente: { visible: true, width: 7, label: 'Patente' },
    origen: { visible: true, width: 12, label: 'Origen' },
    destino: { visible: true, width: 12, label: 'Destino' },
    estado: { visible: true, width: 6, label: 'Estado' },
    valor: { visible: true, width: 7, label: 'Valor' }
  }
};

export const columnOrder: ColumnKey[] = [
  'fecha', 'folio', 'cliente', 'asegurado', 'cotizacion', 'oc', 'factura',
  'tipoServicio', 'patente', 'origen', 'destino', 'estado', 'valor'
];
```

### 1.3 Utilidades de Reporte

```typescript
// src/utils/reports/reportUtils.ts

import { Settings } from '@/types/settings';

export const createExportFileName = (prefix: string, dateFrom: string, dateTo: string): string => {
  return `${prefix}-${dateFrom}-a-${dateTo}`;
};

export const addCompanyHeader = async (
  doc: any, 
  company: Settings['company'], 
  startY: number, 
  logoUrl?: string
): Promise<number> => {
  const pageWidth = doc.internal.pageSize.width;
  let yPosition = startY;

  // Logo de la empresa (desde DB o fallback)
  try {
    const finalLogoUrl = logoUrl || company.logo || '/logo-default.png';
    console.log('📄 [REPORT-HEADER] Usando logo:', finalLogoUrl);
    
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = finalLogoUrl;
    
    await new Promise((resolve, reject) => {
      img.onload = () => {
        const logoWidth = 35;
        const logoHeight = (img.height * logoWidth) / img.width;
        doc.addImage(img, 'PNG', pageWidth - 14 - logoWidth, yPosition, logoWidth, logoHeight);
        resolve(true);
      };
      img.onerror = (e) => {
        console.warn("Error loading logo for PDF, using text instead", e);
        resolve(true); // Continue without logo
      };
    });
  } catch (e) {
    console.warn("Could not add logo to PDF, using text fallback.", e);
  }
  
  // Información de la empresa
  doc.setFontSize(18);
  doc.setFont(undefined, 'bold');
  doc.text(company.name || 'Mi Empresa', 14, yPosition + 7);
  doc.setFont(undefined, 'normal');

  doc.setFontSize(9);
  doc.setTextColor(100);
  
  if (company.taxId) {
    doc.text(`RUT: ${company.taxId}`, 14, yPosition + 14);
  }
  
  let nextLineY = yPosition + (company.taxId ? 19 : 14);
  
  if (company.address) {
    doc.text(company.address, 14, nextLineY);
    nextLineY += 5;
  }
  
  if (company.phone || company.email) {
    const contactInfo = [];
    if (company.phone) contactInfo.push(`Tel: ${company.phone}`);
    if (company.email) contactInfo.push(`Email: ${company.email}`);
    doc.text(contactInfo.join(' | '), 14, nextLineY);
    nextLineY += 5;
  }
  
  return nextLineY + 10;
};
```

### 1.4 Exportador de Reportes

```typescript
// src/utils/reports/serviceReportExporter.ts

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { createExportFileName, addCompanyHeader } from './reportUtils';
import { defaultReportColumnConfig, ColumnKey, columnOrder, ReportColumnsConfig } from '@/types/reportColumnConfig';

interface ExportServiceReportArgs {
  format: 'pdf' | 'excel';
  services: Service[];
  settings: Settings;
  appliedFilters: {
    dateRange: { from: string; to: string };
    client: string;
  };
  logoUrl?: string;
  customFileName?: string;
  reportColumnConfig?: ReportColumnsConfig;
}

// Obtener valor de columna
const getColumnValue = (service: Service, key: ColumnKey): string => {
  switch (key) {
    case 'fecha':
      return formatDate(new Date(service.serviceDate + 'T00:00:00'), 'dd/MM/yy');
    case 'folio':
      return service.folio;
    case 'cliente':
      return truncate(service.client.name, 14);
    case 'asegurado':
      return truncate((service as any).insuredName || '-', 14);
    case 'cotizacion':
      return truncate(service.quoteNumber || '-', 8);
    case 'oc':
      return truncate(service.purchaseOrder || '-', 6);
    case 'factura':
      return truncate(service.invoiceFolio || '-', 5);
    case 'tipoServicio':
      return truncate(service.serviceType.name, 8);
    case 'patente':
      return service.licensePlate || 'N/A';
    case 'origen':
      return truncate(service.origin || 'N/A', 10);
    case 'destino':
      return truncate(service.destination || 'N/A', 10);
    case 'estado':
      return service.status;
    case 'valor':
      return `$${getDisplayServiceValue(service).toLocaleString('es-CL')}`;
    default:
      return '-';
  }
};

const truncate = (str: string, maxLength: number): string => {
  return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
};

export const exportServiceReport = async ({ 
  format, 
  services, 
  settings, 
  appliedFilters, 
  logoUrl, 
  customFileName,
  reportColumnConfig 
}: ExportServiceReportArgs) => {
  const { company } = settings;
  const exportFileName = customFileName || createExportFileName(
    'informe-servicios', 
    appliedFilters.dateRange.from, 
    appliedFilters.dateRange.to
  );
  
  const config = reportColumnConfig || defaultReportColumnConfig;
  const visibleColumns = columnOrder.filter(key => config.columns[key].visible);
  
  // Ordenar servicios por fecha
  const sortedServices = [...services].sort((a, b) => {
    return new Date(a.serviceDate).getTime() - new Date(b.serviceDate).getTime();
  });
  
  const totalValue = sortedServices.reduce((acc, service) => {
    return acc + getDisplayServiceValue(service);
  }, 0);

  if (format === 'pdf') {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.width;
    let startY = await addCompanyHeader(doc, company, 15, logoUrl);

    // Título
    doc.setFontSize(14);
    doc.text('Informe de Servicios', 14, startY);
    startY += 10;
    
    // Filtros aplicados
    const filterLabels = [
      ['Período', `${formatDate(new Date(appliedFilters.dateRange.from), 'P', { locale: es })} - ${formatDate(new Date(appliedFilters.dateRange.to), 'P', { locale: es })}`],
      ['Cliente', appliedFilters.client]
    ];
    autoTable(doc, { body: filterLabels, startY, theme: 'plain', styles: { fontSize: 9 } });
    let lastY = (doc as any).lastAutoTable.finalY;

    // Resumen
    const summaryData = [
      ['Total Servicios', sortedServices.length.toString()],
      ['Valor Total', `$${totalValue.toLocaleString('es-CL')}`]
    ];
    autoTable(doc, { head: [['Resumen', '']], body: summaryData, startY: lastY + 5, theme: 'grid' });
    lastY = (doc as any).lastAutoTable.finalY;

    // Headers dinámicos
    const headers = visibleColumns.map(key => config.columns[key].label);
    
    // Body dinámico
    const body = sortedServices.map(service => 
      visibleColumns.map(key => getColumnValue(service, key))
    );

    // Calcular anchos proporcionales
    const totalWidth = visibleColumns.reduce((sum, key) => sum + config.columns[key].width, 0);
    const availableWidth = pageWidth - 28;
    
    const columnStyles: Record<number, { cellWidth: number }> = {};
    visibleColumns.forEach((key, index) => {
      const widthPercent = config.columns[key].width / totalWidth;
      columnStyles[index] = { cellWidth: availableWidth * widthPercent };
    });

    autoTable(doc, {
      head: [headers],
      body,
      startY: lastY + 10,
      headStyles: { fillColor: [41, 128, 185], fontSize: 7 },
      styles: { fontSize: 6, cellPadding: 1 },
      tableWidth: availableWidth,
      columnStyles
    });
    
    doc.save(`${exportFileName}.pdf`);

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Detalle de Servicios
    const services_data = sortedServices.map(s => ({
      'Fecha Servicio': formatDate(new Date(s.serviceDate), 'yyyy-MM-dd'),
      'Hora Inicio': s.startTime || '-',
      'Hora Término': s.endTime || '-',
      'Folio': s.folio,
      'Cliente': s.client.name,
      'RUT Cliente': s.client.rut,
      'Asegurado': (s as any).insuredName || '-',
      'Cotización': s.quoteNumber || '-',
      'Orden de Compra': s.purchaseOrder || '-',
      'Factura': s.invoiceFolio || '-',
      'Tipo de Servicio': s.serviceType.name,
      'Patente Vehículo': s.licensePlate || 'N/A',
      'Origen': s.origin || 'N/A',
      'Destino': s.destination || 'N/A',
      'Estado': s.status,
      'Valor': getDisplayServiceValue(s),
    }));
    const services_ws = XLSX.utils.json_to_sheet(services_data);
    XLSX.utils.book_append_sheet(wb, services_ws, 'Detalle de Servicios');

    // Hoja 2: Resumen
    const summary_ws_data = [
      [company.name],
      ['Informe de Servicios'], [],
      ['Filtros Aplicados'],
      ['Período', `${appliedFilters.dateRange.from} a ${appliedFilters.dateRange.to}`],
      ['Cliente', appliedFilters.client], [],
      ['Resumen'],
      ['Métrica', 'Valor'],
      ['Total Servicios', sortedServices.length],
      ['Valor Total', totalValue],
    ];
    const summary_ws = XLSX.utils.aoa_to_sheet(summary_ws_data);
    XLSX.utils.book_append_sheet(wb, summary_ws, 'Resumen');

    XLSX.writeFile(wb, `${exportFileName}.xlsx`);
  }
};
```

---

## 2. Upload de Archivos XML

### 2.1 Tipos de Datos XML

```typescript
// src/types/costs.ts

export interface XMLCostData {
  fecha: Date | string;
  descripcion: string;
  monto: number;
  categoria?: string;
  subcategoria?: string;
  proveedor?: string;
  rut?: string;
  telefono?: string;
  notas?: string;
  numeroFactura?: string;
}

export interface XMLParseResult {
  success: boolean;
  data: XMLCostData[];
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
}

export interface XMLStructure {
  name: string;
  rootElement: string;
  itemElement: string;
  fields: XMLFieldMapping[];
}

export interface XMLFieldMapping {
  source: string;
  target: keyof XMLCostData;
  type: 'string' | 'number' | 'date';
  required?: boolean;
  transform?: (value: string) => any;
}
```

### 2.2 Parser de Costos XML

```typescript
// src/utils/xmlParser/xmlCostParser.ts

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
        success: false,
        data: [],
        errors: [`Error leyendo archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`],
        warnings: [],
        totalRows: 0,
        validRows: 0
      };
    }
  }

  public parseXMLString(xmlString: string): XMLParseResult {
    try {
      const doc = this.parser.parseFromString(xmlString, 'text/xml');
      
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        return {
          success: false,
          data: [],
          errors: ['El archivo XML no es válido'],
          warnings: [],
          totalRows: 0,
          validRows: 0
        };
      }

      const structure = this.detectXMLStructure(doc);
      const data = this.extractDataFromXML(doc, structure);
      const validation = this.validateData(data);

      return {
        success: validation.errors.length === 0,
        data: data,
        errors: validation.errors,
        warnings: validation.warnings,
        totalRows: data.length,
        validRows: data.filter(item => this.isValidItem(item)).length
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`Error procesando XML: ${error instanceof Error ? error.message : 'Error desconocido'}`],
        warnings: [],
        totalRows: 0,
        validRows: 0
      };
    }
  }

  private detectXMLStructure(doc: Document): XMLStructure {
    // Detectar DTE chileno
    if (doc.querySelector('DTE')) {
      return this.getDTEStructure();
    }
    
    // Detectar estructura de gastos genérica
    if (doc.querySelector('gastos')) {
      return this.getGenericExpenseStructure();
    }
    
    // Detectar facturas genéricas
    if (doc.querySelector('facturas')) {
      return this.getGenericInvoiceStructure();
    }
    
    // Detección automática
    return this.detectAutomaticStructure(doc);
  }

  private getDTEStructure(): XMLStructure {
    return {
      name: 'DTE',
      rootElement: 'DTE',
      itemElement: 'Documento',
      fields: [
        { source: 'Encabezado/IdDoc/FchEmis', target: 'fecha', type: 'date', required: true },
        { source: 'Encabezado/Totales/MntTotal', target: 'monto', type: 'number', required: true },
        { source: 'Encabezado/Emisor/RznSoc', target: 'proveedor', type: 'string' },
        { source: 'Encabezado/Emisor/RUTEmisor', target: 'rut', type: 'string' },
        { source: 'Encabezado/IdDoc/Folio', target: 'numeroFactura', type: 'string' },
      ]
    };
  }

  private extractDataFromXML(doc: Document, structure: XMLStructure): XMLCostData[] {
    const items: XMLCostData[] = [];
    const elements = doc.querySelectorAll(structure.itemElement);

    elements.forEach((element, index) => {
      const item: Partial<XMLCostData> = {};

      structure.fields.forEach(field => {
        const value = this.getNestedValue(element, field.source);
        if (value) {
          item[field.target] = this.transformValue(value, field.type);
        }
      });

      // Añadir descripción si no existe
      if (!item.descripcion && item.proveedor) {
        item.descripcion = `Factura de ${item.proveedor}`;
      }

      if (item.fecha && item.monto && item.descripcion) {
        items.push(item as XMLCostData);
      }
    });

    return items;
  }

  private categorizeBySupplier(supplier: string): string {
    const name = supplier.toLowerCase();
    
    if (name.includes('combustible') || name.includes('copec') || name.includes('shell')) {
      return 'combustible';
    }
    if (name.includes('mantención') || name.includes('taller') || name.includes('repuesto')) {
      return 'mantenimiento';
    }
    if (name.includes('seguro') || name.includes('póliza')) {
      return 'seguros';
    }
    
    return 'otros';
  }

  private validateData(data: XMLCostData[]): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    data.forEach((item, index) => {
      if (!item.fecha) errors.push(`Registro ${index + 1}: Fecha es requerida`);
      if (!item.monto || item.monto <= 0) errors.push(`Registro ${index + 1}: Monto debe ser mayor a 0`);
      if (!item.descripcion) errors.push(`Registro ${index + 1}: Descripción es requerida`);
      if (!item.proveedor) warnings.push(`Registro ${index + 1}: Proveedor no especificado`);
    });

    return { errors, warnings };
  }

  private isValidItem(item: XMLCostData): boolean {
    return !!(item.fecha && item.monto && item.monto > 0 && item.descripcion);
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Error leyendo archivo'));
      reader.readAsText(file);
    });
  }

  private getNestedValue(element: Element, path: string): string {
    const parts = path.split('/');
    let current = element;
    for (const part of parts) {
      const child = current.querySelector(part);
      if (!child) return '';
      current = child;
    }
    return current.textContent?.trim() || '';
  }

  private transformValue(value: string, type: 'string' | 'number' | 'date'): any {
    switch (type) {
      case 'number':
        return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
      case 'date':
        return new Date(value);
      default:
        return value;
    }
  }
}
```

### 2.3 Parser de Proveedores XML

```typescript
// src/utils/xmlParser/xmlSupplierParser.ts

export interface XMLSupplierData {
  name: string;
  rut: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_name?: string;
  category?: string;
  notes?: string;
  is_active: boolean;
}

export class XMLSupplierParser {
  private parser: DOMParser;

  constructor() {
    this.parser = new DOMParser();
  }

  private extractSupplierFromDTE(dteElement: Element): XMLSupplierData | null {
    const getNestedValue = (path: string): string => {
      const parts = path.split('/');
      let current = dteElement;
      for (const part of parts) {
        const child = current.querySelector(part);
        if (!child) return '';
        current = child;
      }
      return current.textContent?.trim() || '';
    };

    const rut = getNestedValue('Documento/Encabezado/Emisor/RUTEmisor');
    const name = getNestedValue('Documento/Encabezado/Emisor/RznSoc');
    const giro = getNestedValue('Documento/Encabezado/Emisor/GiroEmis');
    const direccion = getNestedValue('Documento/Encabezado/Emisor/DirOrigen');
    const telefono = getNestedValue('Documento/Encabezado/Emisor/Telefono');
    const email = getNestedValue('Documento/Encabezado/Emisor/CorreoEmisor');

    if (!rut || !name) return null;

    return {
      name: name,
      rut: this.formatRUT(rut),
      email: email || '',
      phone: telefono || '',
      address: direccion || '',
      contact_name: '',
      category: this.categorizeByBusiness(giro || name),
      notes: giro ? `Giro comercial: ${giro}` : '',
      is_active: true
    };
  }

  private formatRUT(rut: string): string {
    const cleaned = rut.replace(/[^\dkK]/g, '');
    if (cleaned.length < 8) return rut;
    
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    
    return body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
  }

  private validateRUT(rut: string): boolean {
    const cleaned = rut.replace(/[^\dkK]/g, '');
    if (cleaned.length < 8) return false;
    
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    
    let sum = 0;
    let multiplier = 2;
    
    for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }
    
    const calculatedDV = 11 - (sum % 11);
    const expectedDV = calculatedDV === 11 ? '0' : calculatedDV === 10 ? 'K' : calculatedDV.toString();
    
    return dv === expectedDV;
  }

  private categorizeByBusiness(businessDescription: string): string {
    const description = businessDescription.toLowerCase();
    
    if (description.includes('combustible') || description.includes('gasolina')) {
      return 'combustible';
    }
    if (description.includes('mantención') || description.includes('taller')) {
      return 'mantenimiento';
    }
    if (description.includes('seguro') || description.includes('póliza')) {
      return 'seguros';
    }
    if (description.includes('peaje') || description.includes('autopista')) {
      return 'peajes';
    }
    
    return 'otros';
  }
}
```

### 2.4 Componente de Upload XML

```typescript
// src/components/costs/XMLCostUpload.tsx

import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BatchProgressModal, useBatchProgress } from '@/components/ui/batch-progress-modal';
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, Code, Database } from 'lucide-react';
import { XMLCostParser } from '@/utils/xmlParser/xmlCostParser';
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
        ].filter(Boolean).join(' | ') || null,
      };

      try {
        await addCostAsync(costData);
        successCount++;
      } catch {
        errorCount++;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (errorCount === 0) {
      batchProgress.complete();
      setTimeout(() => {
        onSuccess?.(successCount);
        onClose();
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

        {/* Drag & Drop Area */}
        <Card>
          <CardContent className="pt-6">
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => document.getElementById('xml-upload')?.click()}
            >
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Arrastra tu archivo XML aquí o haz clic para seleccionar
              </p>
              <input type="file" accept=".xml" onChange={handleFileSelect} className="hidden" id="xml-upload" />
              <Button variant="outline">Seleccionar XML</Button>
            </div>
          </CardContent>
        </Card>

        {/* File Preview & Actions */}
        {file && (
          <div className="flex justify-end gap-2">
            <Button onClick={handleAnalyzeFile}>
              <Code className="w-4 h-4 mr-2" />
              Analizar XML
            </Button>
          </div>
        )}

        {/* Parse Results with Category Mapping */}
        {parseResult && parseResult.success && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                {parseResult.validRows} registros válidos
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                      <TableCell>{new Date(item.fecha).toLocaleDateString('es-CL')}</TableCell>
                      <TableCell>{item.descripcion}</TableCell>
                      <TableCell>${item.monto.toLocaleString('es-CL')}</TableCell>
                      <TableCell>{item.proveedor || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={categoryMappings[`${index}-categoria`]}
                          onValueChange={(value) => handleCategoryChange(index, value)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(category => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
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
                  {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                  Cargar {parseResult.validRows} Gastos
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
      
      <BatchProgressModal state={batchProgress.state} onClose={batchProgress.close} />
    </Dialog>
  );
};
```

---

## 3. Gestión de Logotipo de Empresa

### 3.1 Esquema de Base de Datos

```sql
-- Tabla de datos de empresa
CREATE TABLE company_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  rut TEXT,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  logo_url TEXT,                              -- URL del logo en Storage
  folio_format TEXT DEFAULT 'SRV-{number}',
  next_service_folio_number INTEGER DEFAULT 1000,
  alert_days INTEGER DEFAULT 30,
  vat_percentage NUMERIC DEFAULT 19,
  legal_texts TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bucket de Storage para assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-assets', 'company-assets', true);

-- Políticas RLS para Storage
CREATE POLICY "Allow public read access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'company-assets');

CREATE POLICY "Allow authenticated uploads" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'company-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated updates" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'company-assets' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated deletes" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'company-assets' AND auth.role() = 'authenticated');
```

### 3.2 Hook para Actualizar Logo

```typescript
// src/hooks/useLogoUpdater.ts

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Settings } from '@/types/settings';

export const useLogoUpdater = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateLogo = async (
    logoFile: File | null,
    settings: Settings
  ): Promise<{ success: boolean; error?: string; newLogoUrl?: string }> => {
    setIsUpdating(true);
    console.log("useLogoUpdater: Iniciando proceso de actualización de logo.");

    let companyId: string;
    let oldLogoUrl: string | null | undefined;
    let newLogoPath: string | undefined;

    try {
      // Paso 1: Obtener o crear el registro de la empresa
      let { data: companyData, error: companySelectError } = await supabase
        .from('company_data')
        .select('id, logo_url')
        .limit(1)
        .maybeSingle();

      if (companySelectError) {
        throw new Error(`Error al consultar la empresa: ${companySelectError.message}`);
      }

      if (companyData) {
        companyId = companyData.id;
        oldLogoUrl = companyData.logo_url;
      } else {
        // Crear registro si no existe
        const { data: newCompanyData, error: companyInsertError } = await supabase
          .from('company_data')
          .insert({
            business_name: settings.company.name || 'Mi Empresa',
            rut: settings.company.taxId || '',
            address: settings.company.address || '',
            phone: settings.company.phone || '',
            email: settings.company.email || '',
          })
          .select('id, logo_url')
          .single();

        if (companyInsertError) {
          throw new Error(`Error al crear la empresa: ${companyInsertError.message}`);
        }
        companyId = newCompanyData.id;
        oldLogoUrl = newCompanyData.logo_url;
      }

      // Paso 2: Subir nuevo logo si existe
      let newLogoUrlForDB: string | null = oldLogoUrl || null;

      if (logoFile) {
        // Generar nombre único
        newLogoPath = `public/logo-${companyId}-${Date.now()}-${logoFile.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('company-assets')
          .upload(newLogoPath, logoFile);

        if (uploadError) {
          throw new Error(`Error al subir el logo: ${uploadError.message}`);
        }
        
        const { data: urlData } = supabase.storage
          .from('company-assets')
          .getPublicUrl(newLogoPath);
        
        newLogoUrlForDB = urlData.publicUrl;
      } else if (logoFile === null) {
        // Eliminar logo
        newLogoUrlForDB = null;
      }

      // Paso 3: Actualizar base de datos
      if (newLogoUrlForDB !== oldLogoUrl) {
        const { error: dbUpdateError } = await supabase
          .from('company_data')
          .update({ logo_url: newLogoUrlForDB })
          .eq('id', companyId);

        if (dbUpdateError) {
          // Rollback: eliminar archivo subido
          if (newLogoPath) {
            await supabase.storage.from('company-assets').remove([newLogoPath]);
          }
          throw new Error(`Error al guardar el logo: ${dbUpdateError.message}`);
        }

        // Paso 4: Verificación post-guardado
        const { data: verificationData, error: verificationError } = await supabase
          .from('company_data')
          .select('logo_url')
          .eq('id', companyId)
          .single();

        if (verificationError || verificationData?.logo_url !== newLogoUrlForDB) {
          throw new Error('La verificación post-guardado falló.');
        }

        // Paso 5: Eliminar logo antiguo
        if (oldLogoUrl && newLogoPath) {
          const oldLogoPath = oldLogoUrl.split('/company-assets/')[1]?.split('?')[0];
          if (oldLogoPath) {
            await supabase.storage.from('company-assets').remove([oldLogoPath]);
          }
        }
      }

      return { success: true, newLogoUrl: newLogoUrlForDB || undefined };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      return { success: false, error: errorMessage };
    } finally {
      setIsUpdating(false);
    }
  };

  // Función para subir logo predeterminado
  const uploadDefaultLogo = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/images/company-logo.jpg');
      if (!response.ok) {
        throw new Error('No se pudo cargar el logo predeterminado');
      }
      
      const blob = await response.blob();
      const file = new File([blob], 'company-logo.jpg', { type: 'image/jpeg' });
      
      const result = await updateLogo(file, defaultSettings);
      return result;
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
    }
  };

  return { isUpdating, updateLogo, uploadDefaultLogo };
};
```

---

## 4. Logo y Nombre de Empresa en Sidebar

### 4.1 Tipos de Settings

```typescript
// src/types/settings.ts

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logo?: string;              // URL del logo desde DB
  folioFormat: string;
  nextServiceFolioNumber?: number;
}

export interface Settings {
  company: CompanySettings;
  user: UserSettings;
  system: SystemSettings;
  notifications: NotificationSettings;
}
```

### 4.2 Sidebar con Logo Dinámico

```typescript
// src/components/layout/Sidebar.tsx

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useSettings } from '@/hooks/useSettings';
import { cn } from '@/lib/utils';
import { Building2, LogOut, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export const Sidebar = ({
  isCollapsed,
  setIsCollapsed,
  isMobileMenuOpen,
  setIsMobileMenuOpen
}: SidebarProps) => {
  const { user, logout } = useUser();
  const { settings } = useSettings();
  const location = useLocation();
  
  // Obtener datos de empresa desde settings
  const companyName = settings?.company?.name || 'Mi Empresa';
  const companyLogo = settings?.company?.logo;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-background border-r">
      {/* Header con Logo de Empresa */}
      <div className="flex items-center justify-between p-4 border-b">
        {!isCollapsed && (
          <div className="flex items-center space-x-3">
            {/* Logo dinámico o icono fallback */}
            {companyLogo ? (
              <img 
                src={companyLogo} 
                alt="Logo empresa" 
                className="w-8 h-8 object-contain" 
              />
            ) : (
              <Building2 className="w-8 h-8 text-primary" />
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{companyName}</h1>
              <p className="text-xs font-bold text-violet-600">Sistema de Gestión</p>
            </div>
          </div>
        )}

        {/* Logo colapsado */}
        {isCollapsed && (
          <div className="flex items-center justify-center w-full">
            {companyLogo ? (
              <img src={companyLogo} alt="Logo empresa" className="w-8 h-8 object-contain" />
            ) : (
              <Building2 className="w-8 h-8 text-primary" />
            )}
          </div>
        )}
        
        {/* Botón colapsar */}
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </Button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 p-3 overflow-y-auto">
        {/* Items de navegación */}
      </nav>

      {/* Sección de usuario */}
      <div className="border-t p-4">
        {!isCollapsed && user && (
          <div className="mb-3">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <p className="text-xs capitalize text-primary">{user.role}</p>
          </div>
        )}
        
        <Button variant="ghost" onClick={logout} className="w-full justify-start">
          <LogOut className="w-4 h-4 mr-2" />
          {!isCollapsed && "Cerrar Sesión"}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className={cn(
        "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-50 transition-all duration-300 h-screen",
        isCollapsed ? "lg:w-16" : "lg:w-64"
      )}>
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:hidden",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent />
      </div>
    </>
  );
};
```

---

## 5. Sistema Global de Estados

### 5.1 Definición de Estados

```typescript
// src/utils/statusHelpers.ts

import React from 'react';
import { Badge } from '@/components/ui/badge';

// Estados de Servicios (10 estados)
export type ServiceStatus = 
  | 'pending'                  // Pendiente
  | 'in_progress'              // En Progreso
  | 'inspection_completed'     // Inspección Completada
  | 'completed'                // Completado
  | 'cancelled'                // Cancelado
  | 'invoiced'                 // Facturado
  | 'quoted'                   // Cotizado
  | 'purchase_order_pending'   // Esperando O.C.
  | 'with_purchase_order'      // Con Orden de Compra
  | 'failed';                  // Fallido

// Estados de Cierres (5 estados)
export type ClosureStatus = 
  | 'open'                     // Abierto
  | 'closed'                   // Cerrado
  | 'invoiced'                 // Facturado
  | 'quoted'                   // Cotizado
  | 'purchase_order_pending';  // Esperando O.C.

// Estados de Facturas (5 estados)
export type InvoiceStatus = 
  | 'draft'                    // Borrador
  | 'sent'                     // Enviada
  | 'paid'                     // Pagada
  | 'overdue'                  // Vencida
  | 'cancelled';               // Cancelada

interface StatusConfig {
  label: string;
  className: string;
}

// Configuración centralizada de estados de servicios
const SERVICE_STATUS_CONFIG: Record<ServiceStatus, StatusConfig> = {
  pending: { label: 'Pendiente', className: 'bg-yellow-500/80 text-white' },
  in_progress: { label: 'En Progreso', className: 'bg-blue-500/80 text-white' },
  inspection_completed: { label: 'Inspección Completada', className: 'bg-orange-500/80 text-white' },
  completed: { label: 'Completado', className: 'bg-green-500/80 text-white' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/80 text-white' },
  invoiced: { label: 'Facturado', className: 'bg-purple-500/80 text-white' },
  quoted: { label: 'Cotizado', className: 'bg-cyan-500/80 text-white' },
  purchase_order_pending: { label: 'Esperando O.C.', className: 'bg-amber-500/80 text-white' },
  with_purchase_order: { label: 'Con Orden de Compra', className: 'bg-teal-500/80 text-white' },
  failed: { label: 'Fallido', className: 'bg-orange-600/80 text-white' }
};

// Configuración de estados de cierres
const CLOSURE_STATUS_CONFIG: Record<ClosureStatus, StatusConfig> = {
  open: { label: 'Abierto', className: 'bg-blue-500/80 text-white' },
  closed: { label: 'Cerrado', className: 'bg-green-500/80 text-white' },
  invoiced: { label: 'Facturado', className: 'bg-purple-500/80 text-white' },
  quoted: { label: 'Cotizado', className: 'bg-cyan-500/80 text-white' },
  purchase_order_pending: { label: 'Esperando O.C.', className: 'bg-amber-500/80 text-white' }
};

// Configuración de estados de facturas
const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, StatusConfig> = {
  draft: { label: 'Borrador', className: 'bg-gray-500/80 text-white' },
  sent: { label: 'Enviada', className: 'bg-blue-500/80 text-white' },
  paid: { label: 'Pagada', className: 'bg-green-500/80 text-white' },
  overdue: { label: 'Vencida', className: 'bg-red-500/80 text-white' },
  cancelled: { label: 'Cancelada', className: 'bg-gray-600/80 text-white' }
};

// Funciones para obtener Badge de estado
export const getServiceStatusBadge = (status: string) => {
  const config = SERVICE_STATUS_CONFIG[status as ServiceStatus] || { 
    label: 'Desconocido', 
    className: 'bg-gray-500/80 text-white' 
  };
  
  return React.createElement(Badge, { className: `${config.className} border-none` }, config.label);
};

export const getClosureStatusBadge = (status: string) => {
  const config = CLOSURE_STATUS_CONFIG[status as ClosureStatus] || { 
    label: 'Desconocido', 
    className: 'bg-gray-500/80 text-white' 
  };
  
  return React.createElement(Badge, { className: `${config.className} border-none` }, config.label);
};

export const getInvoiceStatusBadge = (status: string) => {
  const config = INVOICE_STATUS_CONFIG[status as InvoiceStatus] || { 
    label: 'Desconocido', 
    className: 'bg-gray-500/80 text-white' 
  };
  
  return React.createElement(Badge, { className: `${config.className} border-none` }, config.label);
};

// Utilidad para formatear moneda
export const formatCurrency = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return '$0';
  }
  
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0
  }).format(Number(amount));
};

// Utilidad para verificar si mostrar info de vehículo
export const shouldShowVehicleInfo = (service: any) => {
  const isOptional = service.vehicleInfoOptional || service.service_type?.vehicle_info_optional;
  
  if (!isOptional) return true;
  
  const hasRealData = service.vehicleBrand && 
                     service.vehicleModel && 
                     service.licensePlate &&
                     service.vehicleBrand !== 'N/A';
  
  return hasRealData;
};
```

---

## 6. Estructura de Archivos Recomendada

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx              # Sidebar con logo dinámico
│   │   └── Header.tsx               # Header con logo
│   ├── costs/
│   │   └── XMLCostUpload.tsx        # Upload XML de costos
│   ├── suppliers/
│   │   └── XMLSupplierUpload.tsx    # Upload XML de proveedores
│   └── settings/
│       ├── LogoUpload.tsx           # Componente upload de logo
│       └── ReportColumnsConfig.tsx  # Config columnas PDF
├── hooks/
│   ├── useSettings.ts               # Hook de configuración
│   ├── useLogoUpdater.ts            # Hook para actualizar logo
│   └── useCostCategories.ts         # Categorías de costos
├── utils/
│   ├── xmlParser/
│   │   ├── xmlCostParser.ts         # Parser XML de costos
│   │   └── xmlSupplierParser.ts     # Parser XML de proveedores
│   ├── reports/
│   │   ├── reportUtils.ts           # Utilidades de reporte
│   │   ├── reportTypes.ts           # Tipos de reporte
│   │   └── serviceReportExporter.ts # Exportador de servicios
│   └── statusHelpers.ts             # Helpers de estados
├── types/
│   ├── settings.ts                  # Tipos de configuración
│   ├── costs.ts                     # Tipos de costos
│   ├── suppliers.ts                 # Tipos de proveedores
│   └── reportColumnConfig.ts        # Config de columnas
└── integrations/
    └── supabase/
        └── client.ts                # Cliente Supabase
```

---

## 7. Dependencias Completas

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.50.0",
    "@tanstack/react-query": "^5.56.2",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-select": "^2.1.1",
    "jspdf": "^3.0.1",
    "jspdf-autotable": "^5.0.2",
    "xlsx": "^0.18.5",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.462.0",
    "sonner": "^1.5.0",
    "tailwind-merge": "^2.5.2"
  }
}
```

---

## 8. Notas de Implementación

### 8.1 Logo de Empresa
- Almacenado en Supabase Storage bucket `company-assets`
- URL guardada en tabla `company_data.logo_url`
- Hook `useLogoUpdater` maneja upload, update y delete
- Verificación post-guardado para garantizar consistencia
- Fallback a icono `Building2` si no hay logo

### 8.2 Exportación PDF
- Columnas dinámicas con visibilidad configurable
- Anchos proporcionales calculados automáticamente
- Logo corporativo cargado desde DB
- Header con información de empresa

### 8.3 Exportación Excel
- Múltiples hojas (Detalle + Resumen)
- Datos completos sin truncar
- Filtros aplicados documentados

### 8.4 Upload XML
- Detección automática de estructura (DTE, genérico)
- Categorización inteligente por proveedor
- Validación de RUT chileno
- Preview editable antes de cargar
- Progreso por lotes con BatchProgressModal

### 8.5 Sistema de Estados
- Configuración centralizada en `statusHelpers.ts`
- Badges con colores consistentes
- Funciones helper para cada tipo de entidad
- Fácil extensión para nuevos estados

---

## 9. Ejemplo de Uso

### Exportar Reporte PDF

```typescript
import { exportServiceReport } from '@/utils/reports/serviceReportExporter';

const handleExport = async () => {
  await exportServiceReport({
    format: 'pdf',
    services: filteredServices,
    settings: settings,
    appliedFilters: {
      dateRange: { from: '2024-01-01', to: '2024-12-31' },
      client: 'Todos'
    },
    logoUrl: settings.company.logo,
    reportColumnConfig: settings.system.reportColumnConfig
  });
};
```

### Actualizar Logo de Empresa

```typescript
import { useLogoUpdater } from '@/hooks/useLogoUpdater';

const { updateLogo, isUpdating } = useLogoUpdater();

const handleLogoChange = async (file: File) => {
  const result = await updateLogo(file, currentSettings);
  if (result.success) {
    toast.success('Logo actualizado correctamente');
  } else {
    toast.error(result.error);
  }
};
```

### Cargar Gastos desde XML

```typescript
import { XMLCostUpload } from '@/components/costs/XMLCostUpload';

<XMLCostUpload 
  isOpen={isXMLModalOpen}
  onClose={() => setIsXMLModalOpen(false)}
  onSuccess={(count) => {
    toast.success(`${count} gastos cargados exitosamente`);
    refetchCosts();
  }}
/>
```

---

## 10. Consideraciones de Seguridad

1. **Storage RLS**: Solo usuarios autenticados pueden subir/modificar archivos
2. **Validación de Archivos**: Verificar tipo MIME antes de procesar XML
3. **Sanitización de Datos**: Limpiar datos extraídos de XML antes de insertar
4. **Verificación Post-Guardado**: Confirmar que los datos se guardaron correctamente
5. **Rollback en Errores**: Si falla la actualización de DB, eliminar archivo subido
