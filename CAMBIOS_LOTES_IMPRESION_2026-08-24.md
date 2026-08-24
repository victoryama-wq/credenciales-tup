# Correccion de lotes de impresion y despliegue - 2026-08-24

Proyecto Firebase: `credencial-tup`

URL de produccion: `https://credencial-tup.web.app`

## 1. Alcance

Esta fase reviso el modulo administrativo de lotes de impresion, los datos de
Firestore relacionados, el historial Git local y remoto, y el comportamiento
de impresion en navegador.

Los objetivos fueron:

- Explicar el mensaje `El lote contiene solicitudes que ya no estan listas
  para imprimir.`
- Corregir los lotes que permanecian cargando durante la preparacion de la
  impresion.
- Conservar el estado de credenciales que el personal ya habia marcado
  manualmente como impresas, listas para entregar o entregadas.
- Evitar que el problema se repita por cambios de estado individuales sobre
  solicitudes pertenecientes a un lote activo.
- Validar, versionar, publicar y desplegar la correccion.

Tambien se cerro y desplego una correccion local pendiente relacionada con el
preview inmediato de fotografias.

## 2. Sintomas reportados

### 2.1 Lote que no podia cerrarse

Al intentar marcar un lote como impreso, la Function
`markPrintBatchPrinted` devolvia:

> El lote contiene solicitudes que ya no estan listas para imprimir.

La interfaz podia mostrar cero solicitudes disponibles para crear un lote y el
mensaje anterior al operar sobre un lote ya existente.

### 2.2 Preparacion de impresion que no terminaba

Algunos lotes permanecian mostrando el indicador de carga al intentar abrir la
vista de impresion.

### 2.3 Operacion manual durante la contingencia

Mientras se investigaba el incidente, el personal continuo entregando
credenciales y avanzo manualmente solicitudes de lotes activos a:

- `PRINTED`
- `READY_FOR_PICKUP`
- `DELIVERED`

Esos estados representan trabajo real ya realizado y no debian revertirse al
cerrar los lotes.

## 3. Evidencia revisada

### 3.1 Datos de produccion antes de la correccion

Se realizo una inspeccion de solo lectura. La instantanea analizada contenia:

- 2,721 solicitudes.
- 12 lotes de impresion.
- 9 lotes con estado `PRINTED`.
- 3 lotes activos con estado `CREATED`.
- 157 referencias de solicitudes en lotes activos, todas existentes y con
  vinculo de regreso al lote.
- Ninguna solicitud de esos lotes carecia de identidad, fotografia o QR.

Distribucion observada en los lotes activos:

| Lote | Total | Aprobadas para imprimir | Impresas | Listas para entregar | Entregadas |
| --- | ---: | ---: | ---: | ---: | ---: |
| `4m9eJOAFjqJvhpbSifEh` | 69 | 65 | 2 | 1 | 1 |
| `miMog1oM2xXYxi5AjH8C` | 64 | 0 | 3 | 61 | 0 |
| `vlJxcSL3ioAQKZGAgUnc` | 24 | 0 | 23 | 1 | 0 |

Estos valores corresponden a la instantanea de diagnostico y pueden cambiar
con la operacion diaria posterior.

En auditoria se observaron cambios de estado posteriores a la creacion de los
lotes, entre ellos:

- 92 eventos `APPROVED_FOR_PRINT` -> `PRINTED`.
- 64 eventos `PRINTED` -> `READY_FOR_PICKUP`.
- 1 evento `READY_FOR_PICKUP` -> `DELIVERED`.

Esto confirmo que el lote seguia activo mientras sus solicitudes avanzaban por
el flujo de impresion y entrega.

### 3.2 Navegador y recursos de impresion

Antes de la correccion, la vista administrativa mantenia renderizadas fuentes
ocultas para todos los lotes. Durante la inspeccion se contabilizaron 492
imagenes ocultas asociadas a las credenciales.

