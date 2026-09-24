/**
 * Elimina namespaces de un string XML para permitir consultas sin prefijo
 * con DOMParser/querySelector. Maneja los tres casos de DTEs chilenos:
 * declaraciones xmlns, prefijos en elementos (<ds:Signature>) y atributos
 * con prefijo (xsi:schemaLocation). Sin esto, quitar solo las declaraciones
 * deja prefijos huérfanos y DOMParser falla con "unbound prefix".
 */
export function stripNamespaces(xml: string): string {
  return xml
    .replace(/\sxmlns(:[\w.-]+)?="[^"]*"/g, '')   // declaraciones
    .replace(/<(\/?)[\w.-]+:/g, '<$1')             // prefijos en elementos
    .replace(/\s[\w.-]+:[\w.-]+="[^"]*"/g, '');    // atributos con prefijo
}
