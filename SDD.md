# SDD - Diseno tecnico Credenciales Institucionales TUP

## 1. Resumen de arquitectura

La aplicacion usa Angular en Firebase Hosting y Firebase como backend
serverless.

Componentes principales:

- Angular SPA.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Storage.
- Cloud Functions for Firebase.
- Firebase Trigger Email.
- Firebase Hosting.

Proyecto Firebase: `credencial-tup`.

## 2. Estructura frontend

Rutas principales:

- `/login`: acceso con Google institucional.
- `/student`: portal del solicitante.
- `/admin`: portal administrativo.
- `/verify/:token`: verificacion publica por QR.

Carpetas principales:

- `src/app/features/auth/pages/login-page/`
- `src/app/features/student/pages/student-dashboard/`
- `src/app/features/admin/pages/admin-dashboard/`
- `src/app/features/verification/pages/credential-verification/`
- `src/app/core/services/`
- `src/app/core/guards/`
- `src/app/core/models/`
- `src/app/core/auth/`
- `src/app/core/ui/`

## 3. Autenticacion y roles

La autenticacion se realiza con Google Workspace Education.

Dominio permitido:

- `tecplayacar.edu.mx`

Clasificacion de solicitantes:

- `STUDENT`: correo `tup` + 4 o mas digitos.
- `TEACHER`: correo `tup-d` + uno o mas digitos.
- `STAFF`: resto de correos institucionales.

Administradores:

- Se gestionan desde el modulo administrativo.
- El backend valida permisos con claims/coleccion de administradores antes de
  operaciones sensibles.

## 4. Modelo de datos

### `credential_requests/{requestId}`

Campos principales:

- `uid`
- `email`
- `applicantType`: `STUDENT | TEACHER | STAFF`
- `requestType`: `FIRST_TIME | REPLACEMENT`
- `studentId`
- `name`
- `career`
- `cycle`
- `phone`
- `status`
- `photoUrl`
- `documents`
- `reviewNotes`
- `rejectionReason`
- `credentialNumber`
- `qrToken`
- `verificationUrl`
- `qrImageUrl`
- `qrImageStoragePath`
- `printBatchId`
- `studentFollowUpAt`
- `studentFollowUpNote`
- `studentFollowUpPending`
- `timeline`
- `submittedAt`
- `updatedAt`
- `reviewedAt`
- `printedAt`
- `readyForPickupAt`
- `deliveredAt`
- `source`
- `importedAt`

### `institutional_profiles/{email}`

Fuente operativa equivalente a Saeko/importacion manual.

Campos esperados:

- `email`
- `applicantType`
- `academicStatus`
- `studentId`
- `name`
- `career`
- `currentTerm`
- `position`
- `updatedAt`

### `print_batches/{batchId}`

- `createdBy`
- `requestIds`
- `status`
- `total`
- `createdAt`
- `printedAt`

### `audit_logs/{logId}`

- `actorUid`
- `action`
- `entity`
- `entityId`
- `before`
- `after`
- `timestamp`

### `mail/{mailId}`

Coleccion consumida por Trigger Email.

- `to`
- `message.subject`
- `message.html`
- `message.text`

## 5. Storage

Rutas:

- `credential-requests/{uid}/{folder}/photo-{fileName}`
- `credential-requests/{uid}/{folder}/evidence-{fileName}`
- `credential-requests/{uid}/{requestId}/correction-{timestamp}/photo-{fileName}`
- `credential-requests/{uid}/{requestId}/correction-{timestamp}/evidence-{fileName}`
- `credential-templates/{type}-{side}.png`
- `credential-templates/{type}-{side}.svg`

Reglas:

- Fotos: JPG/PNG, maximo 10 MB.
- Comprobantes: JPG/PNG/PDF, maximo 10 MB.
- Templates: PNG/SVG, maximo 5 MB.
- Usuarios solo crean archivos propios.
- Administradores pueden leer archivos de solicitudes.
- Las correcciones de solicitudes rechazadas se guardan en subcarpetas
  `correction-*` bajo el `requestId` original.

El frontend normaliza MIME de `.jpg` a `image/jpeg` para compatibilidad con
celulares y reglas de Storage.

Las fotos de credencial se comprimen en el navegador antes de subirse:

- Salida: JPEG.
- Dimension maxima: 1200 px por lado.
- Calidad inicial: 0.86.
- Objetivo aproximado: menor a 900 KB cuando sea posible.
- Aplica a solicitudes nuevas, reposiciones y correcciones.

Los comprobantes no se comprimen por defecto para conservar legibilidad de
recibos y documentos PDF.

## 6. Cloud Functions

Funciones callable principales:

