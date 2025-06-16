
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
    id: 'safety',
    name: 'Equipos de Seguridad',
    items: [
      { id: 'safety-cone', name: 'Conos de seguridad' },
      { id: 'warning-triangle', name: 'Triángulos de emergencia' },
      { id: 'reflective-vest', name: 'Chaleco reflectante' },
      { id: 'first-aid-kit', name: 'Botiquín de primeros auxilios' },
      { id: 'fire-extinguisher', name: 'Extintor' },
      { id: 'safety-lights', name: 'Luces de emergencia' }
    ]
  },
  {
    id: 'tools',
    name: 'Herramientas',
    items: [
      { id: 'wrench-set', name: 'Juego de llaves' },
      { id: 'screwdriver-set', name: 'Destornilladores' },
      { id: 'tire-iron', name: 'Llave de ruedas' },
      { id: 'jack', name: 'Gata hidráulica' },
      { id: 'cable-cutter', name: 'Cortador de cables' },
      { id: 'hammer', name: 'Martillo' }
    ]
  },
  {
    id: 'lifting',
    name: 'Equipo de Elevación',
    items: [
      { id: 'chains', name: 'Cadenas de elevación' },
      { id: 'straps', name: 'Correas de amarre' },
      { id: 'hooks', name: 'Ganchos de seguridad' },
      { id: 'shackles', name: 'Grilletes' },
      { id: 'slings', name: 'Eslingas' },
      { id: 'blocks', name: 'Bloques de madera' }
    ]
  },
  {
    id: 'communication',
    name: 'Comunicación',
    items: [
      { id: 'radio', name: 'Radio comunicador' },
      { id: 'phone', name: 'Teléfono móvil' },
      { id: 'whistle', name: 'Silbato de emergencia' }
    ]
  },
  {
    id: 'documentation',
    name: 'Documentación',
    items: [
      { id: 'license', name: 'Licencia de conducir' },
      { id: 'vehicle-registration', name: 'Permiso de circulación' },
      { id: 'insurance', name: 'Seguro vigente' },
      { id: 'inspection-forms', name: 'Formularios de inspección' }
    ]
  }
];
