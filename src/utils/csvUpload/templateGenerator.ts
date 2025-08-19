
import * as XLSX from 'xlsx';

export class TemplateGenerator {
  static downloadTemplate(): void {
    const headers = [
      'Folio',
      'Fecha Solicitud',
      'Fecha Servicio',
      'Cliente RUT',
      'Cliente Nombre',
      'Cliente Departamento',
      'Vehículo Marca',
      'Vehículo Modelo',
      'Patente',
      'Origen',
      'Destino',
      'Tipo Servicio',
      'Valor',
      'Grúa Patente',
      'Operador RUT',
      'Comisión Operador',
      'Observaciones'
    ];

    const csvContent = headers.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    a.download = `plantilla_servicios_${timestamp}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  static downloadExcelTemplate(): void {
    try {
      console.log('📊 Generating Excel template with valid sample data...');
      
      // Headers exactly matching the expected format
      const headers = [
        'Folio',
        'Fecha Solicitud', 
        'Fecha Servicio',
        'Cliente RUT',
        'Cliente Nombre',
        'Cliente Departamento',
        'Vehículo Marca',
        'Vehículo Modelo',
        'Patente',
        'Origen',
        'Destino',
        'Tipo Servicio',
        'Valor',
        'Grúa Patente',
        'Operador RUT',
        'Comisión Operador',
        'Observaciones'
      ];

      // Sample data rows as arrays matching header order exactly
      const sampleData = [
        ['SRV-001', '2024-01-15', '2024-01-16', '76123456-7', 'Transportes Santiago Ltda.', 'Administración', 'Mercedes-Benz', 'Actros', 'ABCD-12', 'Santiago Centro', 'Las Condes', 'Grúa Pesada', '150000', 'GR-001', '12345678-9', '15000', 'Servicio de ejemplo'],
        ['SRV-002', '2024-01-17', '2024-01-18', '96987654-3', 'Empresa Logística Norte S.A.', 'Operaciones', 'Volvo', 'FH', 'MNOP-34', 'Valparaíso', 'Santiago', 'Grúa Mediana', '85000', 'GR-002', '98765432-1', '8500', 'Requiere cuidado especial'],
        ['SRV-003', '2024-01-20', '2024-01-21', '77555666-4', 'Constructora del Sur SpA', 'Ventas', 'Scania', 'R-Series', 'QRST-56', 'Concepción', 'Temuco', 'Grúa Liviana', '65000', 'GR-003', '11223344-5', '6500', 'Cliente preferencial']
      ];

      // Create workbook and worksheet  
      const wb = XLSX.utils.book_new();
      
      // Create worksheet with headers and data
      const wsData = [headers, ...sampleData];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths for better readability
      const columnWidths = [
        { wch: 12 }, // Folio
        { wch: 15 }, // Fecha Solicitud
        { wch: 15 }, // Fecha Servicio
        { wch: 12 }, // Cliente RUT
        { wch: 30 }, // Cliente Nombre
        { wch: 18 }, // Cliente Departamento
        { wch: 15 }, // Vehículo Marca
        { wch: 15 }, // Vehículo Modelo
        { wch: 10 }, // Patente
        { wch: 20 }, // Origen
        { wch: 20 }, // Destino
        { wch: 15 }, // Tipo Servicio
        { wch: 12 }, // Valor
        { wch: 12 }, // Grúa Patente
        { wch: 12 }, // Operador RUT
        { wch: 15 }, // Comisión Operador
        { wch: 35 }  // Observaciones
      ];

      ws['!cols'] = columnWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Servicios');

      // Generate and download file
      console.log('💾 Downloading Excel template...');
      const timestamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `plantilla_servicios_${timestamp}.xlsx`);
      console.log('✅ Excel template downloaded successfully');

    } catch (error) {
      console.error('❌ Error generating Excel template:', error);
      
      // Fallback to CSV template if Excel generation fails
      alert('Error generando plantilla Excel. Descargando plantilla CSV como alternativa.');
      this.downloadTemplate();
    }
  }
}