Los QR revisados respondieron correctamente, con tiempos aproximados entre 0.2
y 1 segundo. No se encontro evidencia de que la generacion de QR fuera la causa
del bloqueo.

### 3.3 Estado Git y GitHub

Al iniciar la fase:

- `origin/main` estaba en
  `d88f9ce08b90550d25c39a516a8166546846acbe`.
- Existia un commit local pendiente de publicar:
  `a7a61cb3bcaa12b7bf7c4f0c800b193deb37f808`.
- Los directorios locales `Skill/` y `mockups/` no pertenecian al cambio del
  producto; se conservaron y se excluyeron localmente mediante
  `.git/info/exclude`.

## 4. Causa raiz

### 4.1 Reconciliacion incompleta en backend

`markPrintBatchPrinted` solo aceptaba solicitudes en
`APPROVED_FOR_PRINT` o `PRINTED`. Si una solicitud ya estaba en
`READY_FOR_PICKUP` o `DELIVERED`, la Function rechazaba la transaccion completa
aunque ese estado fuera posterior y valido.

La validacion confundia "ya no esta pendiente de impresion" con "estado
incompatible".

### 4.2 Cambios individuales dentro de lotes activos

La transicion general de solicitudes permitia marcar individualmente una
credencial como `PRINTED` aun cuando pertenecia a un lote `CREATED`. Esto
permitia que el estado de las solicitudes avanzara mientras el lote permanecia
abierto y generaba divergencia entre ambos.

### 4.3 Ciclo de vida incompleto en frontend

La preparacion de impresion:

- Mantenia en el DOM las tarjetas ocultas de todos los lotes.
- Clonaba una cantidad innecesaria de tarjetas e imagenes.
- Esperaba recursos sin limite de tiempo.
- Dependia de `afterprint` o de `matchMedia('print')` para limpiar el estado.
- Podia conservar el indicador de carga si el navegador no emitia esos eventos.

## 5. Comportamiento definido

La politica final para cerrar un lote activo es:

| Estado de la solicitud | Se incluye al imprimir pendientes | Accion al cerrar el lote |
| --- | --- | --- |
| `APPROVED_FOR_PRINT` | Si | Avanza a `PRINTED` |
| `PRINTED` | No | Se conserva |
| `READY_FOR_PICKUP` | No | Se conserva |
| `DELIVERED` | No | Se conserva |
| Cualquier estado anterior o incompatible | No | Bloquea el cierre y muestra error |

Reglas adicionales:

- Una solicitud `APPROVED_FOR_PRINT` vinculada a un lote `CREATED` no puede
  marcarse individualmente como `PRINTED`.
- La impresion de un lote solo contiene solicitudes pendientes.
- Un lote sin solicitudes pendientes puede cerrarse directamente como
  impreso; no requiere reimprimir credenciales ya procesadas.
- Cerrar el lote nunca degrada `READY_FOR_PICKUP` ni `DELIVERED`.

## 6. Cambios implementados

### 6.1 Backend

Archivos:

- `functions/src/index.ts`
- `functions/src/print-batch-policy.ts`

Cambios:

- Se centralizo la politica de estados permitidos para reconciliar un lote.
- `markPrintBatchPrinted` acepta solicitudes en
  `APPROVED_FOR_PRINT`, `PRINTED`, `READY_FOR_PICKUP` y `DELIVERED`.
- Solo las solicitudes que permanecen en `APPROVED_FOR_PRINT` se actualizan a
  `PRINTED`.
- Los estados posteriores se conservan sin escritura ni nueva notificacion.
- La transaccion sigue validando que todas las solicitudes existan.
- Los estados previos o incompatibles siguen bloqueando el cierre.
- `updateCredentialRequestStatus` consulta el lote dentro de la misma
  transaccion e impide el cambio individual
  `APPROVED_FOR_PRINT` -> `PRINTED` cuando el lote esta en `CREATED`.
- El backend devuelve un mensaje que dirige al administrador al modulo
  `Lotes de impresion`.

### 6.2 Frontend administrativo

