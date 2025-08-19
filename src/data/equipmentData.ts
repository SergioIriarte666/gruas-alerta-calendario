
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
      { id: 'espejo-interno', name: 'Espejo Interno' },
      { id: 'piso-goma', name: 'Piso Goma' },
      { id: 'espejo-exterior', name: 'Espejo Exterior' },
      { id: 'rueda-del-der', name: 'Rueda Del.Der.' },
      { id: 'bateria', name: 'Batería' },
      { id: 'extintor', name: 'Extintor' },
      { id: 'sombrilla', name: 'Sombrilla' },
      { id: 'parlantes', name: 'Parlantes' },
      { id: 'limp-parab', name: 'Limp. Parab.' },
      { id: 'rueda-tra-izq', name: 'Rueda Tra.Izq.' },
      { id: 'tapa-radiador', name: 'Tapa Radiador' },
      { id: 'botiquin', name: 'Botiquín' },
      { id: 'encendedor', name: 'Encendedor' },
      { id: 'cenicero', name: 'Cenicero' },
      { id: 'neblineros', name: 'Neblineros' },
      { id: 'rueda-tra-der', name: 'Rueda Tra.Der.' },
      { id: 'triangulos', name: 'Triángulos' },
      { id: 'llave-rueda', name: 'Llave Rueda' },
      { id: 'radio', name: 'Radio' },
      { id: 'consola', name: 'Consola' },
      { id: 'antena', name: 'Antena' },
      { id: 'tapa-ruedas', name: 'Tapa Ruedas' },
      { id: 'gata', name: 'Gata' },
      { id: 'caja-invierno', name: 'Caja Invierno' },
      { id: 'cint-seguridad', name: 'Cint. Seguridad' },
      { id: 'emblemas', name: 'Emblemas' },
      { id: 'rueda-del-izq', name: 'Rueda Del Izq.' },
      { id: 'tapa-bencina', name: 'Tapa Bencina' },
      { id: 'rueda-rpto', name: 'Rueda Rpto.' },
      { id: 'pertiga', name: 'Pertiga' },
      { id: 'tag', name: 'TAG' },
      { id: 'chaleco-reflectante', name: 'Chaleco Reflectante' },
      { id: 'extintor-10k', name: 'Extintor 10 K.' },
      { id: 'cunas', name: 'Cuñas' },
      { id: 'baliza', name: 'Baliza' }
    ]
  }
];
