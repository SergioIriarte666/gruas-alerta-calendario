# Guia de uso: importacion manual de XML en costos

## Cuando usar esta herramienta

Use esta opcion cuando:

- el costo ya fue registrado en el sistema
- el proveedor envio la factura XML dias despues
- necesita completar o corregir el costo con la informacion facturada

## Paso a paso

1. Abra el modulo de `Costos`.
2. Busque el costo que desea actualizar.
3. Entre en `Editar costo`.
4. En el encabezado del formulario haga clic en `Importar XML manual`.
5. Cargue el archivo XML de la factura.
6. Revise la vista previa:
   - datos del documento
   - proveedor detectado
   - conceptos
   - cambios a aplicar
   - advertencias o conflictos
7. Elija una opcion:
   - `Complementar`: conserva lo registrado y solo completa lo faltante
   - `Sobrescribir`: reemplaza los datos actuales con la informacion del XML
8. Personalice cada campo en `Cambios a aplicar`:
   - `Conservar actual`: mantiene el valor guardado.
   - `Usar XML`: toma el dato de la factura, incluso si eligió Complementar.
   - `Personalizar`: permite escribir un valor propio o elegir un proveedor del sistema.
   - Revise `Resultado en el costo` antes de confirmar. Puede vaciar campos opcionales, como notas o folio de referencia.
   - Elegir nuevamente Complementar o Sobrescribir restablece los ajustes individuales.
9. Si aparecen advertencias, marque la confirmacion correspondiente.
10. Haga clic en `Aplicar importacion XML`.

## Revertir una importacion

Si detecta un error despues de importar:

1. Abra nuevamente la edicion del costo.
2. Entre a `Importar XML manual`.
3. En la seccion `Reversion disponible` use `Revertir ultima importacion XML`.

## Recomendaciones

- Verifique que el XML corresponda al mismo gasto.
- Si ya modifico manualmente el formulario, guarde o descarte esos cambios antes de importar.
- Use `Complementar` cuando el costo ya tenga datos correctos y solo falten los de la factura.
- Use `Sobrescribir` cuando el costo original tenga datos provisorios o incompletos.

## Mensajes frecuentes

- `El archivo contiene mas de un documento`: cargue un XML con una sola factura.
- `La factura del XML ya esta vinculada a otro costo`: revise si el documento ya fue importado previamente.
- `Debe confirmar explicitamente los conflictos`: marque las advertencias antes de aplicar la importacion.
- `No tienes permisos para importar XML sobre un costo`: solicite acceso de edicion a un administrador.

Los ajustes se aplican a los campos del costo. La factura vinculada, sus conceptos y el pago relacionado usan la información original del XML. El monto personalizado debe ser mayor o igual a cero y la descripción debe tener al menos tres caracteres.
