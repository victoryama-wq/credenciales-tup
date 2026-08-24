# Mejoras de vistas y flujo de lotes - 2026-08-24

## 1. Objetivo

Esta fase reorganiza la informacion para que estudiantes, docentes,
colaboradores y administradores identifiquen primero la accion que les
corresponde. Tambien agrega la liberacion completa de un lote impreso como
`READY_FOR_PICKUP` con notificaciones individuales.

Los cambios estan implementados localmente. En esta fase aun no se ha creado
commit, realizado push ni desplegado a produccion.

## 2. Portal de estudiantes, docentes y colaboradores

- El encabezado cambia a `Seguimiento de credencial` cuando existe al menos una
  solicitud.
- Se agrega una tarjeta prioritaria con estatus actual, tipo de tramite, ultima
  actualizacion y siguiente paso explicado en lenguaje directo.
- El siguiente paso distingue entre solicitud recibida, revision, correccion
  requerida, aprobacion, impresion, lista para entrega y entrega concluida.
- Cuando ya existe una solicitud, el formulario para otro tramite inicia
  plegado y el seguimiento ocupa todo el ancho disponible.
- El formulario puede mostrarse u ocultarse sin perder el seguimiento.
- La tarjeta de perfil elimina la etiqueta duplicada del tipo de solicitante.
- Cada evento del historial muestra fecha y hora.
- La misma vista y reglas se aplican a estudiantes, docentes y colaboradores;
  el contenido se adapta al tipo de solicitante detectado.

## 3. Solicitudes administrativas

- La vista inicia en `Por atender` en lugar de mostrar todo el historico.
- `Por atender` incluye solicitudes enviadas, en revision, correcciones ya
  reenviadas y aprobadas que aun no pertenecen a un lote.
- Los contadores grandes se sustituyen por filtros compactos de operacion.
- Las pestañas de estudiantes, docentes y administrativos exponen semantica de
  tabs mediante atributos ARIA.
- Se introduce una bandeja maestro-detalle: una lista compacta muestra los
  datos esenciales y solo la solicitud seleccionada presenta fotografia,
  documentos, QR y acciones completas.
- La vista limita el render inicial a 30 resultados y prepara el QR unicamente
  para la solicitud seleccionada.

## 4. Entrega administrativa

- La vista inicia en `Lista para entrega`, que representa la cola de trabajo de
  ventanilla.
- Se agregan busqueda por nombre, correo, matricula o folio y filtros por tipo
  de solicitante y estatus.
- Los contadores se convierten en filtros compactos por etapa.
- La bandeja maestro-detalle renderiza hasta 50 resultados y muestra el detalle
  completo solo de la credencial seleccionada.
- El historial de entregadas permanece disponible mediante el filtro
  correspondiente, pero deja de ocupar la vista inicial.

## 5. Lotes listos para entrega

Se agrega la callable `markPrintBatchReadyForPickup`.

Reglas:

1. El lote debe encontrarse en `PRINTED`.
2. Sus solicitudes deben estar en `PRINTED`, `READY_FOR_PICKUP` o `DELIVERED`.
3. Solo las solicitudes que permanecen en `PRINTED` avanzan a
   `READY_FOR_PICKUP`.
4. Las solicitudes ya listas o entregadas conservan su estado y no generan una
   notificacion duplicada.
5. Cada solicitud actualizada genera timeline, auditoria, documento de
   notificacion y correo transaccional con la plantilla existente
   `credential_ready_for_pickup`.
6. El lote registra `readyForPickupAt`, `readyForPickupBy`, `updatedAt` y cambia
   a `READY_FOR_PICKUP`.

La interfaz muestra el boton `Marcar lote listo para entrega` solamente en
lotes impresos y explica que se notificara individualmente a los
solicitantes. Los lotes creados conservan las acciones de imprimir pendientes
y marcar como impresos.

## 6. Organizacion visual del panel Admin

- La navegacion se agrupa en `Resumen`, `Operacion diaria`, `Configuracion` y
  `Administracion`.
