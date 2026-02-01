

## Plan: Ordenar Elementos del Inventario Alfabéticamente

### Objetivo
Ordenar los elementos del checklist de equipamiento del vehículo en orden alfabético para facilitar la búsqueda y mejorar la experiencia del usuario.

### Cambios a Realizar

#### Archivo: `src/data/equipmentData.ts`

Reordenar manualmente los items del array en orden alfabético por el campo `name`:

**Orden actual (sin ordenar):**
- Espejo Interno, Piso Goma, Espejo Exterior, Rueda Del.Der., Batería...

**Nuevo orden (alfabético A-Z):**
1. Antena
2. Baliza
3. Batería
4. Botiquín
5. Caja Invierno
6. Cenicero
7. Chaleco Reflectante
8. Cint. Seguridad
9. Consola
10. Cuñas
11. Emblemas
12. Encendedor
13. Espejo Exterior
14. Espejo Interno
15. Extintor
16. Extintor 10 K.
17. Gata
18. Limp. Parab.
19. Llave Rueda
20. Neblineros
21. Parlantes
22. Pertiga
23. Piso Goma
24. Radio
25. Rueda Del Izq.
26. Rueda Del.Der.
27. Rueda Rpto.
28. Rueda Tra.Der.
29. Rueda Tra.Izq.
30. Sombrilla
31. TAG
32. Tapa Bencina
33. Tapa Radiador
34. Tapa Ruedas
35. Triángulos

### Impacto
- **UI del Operador**: El checklist mostrará los elementos ordenados alfabéticamente
- **PDF de Inspección**: La tabla en el PDF también reflejará el orden alfabético (usa la misma fuente de datos)
- **Sin breaking changes**: Los IDs de los elementos permanecen iguales, por lo que los datos existentes siguen siendo compatibles

### Archivos Afectados
| Archivo | Cambio |
|---------|--------|
| `src/data/equipmentData.ts` | Reordenar el array `items` alfabéticamente |

