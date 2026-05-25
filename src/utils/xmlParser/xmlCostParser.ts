import { XMLCostData, XMLParseResult, XMLValidationError, XMLStructure } from '@/types/costs';

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
      const doc = this.parser.parseFromString(this.stripNamespaces(xmlString), 'text/xml');
      
      // Verificar errores de parsing
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
    // Detectar estructura común de facturas chilenas DTE
    if (doc.querySelector('DTE')) {
      return this.getDTEStructure();
    }

    // Detectar estructura de gastos genérica
    if (doc.querySelector('gastos') || doc.querySelector('expenses')) {
      return this.getGenericExpenseStructure();
    }

    // Detectar estructura de facturas genéricas
    if (doc.querySelector('facturas') || doc.querySelector('invoices')) {
      return this.getGenericInvoiceStructure();
    }

    // Estructura automática basada en elementos encontrados
    return this.detectAutomaticStructure(doc);
  }

  private getDTEStructure(): XMLStructure {
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

  private getGenericExpenseStructure(): XMLStructure {
    return {
      rootElement: 'gastos',
      itemElement: 'gasto',
      fields: [
        { xmlField: 'fecha', targetField: 'fecha', required: true },
        { xmlField: 'monto', targetField: 'monto', required: true, transform: (v) => parseFloat(v) },
        { xmlField: 'descripcion', targetField: 'descripcion', required: true },
        { xmlField: 'proveedor', targetField: 'proveedor', required: false },
        { xmlField: 'categoria', targetField: 'categoria', required: false },
        { xmlField: 'subcategoria', targetField: 'subcategoria', required: false }
      ],
      detectedFields: []
    };
  }

  private getGenericInvoiceStructure(): XMLStructure {
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

  private detectAutomaticStructure(doc: Document): XMLStructure {
    const rootElement = doc.documentElement.tagName;
    const possibleItemElements = this.findRepeatingElements(doc);
    const itemElement = possibleItemElements[0] || 'item';
    
    const detectedFields = this.getUniqueFieldNames(doc);
    
    return {
      rootElement,
      itemElement,
      fields: this.mapFieldsAutomatically(detectedFields),
      detectedFields
    };
  }

  private findRepeatingElements(doc: Document): string[] {
    const elementCounts: { [key: string]: number } = {};
    const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);
    
    let node = walker.nextNode();
    while (node) {
      const tagName = (node as Element).tagName;
      elementCounts[tagName] = (elementCounts[tagName] || 0) + 1;
      node = walker.nextNode();
    }
    
    return Object.entries(elementCounts)
      .filter(([_, count]) => count > 1)
      .sort(([_, a], [__, b]) => b - a)
      .map(([tagName, _]) => tagName);
  }

  private getUniqueFieldNames(doc: Document): string[] {
    const fieldNames = new Set<string>();
    const walker = doc.createTreeWalker(doc, NodeFilter.SHOW_ELEMENT);
    
    let node = walker.nextNode();
    while (node) {
      const element = node as Element;
      if (element.children.length === 0 && this.cleanExtractedText(element.textContent)) {
        fieldNames.add(element.tagName);
      }
      node = walker.nextNode();
    }
    
    return Array.from(fieldNames);
  }

  private mapFieldsAutomatically(fieldNames: string[]): any[] {
    return fieldNames.map(field => {
      const lowerField = field.toLowerCase();
      
      if (lowerField.includes('fecha') || lowerField.includes('date')) {
        return { xmlField: field, targetField: 'fecha', required: true };
      }
      if (lowerField.includes('monto') || lowerField.includes('total') || lowerField.includes('amount')) {
        return { xmlField: field, targetField: 'monto', required: true, transform: (v: any) => parseFloat(v) };
      }
      if (lowerField.includes('descripcion') || lowerField.includes('description') || lowerField.includes('concepto')) {
        return { xmlField: field, targetField: 'descripcion', required: true };
      }
      if (lowerField.includes('proveedor') || lowerField.includes('supplier') || lowerField.includes('vendor')) {
        return { xmlField: field, targetField: 'proveedor', required: false };
      }
      if (lowerField.includes('categoria') || lowerField.includes('category')) {
        return { xmlField: field, targetField: 'categoria', required: false };
      }
      
      return { xmlField: field, targetField: 'notas', required: false };
    });
  }

  private extractDataFromXML(doc: Document, structure: XMLStructure): XMLCostData[] {
    const items = doc.querySelectorAll(structure.itemElement);
    const data: XMLCostData[] = [];

    items.forEach((item, index) => {
      const costData: any = {};
      
      structure.fields.forEach(fieldMapping => {
        let element: Element | null = null;
        
        // Para DTEs, usar navegación jerárquica
        if (structure.rootElement === 'DTE') {
          element = this.getNestedElement(item, fieldMapping.xmlField);
        } else {
          // Para otras estructuras, usar búsqueda simple
          element = item.querySelector(fieldMapping.xmlField) || 
                   item.querySelector(fieldMapping.xmlField.toLowerCase());
        }
        
        if (element) {
          let value = this.cleanExtractedText(element.textContent);
          
          if (fieldMapping.transform) {
            try {
              value = fieldMapping.transform(value);
            } catch (error) {
              console.warn(`Error transformando campo ${fieldMapping.xmlField}:`, error);
            }
          }
          
          costData[fieldMapping.targetField] = value;
        }
      });
      
      // Para DTEs, agregar categorización automática y descripción mejorada
      if (structure.rootElement === 'DTE') {
        this.enhanceDTEData(costData, item);
      }
      
      // Validaciones básicas antes de agregar
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

  private enhanceDTEData(costData: any, documentElement: Element): void {
    // Si no hay descripción, usar el giro del emisor
    if (!costData.descripcion && costData.proveedor) {
      const giroEmis = this.getNestedElement(documentElement, 'Encabezado/Emisor/GiroEmis');
      if (giroEmis) {
        costData.descripcion = this.cleanExtractedText(giroEmis.textContent) || costData.proveedor;
      } else {
        costData.descripcion = costData.proveedor;
      }
    }

    // Categorización automática por proveedor
    if (costData.proveedor) {
      costData.categoria = this.categorizarPorProveedor(costData.proveedor);
    }

    // Agregar información adicional del DTE
    const tipoDTE = this.getNestedElement(documentElement, 'Encabezado/IdDoc/TipoDTE');
    if (tipoDTE) {
      const tipo = this.cleanExtractedText(tipoDTE.textContent);
      if (tipo === '33') costData.notas = 'Factura Electrónica';
      else if (tipo === '34') costData.notas = 'Factura Exenta';
      else if (tipo === '39') costData.notas = 'Boleta Electrónica';
    }
  }

  private categorizarPorProveedor(proveedor: string): string {
    const proveedorLower = proveedor.toLowerCase();
    
    if (proveedorLower.includes('seguro') || proveedorLower.includes('hdi')) {
      return 'Seguros';
    }
    if (proveedorLower.includes('combustible') || proveedorLower.includes('petro') || proveedorLower.includes('shell') || proveedorLower.includes('copec')) {
      return 'Combustible';
    }
    if (proveedorLower.includes('mantenimiento') || proveedorLower.includes('taller') || proveedorLower.includes('repuesto')) {
      return 'Mantenimiento';
    }
    if (proveedorLower.includes('peaje') || proveedorLower.includes('toll')) {
      return 'Peajes';
    }
    
    return 'Otros';
  }

  private validateData(data: XMLCostData[]): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    data.forEach((item, index) => {
      // Validar fecha
      if (!item.fecha) {
        errors.push(`Fila ${index + 1}: Fecha es requerida`);
      } else {
        const fecha = new Date(item.fecha);
        if (isNaN(fecha.getTime())) {
          errors.push(`Fila ${index + 1}: Fecha no válida`);
        }
      }

      // Validar monto
      if (!item.monto || item.monto <= 0) {
        errors.push(`Fila ${index + 1}: Monto debe ser mayor a 0`);
      }

      // Validar descripción
      if (!item.descripcion || item.descripcion.trim().length === 0) {
        errors.push(`Fila ${index + 1}: Descripción es requerida`);
      }

      // Advertencias
      if (!item.proveedor) {
        warnings.push(`Fila ${index + 1}: Proveedor no especificado`);
      }

      if (!item.categoria) {
        warnings.push(`Fila ${index + 1}: Categoría no especificada, se asignará por defecto`);
      }
    });

    return { errors, warnings };
  }

  private isValidItem(item: XMLCostData): boolean {
    return !!(
      item.fecha && 
      item.monto && 
      item.monto > 0 && 
      item.descripcion && 
      item.descripcion.trim().length > 0
    );
  }

  private stripNamespaces(xml: string): string {
    return xml.replace(/\sxmlns(:\w+)?="[^"]*"/g, '');
  }

  private cleanExtractedText(value?: string | null): string {
    return (value || '')
      .replace(/\uFFFD+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private sanitizeDecodedText(value: string): string {
    return value.split('\0').join('').replace(/\ufeff/g, '');
  }

  private countReplacementChars(value: string): number {
    return (value.match(/\uFFFD/g) || []).length;
  }

  private normalizeEncodingLabel(rawEncoding?: string | null): string {
    const normalized = rawEncoding?.trim().toLowerCase();
    if (!normalized) return 'utf-8';

    if (normalized === 'utf-8' || normalized === 'utf8') return 'utf-8';
    if (normalized === 'iso-8859-1' || normalized === 'iso8859-1' || normalized === 'latin1' || normalized === 'latin-1') {
      return 'windows-1252';
    }
    if (normalized === 'windows-1252' || normalized === 'cp1252') return 'windows-1252';

    return normalized;
  }

  private decodeBytes(bytes: Uint8Array, encoding: string): string {
    try {
      return this.sanitizeDecodedText(new TextDecoder(encoding).decode(bytes));
    } catch {
      return this.sanitizeDecodedText(new TextDecoder('utf-8').decode(bytes));
    }
  }

  private detectDeclaredEncoding(bytes: Uint8Array): string {
    const header = new TextDecoder('utf-8').decode(bytes.slice(0, 256));
    const match = header.match(/encoding=["']([^"']+)["']/i);
    return this.normalizeEncodingLabel(match?.[1]);
  }

  private selectBestDecodedText(bytes: Uint8Array, preferredEncoding: string): string {
    const candidateEncodings = Array.from(new Set([
      preferredEncoding,
      'utf-8',
      'windows-1252',
    ]));

    let bestText = '';
    let bestScore = Number.POSITIVE_INFINITY;
    let bestPriority = Number.POSITIVE_INFINITY;

    candidateEncodings.forEach((encoding, index) => {
      const decodedText = this.decodeBytes(bytes, encoding);
      const replacementCount = this.countReplacementChars(decodedText);
      if (
        replacementCount < bestScore ||
        (replacementCount === bestScore && index < bestPriority)
      ) {
        bestText = decodedText;
        bestScore = replacementCount;
        bestPriority = index;
      }
    });

    return bestText;
  }

  private async readFileAsText(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const declaredEncoding = this.detectDeclaredEncoding(bytes);
    return this.selectBestDecodedText(bytes, declaredEncoding);
  }
}