- El Dashboard prioriza el indicador `Por atender` y aclara que
  `Credenciales procesadas` incluye impresas, listas y entregadas.
- El formulario para crear lotes no muestra una barra de acciones deshabilitada
  cuando no existen candidatas.
- Los lotes usan fecha y un identificador corto en lugar del ID completo.
- Las cantidades respetan singular y plural.
- La tipografia de lectura cambia a una familia sans-serif del sistema y Arvo
  se conserva para titulos, reduciendo la densidad visual sin agregar otra
  dependencia web.

## 7. Auditoria y modelo

Nuevas acciones:

- `credential_request.batch_ready_for_pickup`
- `print_batch.ready_for_pickup`

El tipo `PrintBatchStatus` incorpora `READY_FOR_PICKUP`. El SDD y la SPEC
documentan los nuevos campos, estado y reglas de transicion.

## 8. Validaciones ejecutadas

| Validacion                         | Resultado                                  |
| ---------------------------------- | ------------------------------------------ |
| `npm run build`                    | Correcto                                   |
| `npm test -- --watch=false`        | Correcto: 5 archivos, 12 pruebas           |
| `npm --prefix functions test`      | Correcto: 6 pruebas                        |
| `npm --prefix functions run lint`  | Correcto                                   |
| `npm --prefix functions run build` | Correcto, incluido en pruebas de Functions |

El build mantiene un aviso no bloqueante: el bundle inicial es de 762.49 kB y
supera por 12.49 kB el presupuesto configurado de 750 kB.

La comprobacion local en navegador alcanzo la pantalla de acceso. El entorno
local se ejecuta en modo emulador y advierte que no deben usarse credenciales
productivas; por esa razon no se inicio sesion ni se realizo una validacion
visual autenticada de los modulos internos. Esa revision queda pendiente para
el despliegue o un entorno de prueba con usuario emulado.

## 9. Pendiente para cierre

- Revisar el diff final y confirmar que no existan cambios ajenos al alcance.
- Crear commit y push solo cuando el usuario lo autorice.
- Desplegar Functions y Hosting solo con autorizacion explicita.
- Validar en un entorno autenticado el paso de un lote de prueba de `PRINTED`
  a `READY_FOR_PICKUP` y confirmar la cola de notificaciones.

## 10. Correccion posterior: lotes históricos entregados

Después del primer despliegue se detectó que la sección `Lotes en proceso`
clasificaba los registros solamente por `print_batches.status`. Por eso, lotes
históricos cuyo documento seguía en `PRINTED` aparecían pendientes aunque todas
sus credenciales ya se hubieran marcado manualmente como listas o entregadas.

La clasificación ahora combina el estado del lote con los estados actuales de
todas sus solicitudes:

- Si todas están en `DELIVERED`, el lote pasa al historial como `Entregado`.
- Si todas están en `READY_FOR_PICKUP` o `DELIVERED`, pasa al historial como
  `Listo para entrega`.
- Si al menos una permanece en `PRINTED` o en una etapa anterior, continúa en
  `Lotes en proceso`.
- Si aún no se han resuelto todas las referencias del lote, se conserva en
  proceso para evitar ocultarlo durante la carga.

Esta corrección no reescribe documentos históricos ni degrada estados; ajusta
la clasificación visual usando las solicitudes como fuente operativa real.

## 11. Referencia fotográfica y experiencia móvil

Se generó una fotografía sintética, sin identidad real, para mostrar el
encuadre correcto antes de que estudiantes, docentes o colaboradores carguen
su archivo. La versión web se guardó en
`public/photo-framing-reference.webp` con resolución 600 × 800 px y un peso
aproximado de 20 KB.

La referencia aparece en dos puntos:

- En la guía de fotografía, acompañada por las reglas de encuadre y
  presentación.
- En el área de carga como estado inicial; al seleccionar o tomar una foto, se
  sustituye por la vista previa real del usuario.

En teléfono los elementos se muestran en una sola columna y los botones
conservan el ancho completo. A partir de 640 px, la referencia y las acciones
se organizan en dos columnas para aprovechar tabletas sin comprimir el texto.
