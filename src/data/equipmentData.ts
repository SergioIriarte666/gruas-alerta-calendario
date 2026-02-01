
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
    id: 'vehicle-inspection',
    name: 'Inspección del Vehículo',
    items: [
      { id: 'antena', name: 'Antena' },
      { id: 'baliza', name: 'Baliza' },
      { id: 'bateria', name: 'Batería' },
      { id: 'botiquin', name: 'Botiquín' },
      { id: 'caja-invierno', name: 'Caja Invierno' },
      { id: 'cenicero', name: 'Cenicero' },
      { id: 'chaleco-reflectante', name: 'Chaleco Reflectante' },
      { id: 'cint-seguridad', name: 'Cint. Seguridad' },
      { id: 'consola', name: 'Consola' },
      { id: 'cunas', name: 'Cuñas' },
      { id: 'emblemas', name: 'Emblemas' },
      { id: 'encendedor', name: 'Encendedor' },
      { id: 'espejo-exterior', name: 'Espejo Exterior' },
      { id: 'espejo-interno', name: 'Espejo Interno' },
      { id: 'extintor', name: 'Extintor' },
      { id: 'extintor-10k', name: 'Extintor 10 K.' },
      { id: 'gata', name: 'Gata' },
      { id: 'limp-parab', name: 'Limp. Parab.' },
      { id: 'llave-rueda', name: 'Llave Rueda' },
      { id: 'neblineros', name: 'Neblineros' },
      { id: 'parlantes', name: 'Parlantes' },
      { id: 'pertiga', name: 'Pertiga' },
      { id: 'piso-goma', name: 'Piso Goma' },
      { id: 'radio', name: 'Radio' },
      { id: 'rueda-del-izq', name: 'Rueda Del Izq.' },
      { id: 'rueda-del-der', name: 'Rueda Del.Der.' },
      { id: 'rueda-rpto', name: 'Rueda Rpto.' },
      { id: 'rueda-tra-der', name: 'Rueda Tra.Der.' },
      { id: 'rueda-tra-izq', name: 'Rueda Tra.Izq.' },
      { id: 'sombrilla', name: 'Sombrilla' },
      { id: 'tag', name: 'TAG' },
      { id: 'tapa-bencina', name: 'Tapa Bencina' },
      { id: 'tapa-radiador', name: 'Tapa Radiador' },
      { id: 'tapa-ruedas', name: 'Tapa Ruedas' },
      { id: 'triangulos', name: 'Triángulos' }
    ]
  }
];
