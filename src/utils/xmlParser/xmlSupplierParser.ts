import { XMLSupplierData, XMLSupplierParseResult, SupplierCategory } from '@/types/suppliers';

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

  private categorizeByBusiness(businessDescription: string): SupplierCategory {
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

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(new Error('Error leyendo archivo'));
      reader.readAsText(file, 'utf-8');
    });
  }
}