Archivos:

- `src/app/core/models/print-batch.model.ts`
- `src/app/features/admin/pages/admin-dashboard/admin-dashboard.component.ts`
- `src/app/features/admin/pages/admin-dashboard/admin-dashboard.component.html`

Cambios:

- Se agrego un resumen por lote con cantidades pendientes, impresas, listas,
  entregadas e incompatibles.
- Mientras se sincronizan las solicitudes, el lote muestra
  `Cargando solicitudes...`.
- La accion individual de marcar como impresa se deshabilita si la solicitud
  pertenece a un lote activo.
- La interfaz informa que el cambio debe hacerse desde el lote.
- El boton se renombro a `Imprimir pendientes`.
- Solo se preparan los QR y las tarjetas de solicitudes
  `APPROVED_FOR_PRINT`.
- La fuente oculta de impresion se renderiza unicamente para el lote
  seleccionado y durante la operacion activa.
- Se muestran etapas de progreso durante la preparacion.
- La carga de imagenes tiene un limite de 20 segundos y devuelve un error
  legible si un recurso no carga.
- La limpieza del DOM, la clase de impresion y el indicador de carga es
  idempotente.
- Se agrego una limpieza de respaldo al regresar de `window.print()` para
  navegadores que no emiten `afterprint`.

### 6.3 Pruebas

Archivos:

- `functions/test/print-batch-policy.test.mjs`
- `src/app/core/models/print-batch.model.spec.ts`
- `functions/package.json`
- `functions/tsconfig.dev.json`

Cobertura agregada:

- Aceptacion de estados pendientes y posteriores validos.
- Rechazo de estados que aun no alcanzan aprobacion de impresion.
- Actualizacion exclusiva de solicitudes pendientes.
- Conservacion de estados impresos y de entrega.
- Bloqueo de impresion individual solo mientras el lote vinculado esta activo.
- Resumen frontend de estados compatibles e incompatibles.

Se agrego el comando:

```bash
npm --prefix functions test
```

### 6.4 Preview inmediato de fotografia

Archivos:

- `src/app/features/student/pages/student-dashboard/student-dashboard.component.ts`
- `SDD.md`

Cambios:

- Se fuerza la deteccion de cambios al seleccionar y terminar de optimizar una
  fotografia.
- Se esperan dos ciclos consecutivos de `requestAnimationFrame()` para que el
  navegador pinte el preview antes de iniciar la compresion.
- El input se limpia inmediatamente despues de capturar el archivo para poder
  seleccionar nuevamente la misma imagen en un reintento.
- La misma secuencia aplica a solicitudes nuevas, reposiciones y correcciones
  de fotografias rechazadas.

### 6.5 Especificacion y documentacion

Archivos actualizados:

- `README.md`
- `SPEC.md`
- `SDD.md`

Se documentaron:

- La reconciliacion de estados posteriores.
- La prohibicion de imprimir individualmente solicitudes de lotes activos.
- La impresion exclusiva de pendientes.
- El limite de espera y limpieza de la vista de impresion.
- El comando de pruebas de Functions.

## 7. Validaciones ejecutadas

| Validacion | Resultado |
| --- | --- |
| `npm run build` | Correcto |
| `npm test -- --watch=false` | Correcto: 5 archivos, 12 pruebas |
| `npm --prefix functions test` | Correcto: 4 pruebas |
| `npm --prefix functions run lint` | Correcto |
| `npm --prefix functions run build` | Correcto |
| `git diff --check` | Correcto |

El build Angular conserva un aviso no bloqueante: el bundle inicial supera el
presupuesto configurado de 750 kB por 7.13 kB.

## 8. Commits y publicacion Git

### Commit pendiente de fotografia

- SHA:
  `a7a61cb3bcaa12b7bf7c4f0c800b193deb37f808`
- Mensaje: `Asegurar preview inmediato de fotografia`
- Resultado: publicado en `origin/main`.

### Correccion de lotes

