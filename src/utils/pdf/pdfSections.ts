
import jsPDF from 'jspdf';
import { InspectionPDFData } from './pdfTypes';
import { addServiceInfo } from './sections/serviceInfo';
import { addEquipmentChecklist } from './sections/equipmentChecklist';
import { addObservationsAndSignatures } from './sections/observations';

// Re-export the functions for backward compatibility
export { addServiceInfo, addEquipmentChecklist, addObservationsAndSignatures };
