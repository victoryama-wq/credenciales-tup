# Auditoría de módulos y vistas - 2026-06-01

Proyecto: `credencial-tup`

## Alcance

Se revisaron los flujos principales de la web app de credenciales:

- Acceso institucional con Google.
- Portal de solicitantes: estudiantes, docentes y colaboradores/administrativos.
- Panel administrativo: dashboard, solicitudes, lotes, entrega, importación, reportes, auditoría, administradores y diseño de credencial.
- Verificación pública por QR.
- Firebase Functions, Firestore, Storage, Hosting y extensión Trigger Email.

## Validaciones ejecutadas

| Validación | Resultado |
| --- | --- |
| `npm run build` | Correcto |
| `npm --prefix functions run lint` | Correcto |
| `npm --prefix functions run build` | Correcto |
| `npm test -- --watch=false` | Correcto: 3 archivos, 7 pruebas |
| Firebase deploy Functions + Hosting | Correcto |
| Revisión de logs recientes Functions | Sin errores runtime de la app |
| Revisión de rutas públicas en navegador | Sin errores de consola |
| Revisión de consistencia Firestore | Sin datos críticos faltantes |

## Hallazgos corregidos

### 1. Docente clasificado como administrativo

En logs y datos reales se encontró una solicitud con correo `tup-d17@tecplayacar.edu.mx` guardada como `STAFF`.

Causa:

- El patrón de docente exigía `tup-d` + 4 dígitos.
- En producción ya existe al menos un correo docente con menos dígitos.

Corrección:

- Frontend: se actualizó la detección de tipo de solicitante para reconocer `tup-d` + cualquier número.
- Backend: se aplicó la misma regla en Functions.
- Datos: se corrigió la solicitud `ahD3h7pJzEsY3nbH5poA` de `STAFF` a `TEACHER`.
- Auditoría: se registró la corrección en `audit_logs`.

Archivos relacionados:

- `src/app/core/auth/institutional-email.util.ts`
- `src/app/core/auth/institutional-email.util.spec.ts`
- `src/app/features/student/pages/student-dashboard/student-dashboard.component.ts`
- `functions/src/index.ts`

### 2. Detección de tipo de solicitante centralizada en frontend

Mejora aplicada:

- Se agregó `resolveApplicantTypeByEmail()` para evitar duplicar reglas en componentes.
- Se agregaron pruebas para:
  - `tup3042@tecplayacar.edu.mx` -> Estudiante
  - `tup-d17@tecplayacar.edu.mx` -> Docente
  - `tup-d2503@tecplayacar.edu.mx` -> Docente
  - `zulma.martinez@tecplayacar.edu.mx` -> Colaborador

## Revisión de logs

### Functions

No se encontraron errores runtime recientes de las Functions propias.

Observaciones:

- Los mensajes `app: MISSING` son verificaciones de App Check ausente; no bloquean la operación actual.
- Se observan arranques por autoscaling normales en Functions 2nd Gen.

### Trigger Email

Estado de colección `mail`:

- Total revisado: 238 correos.
- Exitosos: 235.
- Error: 3.

Los 3 errores son históricos del 2026-05-23 y todos corresponden a `noreply@tecplayacar.edu.mx`, con error `invalid_grant` antes de la renovación OAuth2. Los envíos recientes aparecen como exitosos, por lo que no se reenviaron esos mensajes de prueba.

## Revisión de datos Firestore

Total de solicitudes revisadas: 2198.

Resumen:

- Estudiantes: 2184.
- Docentes: 2.
- Colaboradores/administrativos: 12.

Estatus:

- Entregadas: 2116.
- En revisión: 24.
- Aprobadas para impresión: 19.
- Rechazadas: 20.
- Listas para entrega: 8.
- Enviadas: 11.

Validaciones de consistencia:

- Sin estatus inválidos.
- Sin tipos de solicitante inválidos.
- Sin fotos faltantes.
- Sin reposiciones sin comprobante.
- Sin credenciales listas/impresas/entregadas sin folio o QR.
- Sin lotes con referencias a solicitudes inexistentes.

Observación menor:

- Existe un registro histórico/de prueba con `noreply@tecplayacar.edu.mx` como estudiante (`TUP2104`). No se modificó porque corresponde a una credencial ya entregada de prueba y no afecta la operación institucional.

## Verificación pública en navegador

Rutas revisadas:

- `/login`: carga correcta, sin errores de consola.
- `/student` sin sesión: redirige correctamente a `/login`.
- `/admin` sin sesión: redirige correctamente a `/login`.
- `/verify/token-invalido`: muestra mensaje de token inválido, sin errores.
- `/verify/bd4a47cf-fef6-41d8-b4f2-4488e0f82eab`: muestra credencial válida, sin errores.

## Estado después de la auditoría

- Backend desplegado con corrección de clasificación docente.
- Hosting desplegado con corrección frontend y prueba agregada.
- Datos corregidos para el caso docente detectado.
- No se detectaron fallos críticos pendientes en build, lint, pruebas, logs o consistencia de datos.

## Recomendaciones posteriores

- Considerar App Check cuando el sistema esté estabilizado para producción institucional completa.
- Mantener revisión periódica de `mail.delivery.state == ERROR` para detectar problemas SMTP/OAuth antes de campañas grandes.
- Mantener la regla docente como `tup-d` + número, ya que la operación real mostró correos con menos de 4 dígitos.