- `createCredentialRequest`
- `updateCredentialRequestStatus`
- `submitCredentialCorrection`
- `createPrintBatch`
- `markPrintBatchPrinted`
- `markCredentialDelivered`
- `importInstitutionalProfiles`
- `importLegacyCredentials`
- `ensureCredentialQrImage`
- `verifyCredential`
- `upsertAdminUser`
- `deleteAdminUser`

Responsabilidades:

- Validar usuario autenticado.
- Validar rol administrativo.
- Validar dominio institucional.
- Validar tipo de solicitante.
- Validar estatus y transiciones.
- Validar primera vez contra reposicion.
- Validar comprobante obligatorio en reposicion.
- Generar folio.
- Generar token QR.
- Crear auditoria.
- Crear documentos de correo.

## 7. Reglas de negocio backend

Reglas criticas implementadas tambien en Functions:

- Solo correos institucionales pueden operar.
- Solicitante bloqueado por baja, egreso o suspension no puede crear solicitud.
- Primera vez solo se permite una vez.
- Credencial historica importada bloquea primera vez.
- Reposicion requiere comprobante.
- `REJECTED` solo vuelve a `UNDER_REVIEW` cuando existe seguimiento del
  solicitante.
- Campos de folio, QR y estatus se controlan desde backend/rol autorizado.

## 8. Frontend solicitante

El portal del solicitante usa una interfaz responsive y modular para
estudiantes, docentes y colaboradores.

Estructura visual:

- Encabezado institucional con logo, tipo de cuenta y cierre de sesion.
- Alerta superior cuando una solicitud rechazada requiere seguimiento.
- Tarjeta de perfil detectado por correo institucional.
- Formulario dividido en datos para credencial, guia de fotografia y carga de
  archivos.
- Vista previa inmediata de la foto de credencial y del comprobante cuando es
  imagen.
- Resumen de envio con boton principal.
- Panel lateral o inferior de solicitudes con timeline y correcciones.

Los iconos son SVG inline para mantener alineacion, evitar dependencias
adicionales y conservar nitidez en escritorio y movil.

## 9. Frontend administrativo

El panel administrativo se organiza por menu lateral:

- Dashboard.
- Solicitudes.
- Lotes de impresion.
- Entrega de credenciales.
- Importacion.
- Reportes.
- Auditoria.
- Administradores.
- Diseno credencial.

El modulo de solicitudes usa pestañas por tipo de credencial y busqueda
transversal por identificador, nombre, correo, programa o puesto.

## 10. Diseno e impresion de credenciales

El editor visual guarda configuracion por tipo y lado de credencial.

Elementos configurables:

- Foto.
- Nombre.
- Identificador.
- Nivel/ciclo.
- Programa/puesto.
- QR.

El render de impresion usa medida PVC:

- 8.6 cm x 5.4 cm.

Las credenciales se imprimen por pagina y deben conservar posicion y tamano
del diseñador.

## 11. Correo institucional

Functions generan correos HTML institucionales en `mail`.

Trigger Email envia los mensajes usando la cuenta configurada:

- Remitente: `noreply@tecplayacar.edu.mx`.

Plantillas:

- Solicitud recibida.
- En revision.
- Rechazo.
- Aprobada para impresion.
- Impresa.
- Lista para entrega.

No se envian correos masivos por importacion historica.

## 12. Seguridad

Capas:

- Guards de Angular para UX y navegacion.
- Firebase Auth para identidad.
- Firestore Rules para lectura/escritura basica.
- Storage Rules para archivos.
- Cloud Functions para reglas criticas.

La UI no se considera fuente de verdad para permisos ni transiciones.

## 13. Pruebas y validacion

Comandos requeridos antes de versionar:

```bash
npm run build
npm test -- --watch=false
npm --prefix functions run lint
npm --prefix functions run build
```

Validaciones manuales recomendadas:

- `/login` carga sin errores.
- `/student` sin sesion redirige a `/login`.
- `/admin` sin sesion redirige a `/login`.
- `/verify/token-invalido` muestra estado invalido.
- QR real muestra credencial valida.
- Carga de foto muestra preview.
- Reposicion exige comprobante.
- Lote de impresion genera vista imprimible.

## 14. Despliegue

Despliegue completo:

```bash
firebase deploy --only firestore,storage,functions,hosting
```

Solo frontend:

```bash
npm run build
firebase deploy --only hosting
```

## 15. Riesgos y seguimiento

- Saeko no tiene API; la sincronizacion depende de importacion CSV.
- App Check esta recomendado para endurecer produccion cuando el flujo este
  estabilizado.
- Revisar periodicamente `mail.delivery.state == ERROR`.
- Mantener plantillas de credencial versionadas por ciclo institucional.
- Validar historicos antes de cargas masivas para evitar estatus incorrectos.
