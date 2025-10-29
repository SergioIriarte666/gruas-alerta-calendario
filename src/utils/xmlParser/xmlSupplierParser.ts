import { XMLSupplierData, XMLSupplierParseResult, XMLCompleteParseResult, XMLDocumentData, XMLSupplierPaymentData, SupplierPaymentStatus, XMLDocumentItem } from '@/types/suppliers';

export class XMLSupplierParser {
  private parser: DOMParser;

  constructor() {
    this.parser = new DOMParser();
  }

  public async parseXMLFile(file: File): Promise<XMLSupplierParseResult> {
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

  public async parseXMLCompleteFile(file: File): Promise<XMLCompleteParseResult> {
    try {
      const text = await this.readFileAsText(file);
      return this.parseXMLCompleteString(text);
    } catch (error) {
      return {
        success: false,
        suppliers: [],
        documents: [],
        errors: [`Error leyendo archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`],
        warnings: [],
        totalSuppliers: 0,
        validSuppliers: 0,
        totalDocuments: 0,
        validDocuments: 0
      };
    }
  }

  public parseXMLCompleteString(xmlString: string): XMLCompleteParseResult {
    try {
      const doc = this.parser.parseFromString(xmlString, 'text/xml');
      
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        return {
          success: false,
          suppliers: [],
          documents: [],
          errors: ['El archivo XML no es válido'],
          warnings: [],
          totalSuppliers: 0,
          validSuppliers: 0,
          totalDocuments: 0,
          validDocuments: 0
        };
      }

      const suppliers = this.extractSuppliersFromXML(doc);
      const documents = this.extractDocumentsFromXML(doc);
      
      const supplierValidation = this.validateData(suppliers);
      const documentValidation = this.validateDocuments(documents);

      const allErrors = [...supplierValidation.errors, ...documentValidation.errors];
      const allWarnings = [...supplierValidation.warnings, ...documentValidation.warnings];

      return {
        success: allErrors.length === 0,
        suppliers: suppliers,
        documents: documents,
        errors: allErrors,
        warnings: allWarnings,
        totalSuppliers: suppliers.length,
        validSuppliers: suppliers.filter(item => this.isValidSupplier(item)).length,
        totalDocuments: documents.length,
        validDocuments: documents.filter(doc => this.isValidDocument(doc)).length
      };
    } catch (error) {
      return {
        success: false,
        suppliers: [],
        documents: [],
        errors: [`Error procesando XML: ${error instanceof Error ? error.message : 'Error desconocido'}`],
        warnings: [],
        totalSuppliers: 0,
        validSuppliers: 0,
        totalDocuments: 0,
        validDocuments: 0
      };
    }
  }

