import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format as formatDate } from 'date-fns';
import { es } from 'date-fns/locale';
import { createExportFileName, addCompanyHeader } from './reportUtils';
import { Settings } from '@/types/settings';
import { InventoryMovement } from '@/hooks/useInventory';

export interface InventoryMovementFilters {
  dateRange: {
    from: string;
    to: string;
  };
  movementType: string;
  location: string;
  searchTerm: string;
}

export interface ExportInventoryMovementArgs {
  format: 'pdf' | 'excel' | 'csv';
  movements: InventoryMovement[];
  settings: Settings;
  appliedFilters: InventoryMovementFilters;
  filterLabels: string[][];
}

export const exportInventoryMovementReport = async ({ 
  format, 
  movements, 
  settings, 
  appliedFilters, 
  filterLabels 
}: ExportInventoryMovementArgs) => {
  const { company } = settings;
  const exportFileDefaultName = createExportFileName(
    'movimientos-inventario', 
    appliedFilters.dateRange.from, 
    appliedFilters.dateRange.to
  );

  if (format === 'pdf') {
    const doc = new jsPDF();
    let startY = await addCompanyHeader(doc, company, 15);

    // Title
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Reporte de Movimientos de Inventario', 14, startY);
    startY += 10;

    // Filters
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0);
    doc.text('Filtros Aplicados:', 14, startY);
    autoTable(doc, { 
      body: filterLabels, 
      startY: startY + 4, 
      theme: 'plain', 
      styles: { fontSize: 9 } 
    });

    let lastY = (doc as any).lastAutoTable.finalY + 10;

    // Summary Statistics
    const entryMovements = movements.filter(m => m.movement_type === 'entry');
    const exitMovements = movements.filter(m => m.movement_type === 'exit');
    const transferMovements = movements.filter(m => m.movement_type === 'transfer');
    const adjustmentMovements = movements.filter(m => m.movement_type === 'adjustment');

    const totalEntries = entryMovements.reduce((sum, m) => sum + m.quantity, 0);
    const totalExits = exitMovements.reduce((sum, m) => sum + m.quantity, 0);
    const totalCost = movements.reduce((sum, m) => sum + (m.total_cost || 0), 0);

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('Resumen de Movimientos:', 14, lastY);
    autoTable(doc, {
      body: [
        ['Total de Movimientos', movements.length.toString()],
        ['Entradas', `${entryMovements.length} movimientos (${totalEntries.toLocaleString()} unidades)`],
        ['Salidas', `${exitMovements.length} movimientos (${totalExits.toLocaleString()} unidades)`],
        ['Transferencias', transferMovements.length.toString()],
        ['Ajustes', adjustmentMovements.length.toString()],
        ['Saldo Neto', `${(totalEntries - totalExits).toLocaleString()} unidades`],
        ['Costo Total', `$${totalCost.toLocaleString()}`],
      ],
      startY: lastY + 4,
      theme: 'grid',
      styles: { fontSize: 10 }
    });
    lastY = (doc as any).lastAutoTable.finalY + 15;

    // Movements Table
    if (movements.length > 0) {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('Detalle de Movimientos:', 14, lastY);
      
      const tableData = movements.map(movement => [
        formatDate(new Date(movement.movement_date), 'dd/MM/yyyy HH:mm'),
        movement.movement_type === 'entry' ? 'Entrada' : 
        movement.movement_type === 'exit' ? 'Salida' :
        movement.movement_type === 'transfer' ? 'Transferencia' : 'Ajuste',
        movement.item?.name || '',
        movement.location?.name || '',
        movement.quantity.toLocaleString(),
        movement.total_cost ? `$${movement.total_cost.toLocaleString()}` : '-',
        movement.reference_document || '',
        movement.reason || ''
      ]);

      autoTable(doc, {
        head: [['Fecha', 'Tipo', 'Producto', 'Ubicación', 'Cantidad', 'Costo', 'Documento', 'Motivo']],
        body: tableData,
        startY: lastY + 4,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] }, // blue-500
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 20 },
          2: { cellWidth: 30 },
          3: { cellWidth: 25 },
          4: { cellWidth: 20 },
          5: { cellWidth: 20 },
          6: { cellWidth: 25 },
          7: { cellWidth: 30 }
        }
      });
    }
    
    // Implementación más robusta para descarga de PDF
    console.log('Generating PDF with filename:', `${exportFileDefaultName}.pdf`);
    
    try {
      // Método 1: Usar el método estándar de jsPDF
      doc.save(`${exportFileDefaultName}.pdf`);
      console.log('PDF saved successfully using doc.save()');
    } catch (error) {
      console.error('doc.save() failed, trying alternative method:', error);
      
      try {
        // Método 2: Descarga manual usando blob
        const pdfOutput = doc.output('blob');
        console.log('PDF blob created, size:', pdfOutput.size);
        
        const url = URL.createObjectURL(pdfOutput);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${exportFileDefaultName}.pdf`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        // Asegurar que el link esté en el DOM antes del click
        document.body.appendChild(link);
        
        // Simular click del usuario
        link.click();
        
        // Limpiar después de un delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
        console.log('PDF download initiated using blob method');
      } catch (blobError) {
        console.error('Blob method also failed:', blobError);
        throw new Error('No se pudo descargar el PDF. Inténtalo con otro navegador.');
      }
    }

  } else if (format === 'excel') {
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      [company.name],
      [`RUT: ${company.taxId}`],
      [company.address],
      [`Tel: ${company.phone} | Email: ${company.email}`],
      [],
      ['Reporte de Movimientos de Inventario'],
      [],
      ['Filtros Aplicados'],
      ...filterLabels,
      [],
      ['Resumen de Movimientos'],
      ['Métrica', 'Valor'],
      ['Total de Movimientos', movements.length],
      ['Entradas', movements.filter(m => m.movement_type === 'entry').length],
      ['Salidas', movements.filter(m => m.movement_type === 'exit').length],
      ['Transferencias', movements.filter(m => m.movement_type === 'transfer').length],
      ['Ajustes', movements.filter(m => m.movement_type === 'adjustment').length],
      ['Costo Total', movements.reduce((sum, m) => sum + (m.total_cost || 0), 0)],
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

    // Movements Detail Sheet
    if (movements.length > 0) {
      const movementsData = movements.map(movement => ({
        'Fecha': formatDate(new Date(movement.movement_date), 'dd/MM/yyyy HH:mm'),
        'Tipo': movement.movement_type === 'entry' ? 'Entrada' : 
               movement.movement_type === 'exit' ? 'Salida' :
               movement.movement_type === 'transfer' ? 'Transferencia' : 'Ajuste',
        'Producto': movement.item?.name || '',
        'SKU': movement.item?.sku || '',
        'Ubicación': movement.location?.name || '',
        'Código Ubicación': movement.location?.code || '',
        'Cantidad': movement.quantity,
        'Unidad de Medida': movement.item?.unit_of_measure || '',
        'Costo Unitario': movement.unit_cost || 0,
        'Costo Total': movement.total_cost || 0,
        'Lote': movement.batch_number || '',
        'Fecha Vencimiento': movement.expiration_date || '',
        'Documento': movement.reference_document || '',
        'Motivo': movement.reason || '',
        'Observaciones': movement.observations || '',
        'Proveedor': movement.supplier_name || '',
        'Estado': movement.status || ''
      }));
      
      const movementsWs = XLSX.utils.json_to_sheet(movementsData);
      XLSX.utils.book_append_sheet(wb, movementsWs, 'Detalle Movimientos');
    }

    // Movement Types Summary
    const movementTypesSummary = [
      { 'Tipo': 'Entradas', 'Cantidad': movements.filter(m => m.movement_type === 'entry').length },
      { 'Tipo': 'Salidas', 'Cantidad': movements.filter(m => m.movement_type === 'exit').length },
      { 'Tipo': 'Transferencias', 'Cantidad': movements.filter(m => m.movement_type === 'transfer').length },
      { 'Tipo': 'Ajustes', 'Cantidad': movements.filter(m => m.movement_type === 'adjustment').length }
    ];
    
    const typesWs = XLSX.utils.json_to_sheet(movementTypesSummary);
    XLSX.utils.book_append_sheet(wb, typesWs, 'Por Tipo');

    // Implementación más robusta para descarga de Excel
    console.log('Generating Excel with filename:', `${exportFileDefaultName}.xlsx`);
    
    try {
      // Método 1: Usar XLSX.writeFile estándar
      XLSX.writeFile(wb, `${exportFileDefaultName}.xlsx`);
      console.log('Excel saved successfully using XLSX.writeFile()');
    } catch (error) {
      console.error('XLSX.writeFile() failed, trying alternative method:', error);
      
      try {
        // Método 2: Descarga manual usando blob
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        console.log('Excel blob created, size:', blob.size);
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${exportFileDefaultName}.xlsx`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        
        // Asegurar que el link esté en el DOM antes del click
        document.body.appendChild(link);
        
        // Simular click del usuario
        link.click();
        
        // Limpiar después de un delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);
        
        console.log('Excel download initiated using blob method');
      } catch (blobError) {
        console.error('Blob method also failed:', blobError);
        throw new Error('No se pudo descargar el Excel. Inténtalo con otro navegador.');
      }
    }

  } else if (format === 'csv') {
    // Implementación más robusta para descarga de CSV
    console.log('Generating CSV with filename:', `${exportFileDefaultName}.csv`);
    
    const headers = ['Fecha', 'Tipo', 'Producto', 'Ubicación', 'Cantidad', 'Costo Total', 'Documento', 'Motivo'];
    const csvData = [
      headers.join(','),
      ...movements.map(movement => [
        formatDate(new Date(movement.movement_date), 'dd/MM/yyyy HH:mm'),
        movement.movement_type === 'entry' ? 'Entrada' : 
        movement.movement_type === 'exit' ? 'Salida' :
        movement.movement_type === 'transfer' ? 'Transferencia' : 'Ajuste',
        `"${movement.item?.name || ''}"`,
        `"${movement.location?.name || ''}"`,
        movement.quantity,
        movement.total_cost || 0,
        `"${movement.reference_document || ''}"`,
        `"${movement.reason || ''}"`
      ].join(','))
    ].join('\n');

    try {
      // Crear blob con BOM para mejor compatibilidad con Excel
      const csvContent = '\uFEFF' + csvData;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      console.log('CSV blob created, size:', blob.size);
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportFileDefaultName}.csv`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Asegurar que el link esté en el DOM antes del click
      document.body.appendChild(link);
      
      // Simular click del usuario con un pequeño delay
      setTimeout(() => {
        link.click();
        console.log('CSV download initiated');
        
        // Limpiar después de un delay
        setTimeout(() => {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
          URL.revokeObjectURL(url);
        }, 100);
      }, 10);
      
    } catch (error) {
      console.error('Error saving CSV:', error);
      throw new Error('No se pudo descargar el CSV. Inténtalo con otro navegador.');
    }
  }
};