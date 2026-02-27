
Objetivo
Corregir la validación de patente para que no “quede pegada” en advertencia y se comporte de forma confiable al cambiar patente, marca o modelo, incluso cuando existe historial del vehículo.

Diagnóstico (con evidencia)
1) La comparación actual es demasiado estricta:
- Hoy se usa igualdad exacta en minúsculas:
  - marca: patentData.marca.toLowerCase() === vehicleBrand.toLowerCase()
  - modelo: patentData.modelo.toLowerCase() === vehicleModel.toLowerCase()
- En tus datos reales, la API devolvió para TLYF23:
  - marca: CHEVROLET
  - modelo: FRR 1119 VD01
- Si en el formulario tienes “Chevrolet / FRR 1119”, el sistema seguirá marcando no-coincidencia aunque semánticamente sí coincide.

2) Falta de “contexto de consulta” por patente:
- El componente valida con patentData + licensePlate actual, pero no guarda explícitamente para qué patente llegó ese patentData.
- Si el usuario cambia patente durante/recién después de una consulta, el estado visual puede quedar inconsistente.

3) El flujo de historial/sugerencia y validación cruzada conviven pero no están totalmente orquestados:
- Se muestran modales y banners, pero no hay acciones de resolución rápidas en el banner (por ejemplo “aplicar datos oficiales” o “revalidar”), por eso se percibe como que “queda ahí”.

Alcance de la solución
Archivo principal:
- src/components/services/form/VehicleSection.tsx

Ajuste de soporte:
- src/hooks/usePatentLookup.ts

Plan de implementación
1) Normalización robusta antes de comparar (marca y modelo)
- Crear funciones utilitarias locales en VehicleSection:
  - normalizeText: trim, uppercase, remover dobles espacios, opcional remover tildes.
  - normalizeModel: además de normalizeText, remover separadores no alfanuméricos irrelevantes.
- Reemplazar comparación exacta por comparación robusta:
  - brandMatch: igualdad normalizada.
  - modelMatch:
    - true si iguales normalizados, o
    - true si uno contiene al otro por tokens relevantes (ej. “FRR 1119” vs “FRR 1119 VD01”).
- Resultado: evita falsos negativos como el que reportaste.

2) Asociar el resultado de API con la patente consultada
- En usePatentLookup, devolver también la patente normalizada de la última respuesta, por ejemplo:
  - dataPlate (o lastResolvedPlate)
- En VehicleSection, validar solo si:
  - normalize(licensePlate actual) === dataPlate
- Resultado: al cambiar patente, no se aplica banner con datos “viejos”.

3) Control de estado al cambiar patente (anti “queda pegado”)
- Al detectar cambio real de patente:
  - limpiar mismatchWarning y verificationSuccess,
  - cerrar sugerencia/historial si corresponde,
  - resetear patentData de manera controlada para no arrastrar estado.
- Mantener cache anti-spam de consultas, pero permitir “revalidación forzada” si el usuario vuelve a la misma patente o corrige datos.

4) Mejorar UX del banner para resolver de inmediato
- Banner de advertencia (estilo consistente con módulo Cost: tipografía/espaciado/bordes):
  - botón “Aplicar datos oficiales” (marca/modelo desde API),
  - botón “Revalidar patente” (fuerza consulta nuevamente),
  - botón “Descartar por ahora” (oculta aviso de esa combinación de patente+marca+modelo).
- Banner de éxito:
  - mostrar solo si la respuesta corresponde a la patente actual y comparación robusta da match.

5) Orquestación con historial de servicios
- Si aparece modal de historial, no bloquear la verificación; solo evitar mensajes contradictorios simultáneos.
- Definir prioridad visual:
  1. Modal de historial (si aplica),
  2. luego resultado de verificación (warning/success).
- Al confirmar “Sí, continuar”, mantener validación activa y actualizable.

6) Casos de prueba funcional (manuales)
- Caso A: TLYF23 + Chevrolet + FRR 1119 => debe validar OK (aunque API entregue FRR 1119 VD01).
- Caso B: TLYF23 + Chevrolet + Blazer => warning con mensaje claro.
- Caso C: cambiar patente a otra distinta => warning anterior desaparece y se recalcula.
- Caso D: volver a patente anterior => revalidación correcta (sin quedar pegado por cache).
- Caso E: con historial abierto/cerrado => sin estados cruzados inconsistentes.

Criterios de aceptación
- La advertencia ya no queda fija al corregir datos o al cambiar patente.
- Comparaciones marca/modelo toleran variantes comunes de formato.
- No hay falsos negativos por sufijos de modelo (ej. VD01).
- La validación siempre corresponde a la patente actualmente ingresada.
- Flujo visual consistente con patrones del sistema (incluyendo estilo tipo módulo Cost).

Riesgos y mitigación
- Riesgo: comparación demasiado permisiva en modelos.
  - Mitigación: usar reglas por tokens (mínimo 2 tokens alfanuméricos relevantes) en vez de contains ciego.
- Riesgo: más consultas API.
  - Mitigación: mantener cache por patente + opción explícita de revalidar.
- Riesgo: conflicto visual modal/banner.
  - Mitigación: prioridad de UI definida y limpieza de estados en transiciones.

Resultado esperado para tu caso reportado
- Con patente TLYF23 y modelo interno “FRR 1119”, ya no debería quedar advertencia permanente por el sufijo “VD01”.
- Si ingresas modelo incorrecto a propósito, mostrará advertencia.
- Si cambias patente o corriges modelo/marca, el estado se actualizará inmediatamente y dejará de “quedarse ahí”.