  public parseXMLString(xmlString: string): XMLSupplierParseResult {
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

      const data = this.extractSuppliersFromXML(doc);
      const validation = this.validateData(data);

      return {
        success: validation.errors.length === 0,
        data: data,
        errors: validation.errors,
        warnings: validation.warnings,
        totalRows: data.length,
        validRows: data.filter(item => this.isValidSupplier(item)).length
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

  private extractSuppliersFromXML(doc: Document): XMLSupplierData[] {
    const suppliers: XMLSupplierData[] = [];
    const uniqueSuppliers = new Map<string, XMLSupplierData>();

    // Detectar estructura DTE (facturas electrónicas chilenas)
    const dteElements = doc.querySelectorAll('DTE');
    if (dteElements.length > 0) {
      dteElements.forEach(dte => {
        const supplier = this.extractSupplierFromDTE(dte);
        if (supplier && supplier.rut) {
          uniqueSuppliers.set(supplier.rut, supplier);
        }
      });
    }

    // Detectar estructura genérica de proveedores
    const proveedoresElements = doc.querySelectorAll('proveedor, supplier, vendor');
    if (proveedoresElements.length > 0) {
      proveedoresElements.forEach(element => {
        const supplier = this.extractSupplierFromGeneric(element);
        if (supplier && supplier.rut) {
          uniqueSuppliers.set(supplier.rut, supplier);
        }
      });
    }

    // Detectar desde facturas genéricas
    const facturaElements = doc.querySelectorAll('factura, invoice');
    if (facturaElements.length > 0) {
      facturaElements.forEach(factura => {
        const supplier = this.extractSupplierFromInvoice(factura);
        if (supplier && supplier.rut) {
          uniqueSuppliers.set(supplier.rut, supplier);
        }
      });
    }

    return Array.from(uniqueSuppliers.values());
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

  private extractSupplierFromGeneric(element: Element): XMLSupplierData | null {
    const getValue = (selector: string): string => {
      return element.querySelector(selector)?.textContent?.trim() || '';
    };

    const name = getValue('nombre, name, razon_social');
    const rut = getValue('rut, tax_id, id');
    const email = getValue('email, correo');
    const phone = getValue('telefono, phone, tel');
    const address = getValue('direccion, address');
    const contactName = getValue('contacto, contact_name, contact');
    const giro = getValue('giro, business_type, categoria');

    if (!name || !rut) return null;

    return {
      name: name,
      rut: this.formatRUT(rut),
      email: email,
      phone: phone,
      address: address,
      contact_name: contactName,
      category: this.categorizeByBusiness(giro || name),
      notes: giro ? `Giro: ${giro}` : '',
      is_active: true
    };
  }

  private extractSupplierFromInvoice(facturaElement: Element): XMLSupplierData | null {
    const getValue = (selector: string): string => {
      return facturaElement.querySelector(selector)?.textContent?.trim() || '';
    };

    const name = getValue('proveedor, emisor, supplier_name, vendor_name');
    const rut = getValue('rut_proveedor, supplier_rut, tax_id');
    const email = getValue('email_proveedor, supplier_email');
    const phone = getValue('telefono_proveedor, supplier_phone');
    const address = getValue('direccion_proveedor, supplier_address');

    if (!name) return null;

    return {
      name: name,
      rut: rut ? this.formatRUT(rut) : '',
      email: email,
      phone: phone,
      address: address,
      contact_name: '',
      category: this.categorizeByBusiness(name),
      notes: 'Extraído de factura XML',
      is_active: true
    };
  }

  private categorizeByBusiness(businessDescription: string): string {
    const description = businessDescription.toLowerCase();
    
    if (description.includes('combustible') || description.includes('petróleo') || 
        description.includes('gasolina') || description.includes('diesel') ||
        description.includes('copec') || description.includes('shell') || 
        description.includes('esso') || description.includes('terpel')) {
      return 'combustible';
    }
    
    if (description.includes('mantención') || description.includes('mantenimiento') ||
        description.includes('taller') || description.includes('mecánico') ||
        description.includes('repuesto') || description.includes('reparación')) {
      return 'mantenimiento';
    }
    
    if (description.includes('seguro') || description.includes('póliza') ||
        description.includes('cobertura') || description.includes('hdi') ||
        description.includes('liberty') || description.includes('mapfre')) {
      return 'seguros';
    }
    
    if (description.includes('peaje') || description.includes('autopista') ||
        description.includes('carretera') || description.includes('toll') ||
        description.includes('ruta del') || description.includes('túnel')) {
      return 'peajes';
    }
    
    if (description.includes('salario') || description.includes('sueldo') ||
        description.includes('remuneración') || description.includes('honorario') ||
        description.includes('personal') || description.includes('trabajador')) {
      return 'salarios';
    }
    
    if (description.includes('administrat') || description.includes('oficina') ||
        description.includes('contabilidad') || description.includes('asesor') ||
        description.includes('consultor') || description.includes('notaría')) {
      return 'administrativos';
    }
    
    if (description.includes('impuesto') || description.includes('sii') ||
        description.includes('patente') || description.includes('contribución') ||
        description.includes('municipal') || description.includes('fiscal')) {
      return 'impuestos';
    }
    
    if (description.includes('comisión') || description.includes('operador') ||
        description.includes('grúa') || description.includes('conductor')) {
      return 'comision_operador';
    }
    
    return 'otros';
  }

  private formatRUT(rut: string): string {
    // Limpiar RUT y formatear
    const cleaned = rut.replace(/[^\dkK]/g, '');
    if (cleaned.length < 8) return rut;
    
    const body = cleaned.slice(0, -1);
    const dv = cleaned.slice(-1).toUpperCase();
    
    // Formatear con puntos y guión
    const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
    return formatted;
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

  private validateData(data: XMLSupplierData[]): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    data.forEach((supplier, index) => {
      // Validar nombre
      if (!supplier.name || supplier.name.trim().length === 0) {
        errors.push(`Proveedor ${index + 1}: Nombre es requerido`);
      }

      // Validar RUT si está presente
      if (supplier.rut && !this.validateRUT(supplier.rut)) {
        warnings.push(`Proveedor ${index + 1}: RUT "${supplier.rut}" no es válido`);
      }

      if (!supplier.rut) {
        warnings.push(`Proveedor ${index + 1}: RUT no especificado`);
      }

      // Validar email si está presente
      if (supplier.email && !this.isValidEmail(supplier.email)) {
        warnings.push(`Proveedor ${index + 1}: Email "${supplier.email}" no es válido`);
      }

      // Advertencias
      if (!supplier.phone) {
        warnings.push(`Proveedor ${index + 1}: Teléfono no especificado`);
      }

      if (!supplier.address) {
        warnings.push(`Proveedor ${index + 1}: Dirección no especificada`);
      }
    });

    return { errors, warnings };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidSupplier(supplier: XMLSupplierData): boolean {
    return !!(supplier.name && supplier.name.trim().length > 0);
  }

  private extractDocumentsFromXML(doc: Document): XMLDocumentData[] {
    const documents: XMLDocumentData[] = [];

    // Detectar estructura DTE (facturas electrónicas chilenas)
    const dteElements = doc.querySelectorAll('DTE');
    if (dteElements.length > 0) {
      dteElements.forEach(dte => {
        const document = this.extractDocumentFromDTE(dte);
        if (document) {
          documents.push(document);
        }
      });
    }

    // Detectar desde facturas genéricas
    const facturaElements = doc.querySelectorAll('factura, invoice');
    if (facturaElements.length > 0) {
      facturaElements.forEach(factura => {
        const document = this.extractDocumentFromGenericInvoice(factura);
        if (document) {
          documents.push(document);
        }
      });
    }

    return documents;
  }

  private extractDocumentFromDTE(dteElement: Element): XMLDocumentData | null {
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

    const getNestedNumber = (path: string): number => {
      const value = getNestedValue(path);
      return value ? parseFloat(value.replace(/[^\d.-]/g, '')) || 0 : 0;
    };

    // Extraer información del documento
    const folio = getNestedValue('Documento/Encabezado/IdDoc/Folio');
    const tipoDTE = getNestedValue('Documento/Encabezado/IdDoc/TipoDTE');
    const fechaEmision = getNestedValue('Documento/Encabezado/IdDoc/FchEmis');
    const fechaVencimiento = getNestedValue('Documento/Encabezado/IdDoc/FchVenc');
    
    // Extraer totales
    const montoNeto = getNestedNumber('Documento/Encabezado/Totales/MntNeto');
    const iva = getNestedNumber('Documento/Encabezado/Totales/IVA');
    const montoTotal = getNestedNumber('Documento/Encabezado/Totales/MntTotal');
    
    // Extraer información del emisor
    const rutEmisor = getNestedValue('Documento/Encabezado/Emisor/RUTEmisor');
    const razonSocial = getNestedValue('Documento/Encabezado/Emisor/RznSoc');
    
    // Extraer detalles si existen
    const items: XMLDocumentItem[] = [];
    
    // Navegar paso a paso para encontrar elementos Detalle
    const documentoElement = dteElement.querySelector('Documento');
    if (documentoElement) {
      const detalleElements = documentoElement.querySelectorAll('Detalle');
      detalleElements.forEach(detalle => {
        const descripcion = detalle.querySelector('NmbItem')?.textContent?.trim() || '';
        const cantidad = parseFloat(detalle.querySelector('QtyItem')?.textContent || '1');
        const precio = parseFloat(detalle.querySelector('PrcItem')?.textContent || '0');
        const total = parseFloat(detalle.querySelector('MontoItem')?.textContent || '0');
        
        if (descripcion) {
          items.push({
            description: descripcion,
            quantity: cantidad,
            unit_price: precio,
            total: total,
            tax_rate: 19 // IVA estándar en Chile
          });
        }
      });
    }

    if (!folio || !rutEmisor) return null;

    return {
      folio: folio,
      document_type: this.getDocumentTypeLabel(tipoDTE),
      issue_date: this.formatDate(fechaEmision),
      due_date: fechaVencimiento ? this.formatDate(fechaVencimiento) : undefined,
      net_amount: montoNeto,
      vat_amount: iva,
      total_amount: montoTotal,
      currency: 'CLP',
      description: `${this.getDocumentTypeLabel(tipoDTE)} N° ${folio} - ${razonSocial}`,
      supplier_rut: this.formatRUT(rutEmisor),
      status: 'emitido',
      items: items.length > 0 ? items : undefined
    };
  }

  private extractDocumentFromGenericInvoice(facturaElement: Element): XMLDocumentData | null {
    const getValue = (selector: string): string => {
      return facturaElement.querySelector(selector)?.textContent?.trim() || '';
    };

    const getNumber = (selector: string): number => {
      const value = getValue(selector);
      return value ? parseFloat(value.replace(/[^\d.-]/g, '')) || 0 : 0;
    };

    const folio = getValue('folio, numero, number, invoice_number');
    const fecha = getValue('fecha, date, issue_date');
    const fechaVencimiento = getValue('fecha_vencimiento, due_date, vencimiento');
    const total = getNumber('total, amount, monto_total');
    const neto = getNumber('neto, net_amount, subtotal');
    const iva = getNumber('iva, tax, impuesto');
    const rutProveedor = getValue('rut_proveedor, supplier_rut, tax_id');
    const nombreProveedor = getValue('proveedor, supplier_name, vendor_name, razon_social');
    const descripcion = getValue('descripcion, description, concepto');

    if (!folio && !total) return null;

    return {
      folio: folio || `DOC-${Date.now()}`,
      document_type: 'Factura',
      issue_date: this.formatDate(fecha) || this.formatDate(new Date().toISOString()),
      due_date: fechaVencimiento ? this.formatDate(fechaVencimiento) : undefined,
      net_amount: neto || (total * 0.84), // Si no hay neto, calcularlo aproximado
      vat_amount: iva || (total * 0.19), // Si no hay IVA, calcularlo aproximado
      total_amount: total,
      currency: 'CLP',
      description: descripcion || `Factura ${folio} - ${nombreProveedor}`,
      supplier_rut: rutProveedor ? this.formatRUT(rutProveedor) : '',
      status: 'emitido'
    };
  }

  private getDocumentTypeLabel(tipoDTE: string): string {
    const tipos: Record<string, string> = {
      '33': 'Factura Electrónica',
      '34': 'Factura No Gravada',
      '39': 'Boleta Electrónica',
      '41': 'Boleta Exenta',
      '43': 'Liquidación Factura',
      '46': 'Factura de Compra',
      '52': 'Guía de Despacho',
      '56': 'Nota de Débito',
      '61': 'Nota de Crédito'
    };
    return tipos[tipoDTE] || `Documento Tipo ${tipoDTE}` || 'Factura';
  }

  private formatDate(dateString: string): string {
    if (!dateString) return '';
    
    // Intentar parsear diferentes formatos de fecha
    let date: Date;
    
    if (dateString.includes('-')) {
      date = new Date(dateString);
    } else if (dateString.length === 8) {
      // Formato YYYYMMDD
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      date = new Date(`${year}-${month}-${day}`);
    } else {
      date = new Date(dateString);
    }
    
    if (isNaN(date.getTime())) {
      return dateString; // Retornar el original si no se puede parsear
    }
    
    return date.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  }

  private validateDocuments(documents: XMLDocumentData[]): { errors: string[], warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    documents.forEach((doc, index) => {
      // Validar folio
      if (!doc.folio || doc.folio.trim().length === 0) {
        errors.push(`Documento ${index + 1}: Folio es requerido`);
      }

      // Validar montos
      if (doc.total_amount <= 0) {
        errors.push(`Documento ${index + 1}: Monto total debe ser mayor a 0`);
      }

      // Validar fecha de emisión
      if (!doc.issue_date) {
        warnings.push(`Documento ${index + 1}: Fecha de emisión no especificada`);
      }

      // Validar RUT del proveedor
      if (doc.supplier_rut && !this.validateRUT(doc.supplier_rut)) {
        warnings.push(`Documento ${index + 1}: RUT del proveedor "${doc.supplier_rut}" no es válido`);
      }

      if (!doc.supplier_rut) {
        warnings.push(`Documento ${index + 1}: RUT del proveedor no especificado`);
      }

      // Advertencia si no hay fecha de vencimiento
      if (!doc.due_date) {
        warnings.push(`Documento ${index + 1}: Fecha de vencimiento no especificada`);
      }
    });

    return { errors, warnings };
  }

  private isValidDocument(document: XMLDocumentData): boolean {
    return !!(document.folio && document.folio.trim().length > 0 && document.total_amount > 0);
  }

  public convertDocumentsToPayments(
    documents: XMLDocumentData[], 
    suppliers: XMLSupplierData[],
    dueDateOverrides?: Record<string, string>
  ): XMLSupplierPaymentData[] {
    const payments: XMLSupplierPaymentData[] = [];
    const supplierMap = new Map<string, XMLSupplierData>();
    
    // Crear mapa de proveedores por RUT
    suppliers.forEach(supplier => {
      if (supplier.rut) {
        supplierMap.set(supplier.rut, supplier);
      }
    });

    documents.forEach(doc => {
      if (!doc.supplier_rut || !this.isValidDocument(doc)) return;

      const supplier = supplierMap.get(doc.supplier_rut);
      const category = supplier ? supplier.category : this.categorizeByBusiness(doc.description);

      // Priorizar fecha personalizada, luego fecha del documento, luego calcular por defecto
      const dueDate = (dueDateOverrides && dueDateOverrides[doc.folio]) || 
                      doc.due_date || 
                      this.calculateDefaultDueDate(doc.issue_date);

      payments.push({
        supplier_rut: doc.supplier_rut,
        amount: doc.total_amount,
        due_date: dueDate,
        description: doc.description,
        category: category,
        reference_number: doc.folio,
        notes: `Generado automáticamente desde ${doc.document_type}. Monto neto: $${doc.net_amount.toLocaleString()}, IVA: $${doc.vat_amount.toLocaleString()}`,
        status: 'pending' as SupplierPaymentStatus,
        document_data: doc
      });
    });

    return payments;
  }

  private calculateDefaultDueDate(issueDate: string): string {
    if (!issueDate) {
      // Si no hay fecha de emisión, usar fecha actual + 30 días
      const today = new Date();
      today.setDate(today.getDate() + 30);
      return today.toISOString().split('T')[0];
    }

    const date = new Date(issueDate);
    date.setDate(date.getDate() + 30); // 30 días por defecto
    return date.toISOString().split('T')[0];
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Error leyendo archivo'));
      reader.readAsText(file, 'utf-8');
    });
  }
}