# Credenciales Institucionales TUP

Web app institucional para tramitar, revisar, imprimir, entregar y verificar
credenciales del Tecnologico Universitario Playacar.

Proyecto Firebase: `credencial-tup`

URL publica: `https://credencial-tup.web.app`

## Stack

- Frontend: Angular standalone, Reactive Forms, Angular Material y Tailwind.
- Autenticacion: Firebase Authentication con Google Workspace Education.
- Base de datos: Cloud Firestore.
- Archivos: Firebase Storage.
- Backend: Cloud Functions for Firebase, TypeScript.
- Correo: coleccion `mail` compatible con Firebase Trigger Email.
- Hosting: Firebase Hosting.

## Documentacion

- [SPEC.md](SPEC.md): especificacion funcional del producto.
- [SDD.md](SDD.md): diseno tecnico y arquitectura.
- [AUDITORIA_MODULOS_2026-06-01.md](AUDITORIA_MODULOS_2026-06-01.md): auditoria operativa reciente.

## Modulos principales

### Portal solicitante

- Acceso con cuenta institucional `@tecplayacar.edu.mx`.
- Clasificacion automatica:
  - Estudiante: `tup` + 4 o mas digitos.
  - Docente: `tup-d` + uno o mas digitos.
  - Colaborador/administrativo: nombre.apellido u otro correo institucional.
- Solicitud por primera vez y reposicion.
- Bloqueo de tramite por primera vez cuando ya existe credencial historica o
  solicitud previa.
- Comprobante obligatorio en reposicion.
- Guia de fotografia, carga desde camara o archivo, preview de imagen y limite
  maximo de 10 MB.
- Optimizacion automatica de foto de credencial antes de subirla a Storage.
- Seguimiento de solicitudes rechazadas con carga de correcciones.
- Interfaz responsive por secciones: perfil detectado, datos, fotografia,
  comprobante cuando aplica, resumen de envio y seguimiento de solicitudes.

### Portal administrativo

- Dashboard ejecutivo.
- Solicitudes separadas por tipo de credencial: estudiantes, docentes y
  administrativos.
- Busqueda por matricula, nombre, correo, programa o puesto.
- Flujo de estatus: enviada, en revision, rechazada, aprobada para impresion,
  impresa, lista para entrega y entregada.
- Lotes de impresion.
- Entrega de credenciales.
- Importacion de perfiles Saeko e historico de credenciales entregadas.
- Reportes exportables.
- Auditoria operativa.
- Administracion de usuarios administradores.
- Diseno visual de credenciales con plantillas PNG/SVG.

### Verificacion publica

- Cada credencial usa QR con token seguro.
- La ruta `/verify/:token` confirma la validez sin exponer datos sensibles.

## Comandos utiles

```bash
npm run build
npm test -- --watch=false
npm --prefix functions run lint
npm --prefix functions run build
firebase emulators:start
```

## Despliegue

```bash
firebase deploy --only firestore,storage,functions,hosting
```

Para cambios solo de interfaz:

```bash
npm run build
firebase deploy --only hosting
```

## Notas operativas

- Los correos transaccionales se escriben en `mail/{id}`.
- El remitente institucional se gestiona con OAuth2 en la extension Trigger
  Email.
- Las reglas criticas tambien se validan en Functions, no solo en la UI.
- Las credenciales historicas importadas se consideran ya entregadas y obligan
  a que el siguiente tramite del alumno sea reposicion con comprobante.
- Las correcciones de solicitudes rechazadas suben archivos a subcarpetas
  `correction-*` dentro de `credential-requests/{uid}/{requestId}`.
- Las fotos de credencial se convierten a JPEG y se reducen en navegador; los
  comprobantes se conservan sin compresion para mantener legibilidad.
