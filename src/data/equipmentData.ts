
import { EquipmentCategory } from '@/types/equipment';

export const vehicleEquipment: EquipmentCategory[] = [
  {
    id: 'documentation',
    name: 'Documentación del Vehículo',
    items: [
      { id: 'permiso_circulacion', name: 'Permiso de circulación vigente' },
      { id: 'seguro_obligatorio', name: 'Seguro obligatorio vigente' },
      { id: 'revision_tecnica', name: 'Revisión técnica vigente' },
      { id: 'certificado_gases', name: 'Certificado de gases vigente' },
    ],
  },
  {
    id: 'vehicle_condition',
    name: 'Estado del Vehículo',
    items: [
      { id: 'estado_motor', name: 'Estado del motor' },
      { id: 'niveles_aceite_motor', name: 'Niveles de aceite del motor' },
      { id: 'niveles_refrigerante', name: 'Niveles de refrigerante' },
      { id: 'presion_neumaticos', name: 'Presión de neumáticos' },
      { id: 'estado_neumaticos', name: 'Estado de neumáticos (desgaste)' },
      { id: 'luces_funcionamiento', name: 'Funcionamiento de luces' },
      { id: 'sistema_frenos', name: 'Sistema de frenos' },
      { id: 'direccion', name: 'Dirección y volante' },
    ],
  },
  {
    id: 'crane_hydraulic',
    name: 'Sistema Hidráulico de Grúa',
    items: [
      { id: 'aceite_hidraulico', name: 'Nivel de aceite hidráulico' },
      { id: 'mangueras_hidraulicas', name: 'Estado de mangueras hidráulicas' },
      { id: 'cilindros_hidraulicos', name: 'Funcionamiento de cilindros hidráulicos' },
      { id: 'bomba_hidraulica', name: 'Bomba hidráulica' },
      { id: 'filtros_hidraulicos', name: 'Filtros hidráulicos' },
    ],
  },
  {
    id: 'crane_mechanical',
    name: 'Sistema Mecánico de Grúa',
    items: [
      { id: 'cables_poleas', name: 'Cables y poleas' },
      { id: 'gancho_principal', name: 'Gancho principal' },
      { id: 'eslingas_cadenas', name: 'Eslingas y cadenas' },
      { id: 'winche_tambor', name: 'Winche y tambor' },
      { id: 'estructura_pluma', name: 'Estructura de la pluma' },
      { id: 'estabilizadores', name: 'Estabilizadores (outriggers)' },
    ],
  },
  {
    id: 'electrical_control',
    name: 'Sistema Eléctrico y Control',
    items: [
      { id: 'control_remoto', name: 'Control remoto de grúa' },
      { id: 'indicadores_cabina', name: 'Indicadores en cabina' },
      { id: 'sistema_electrico', name: 'Sistema eléctrico general' },
      { id: 'luces_trabajo', name: 'Luces de trabajo' },
      { id: 'alarmas_seguridad', name: 'Alarmas de seguridad' },
    ],
  },
  {
    id: 'safety_equipment',
    name: 'Equipamiento de Seguridad',
    items: [
      { id: 'extintor', name: 'Extintor de incendios' },
      { id: 'botiquin', name: 'Botiquín de primeros auxilios' },
      { id: 'triangulos', name: 'Triángulos de emergencia' },
      { id: 'chaleco_reflectante', name: 'Chaleco reflectante' },
      { id: 'casco_seguridad', name: 'Casco de seguridad' },
      { id: 'guantes_trabajo', name: 'Guantes de trabajo' },
    ],
  },
];
