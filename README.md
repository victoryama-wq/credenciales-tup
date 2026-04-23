# Credenciales Escolares TUP

Aplicacion web para solicitudes de credenciales escolares del Tecnologico
Universitario Playacar. El frontend usa Angular, Reactive Forms, Angular
Material y Tailwind. El backend usa Firebase Authentication, Firestore,
Storage y Cloud Functions.

## MVP actual

- Inicio de sesion por correo y contrasena.
- Rutas protegidas por rol para estudiante y administrador.
- Portal estudiante para capturar solicitud, foto y evidencia.
- Portal administrativo para revisar solicitudes y mover estatus.
- Validacion de transiciones de estatus en Cloud Functions.
- Control de duplicados activos por usuario/ciclo y matricula/ciclo.
- Generacion de folio y token QR en backend.
- Auditoria en `audit_logs`.
- Cola de notificaciones en `notifications` y documentos compatibles con la
  extension Trigger Email en `mail`.

## Comandos utiles

```bash
npm run build
npm test -- --watch=false
npm --prefix functions run build
npm --prefix functions run lint
firebase emulators:start
```

## Correo transaccional

Las Functions escriben documentos en `mail/{id}` con `to` y `message`. Para que
los correos salgan realmente, instala y configura la extension oficial de
Firebase **Trigger Email** apuntando a la coleccion `mail`.

## Despliegue

```bash
firebase deploy --only firestore,storage,functions,hosting
```

El proyecto Firebase configurado es `credencial-tup`.