- SHA:
  `bb2d80fc0da41890c01acbcacb36f741258846bf`
- Mensaje: `fix: reconciliar lotes de impresion`
- Resultado: publicado en `origin/main`.
- Alcance: 12 archivos, 437 inserciones y 125 eliminaciones.

Al cerrar la fase de codigo, `HEAD` y `origin/main` apuntaban a `bb2d80f` y el
arbol Git estaba limpio.

## 9. Despliegue a produccion

Fecha: 2026-08-24.

Objetivos desplegados:

- Firebase Hosting.
- Cloud Functions for Firebase, segunda generacion, Node.js 24.

El primer intento termino antes de publicar porque el descubrimiento de
Functions excedio el limite predeterminado de 10 segundos. El backend compilado
cargaba localmente en aproximadamente 1 segundo, por lo que se identifico como
latencia del proceso de descubrimiento del CLI.

Se repitio el despliegue con el ajuste soportado por Firebase CLI:

```powershell
$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'
firebase deploy --only functions,hosting --project credencial-tup
```

Resultado:

- Todas las Functions fueron actualizadas correctamente.
- `markPrintBatchPrinted` y `updateCredentialRequestStatus` quedaron activas
  con la nueva politica.
- Hosting libero la nueva version.
- La URL publica respondio HTTP 200.
- El HTML publicado referencio el bundle esperado `main-X5ABH7BT.js`.

No se desplegaron reglas o indices de Firestore ni reglas de Storage porque no
formaban parte de esta correccion.

Firebase CLI emitio un aviso no bloqueante indicando que la dependencia
`firebase-functions` debe actualizarse en una fase posterior.

## 10. Datos y trazabilidad

- No se escribieron ni corrigieron documentos manualmente en Firestore durante
  esta fase.
- No se revirtieron estados establecidos por el personal.
- No se eliminaron lotes ni solicitudes.
- Las credenciales ya entregadas continúan en `DELIVERED`.
- Las credenciales listas para entrega continúan en `READY_FOR_PICKUP`.
- Las credenciales ya impresas continúan en `PRINTED`.
- Solo el cierre de un lote puede actualizar sus pendientes a `PRINTED`.

## 11. Procedimiento operativo recomendado

1. Recargar la aplicacion con `Ctrl + F5` para descartar archivos anteriores en
   cache.
2. Abrir `Administracion` -> `Lotes de impresion`.
3. Revisar el resumen de estados mostrado debajo de cada lote activo.
4. Si existen pendientes, seleccionar `Imprimir pendientes` y completar la
   impresion.
5. Seleccionar `Marcar impreso` para cerrar el lote.
6. Si no existen pendientes, omitir la impresion y cerrar directamente el
   lote; los estados posteriores se conservaran.
7. Continuar la entrega desde el modulo correspondiente.

Con base en la instantanea previa al despliegue:

- El lote `4m9eJOAFjqJvhpbSifEh` tenia 65 credenciales pendientes para imprimir.
- Los lotes `miMog1oM2xXYxi5AjH8C` y `vlJxcSL3ioAQKZGAgUnc` no tenian
  pendientes; podian cerrarse sin reimprimir las credenciales ya procesadas.

Si aparece nuevamente el mensaje de solicitudes incompatibles, no se debe
forzar el estado manualmente. Debe revisarse cual solicitud del lote regreso o
permanece en `SUBMITTED`, `UNDER_REVIEW`, `REJECTED` u otro estado anterior a
la aprobacion de impresion.

## 12. Pendientes posteriores

- Ejecutar una validacion operativa autenticada sobre cada lote activo despues
  de la recarga del navegador.
- Confirmar en `audit_logs` que el cierre de lote solo genero transiciones para
  solicitudes que seguian en `APPROVED_FOR_PRINT`.
- Actualizar `firebase-functions` en una fase independiente, con sus propias
  pruebas y despliegue.
- Evaluar y corregir el exceso de 7.13 kB del presupuesto del bundle Angular.
