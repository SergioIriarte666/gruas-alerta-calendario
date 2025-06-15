
import { EquipmentCategory } from '@/types/equipment';

export const vehicleEquipment: EquipmentCategory[] = [
  {
    id: 'documentation',
    name: 'Documentación del Vehículo',
    items: [
      { id: 'permiso_circulacion', name: 'Permiso de circulación' },
      { id: 'seguro_obligatorio', name: 'Seguro obligatorio' },
      { id: 'revision_tecnica', name: 'Revisión técnica' },
    ],
  },
  {
    id: 'security_kit',
    name: 'Kit de Seguridad',
    items: [
      { id: 'extintor', name: 'Extintor de incendios' },
      { id: 'botiquin', name: 'Botiquín de primeros auxilios' },
      { id: 'triangulos', name: 'Triángulos de emergencia' },
      { id: 'chaleco_reflectante', name: 'Chaleco reflectante' },
    ],
  },
  {
    id: 'crane_equipment',
    name: 'Equipo de Grúa',
    items: [
        { id: 'winche', name: 'Winche y cable' },
        { id: 'eslingas', name: 'Eslingas y cadenas' },
        { id: 'ganchos', name: 'Ganchos' },
        { id: 'bloques_poleas', name: 'Bloques y poleas' },
        { id: 'control_remoto', name: 'Control remoto de grúa' },
    ],
  },
  {
    id: 'general_condition',
    name: 'Estado General del Vehículo',
    items: [
        { id: 'neumaticos', name: 'Neumáticos (presión y desgaste)' },
        { id: 'luces', name: 'Luces (delanteras, traseras, intermitentes)' },
        { id: 'frenos', name: 'Frenos' },
        { id: 'niveles_fluidos', name: 'Niveles de fluidos (aceite, refrigerante)' },
        { id: 'carroceria', name: 'Carrocería (sin daños mayores)' },
    ],
  },
];
