# SPEC - Credenciales Institucionales TUP

## 1. Objetivo

La plataforma permite gestionar el ciclo completo de credenciales
institucionales para estudiantes, docentes y colaboradores del Tecnologico
Universitario Playacar.

El sistema cubre:

- Solicitud de credencial.
- Validacion administrativa.
- Rechazo y seguimiento de correcciones.
- Generacion de folio y QR.
- Diseno e impresion de credenciales.
- Lotes de impresion.
- Control de entrega.
- Importacion de datos institucionales e historicos.
- Reportes, auditoria y administracion de permisos.

## 2. Alcance

### Incluido

- Acceso con Google Workspace Education para el dominio
  `tecplayacar.edu.mx`.
- Clasificacion automatica de solicitantes segun correo institucional.
- Portal de captura para solicitantes.
- Portal administrativo por modulos.
- Reglas de primera vez contra reposicion.
- Comprobante de pago obligatorio en reposicion.
- Foto obligatoria con preview inmediato, guia visual, optimizacion previa a la
  subida, indicador visible de procesamiento y limite de 10 MB.
- Validacion backend en Cloud Functions.
- Correo transaccional por estatus.
- Verificacion publica por QR.
- Diseno visual de credenciales por tipo de solicitante.

### Fuera de alcance actual

- Integracion directa con Saeko por API, porque no hay API disponible.
- Integracion directa con Moodle para validar trayectoria academica.
- App movil nativa.
- Pago en linea dentro de la plataforma.

## 3. Tipos de usuario

### Solicitante estudiante

Correo esperado: `tup` + 4 o mas digitos + `@tecplayacar.edu.mx`.

Ejemplo: `tup3042@tecplayacar.edu.mx`.

Campos requeridos:

- Nombre completo.
- Matricula.
- Programa academico.
- Cuatrimestre.
- Telefono.
- Foto.
- Comprobante, solo en reposicion.

Reglas:

- La matricula se normaliza a formato `TUP####`.
- Si captura solo numeros, se antepone `TUP`.
- Solo puede realizar una solicitud de primera vez.
- Si existe credencial historica entregada, solo puede solicitar reposicion.

### Solicitante docente

Correo esperado: `tup-d` + uno o mas digitos + `@tecplayacar.edu.mx`.

Ejemplo: `tup-d17@tecplayacar.edu.mx`.

Campos requeridos:

- Nombre completo.
- Foto.
- Comprobante, solo en reposicion.

Reglas:

- No captura carrera.
- No captura cuatrimestre.
- No captura telefono institucional dentro del flujo actual.

### Solicitante colaborador o administrativo

Correo esperado: correo institucional de colaborador, por ejemplo
`nombre.apellido@tecplayacar.edu.mx`.

Campos requeridos:

- Nombre completo.
- Puesto.
- Foto.
- Comprobante, solo en reposicion.

Reglas:

- No captura matricula.
- No captura carrera.
- No captura cuatrimestre.

### Administrador

Usuario autorizado para operar el panel administrativo.

Capacidades:

- Tramitar, revisar y aprobar su propia credencial institucional desde el
  acceso `Mi credencial`.
- Consultar dashboard.
- Revisar solicitudes.
- Cambiar estatus segun flujo permitido.
- Rechazar con motivo.
- Reabrir revision cuando el solicitante envia seguimiento.
- Crear y cerrar lotes de impresion.
- Registrar entrega.
- Importar perfiles Saeko.
- Importar historico de credenciales.
- Exportar reportes.
- Consultar auditoria.
- Administrar usuarios administradores.
- Configurar disenos de credencial.

## 4. Flujo de solicitud

1. El usuario inicia sesion con Google institucional.
2. El sistema valida dominio institucional.
3. El sistema detecta el tipo de solicitante.
4. El usuario llena solo los campos que le corresponden.
5. El usuario adjunta foto JPG/PNG de hasta 10 MB. La interfaz muestra el
   preview de inmediato y un indicador `Optimizando` con barra de progreso
   mientras el navegador la convierte y reduce a JPEG antes de subirla a
   Storage.
6. Si el tramite es reposicion, adjunta comprobante JPG/PNG/PDF de hasta 10 MB.
7. La solicitud se crea con estatus `SUBMITTED`.
8. El sistema registra timeline, auditoria y notificacion.

Un usuario con rol administrativo puede abrir `/my-credential` desde su panel
y utilizar este mismo flujo. Su rol de acceso permanece como `admin`, mientras
que el tipo de credencial se resuelve de manera independiente desde su perfil
institucional o correo. El administrador puede revisar y aprobar su propia
solicitud; cada acción queda registrada en auditoria.

## 5. Flujo de revision

Estatus permitidos:

- `SUBMITTED`: enviada.
- `UNDER_REVIEW`: en revision.
- `REJECTED`: rechazada.
- `APPROVED_FOR_PRINT`: aprobada para impresion.
- `PRINTED`: impresa.
- `READY_FOR_PICKUP`: lista para entrega.
- `DELIVERED`: entregada.

Transiciones:

- `SUBMITTED` -> `UNDER_REVIEW` o `REJECTED`.
- `UNDER_REVIEW` -> `APPROVED_FOR_PRINT` o `REJECTED`.
- `REJECTED` -> `UNDER_REVIEW`, solo cuando hay seguimiento del solicitante.
- `APPROVED_FOR_PRINT` -> `PRINTED`.
- `PRINTED` -> `READY_FOR_PICKUP`.
- `READY_FOR_PICKUP` -> `DELIVERED`.

## 6. Rechazo y seguimiento

Cuando una solicitud se rechaza:

- El administrador debe registrar motivo.
- El solicitante ve el motivo en su portal.
- El solicitante puede cargar foto corregida, comprobante corregido o nota.
- Las fotos corregidas muestran preview inmediato y el mismo indicador de
  optimizacion antes de subirse a Storage.
- El boton administrativo para retomar revision debe habilitarse solo cuando
  existe seguimiento del solicitante.
- El seguimiento de correccion debe adjuntarse a la solicitud rechazada
  original; no debe crear una solicitud nueva.

## 7. Credenciales historicas

El modulo de importacion historica permite registrar credenciales entregadas
antes de implementar el sistema.

Efectos:

- Se crea una referencia institucional con estatus entregado.
- Se evita que el alumno realice tramite de primera vez.
- Si solicita una nueva credencial, el flujo sera reposicion y requerira
  comprobante de pago.
- No se deben enviar correos masivos por importaciones historicas.

## 8. Lotes de impresion

El administrador puede seleccionar solicitudes aprobadas para impresion y crear
un lote.

Reglas:

- Solo entran solicitudes `APPROVED_FOR_PRINT`.
- Al cerrar el lote como impreso, las solicitudes pasan a `PRINTED`.
- El lote mantiene trazabilidad de solicitudes incluidas.
- La impresion debe respetar plantilla, medidas PVC 8.6 cm x 5.4 cm, datos y
  QR configurados.

## 9. Diseno de credencial

El modulo de diseno permite cargar plantillas PNG/SVG por tipo y lado:

- Estudiante frente.
- Estudiante reverso.
- Docente frente.
- Docente reverso.
- Administrativo frente.
- Administrativo reverso.

El administrador puede ajustar:

- Posicion.
- Tamano.
- Visibilidad.
- Color de texto.
- Foto.
- Nombre.
- Matricula o identificador, cuando aplique.
- Nivel/ciclo, cuando aplique.
- Programa/puesto, cuando aplique.
- QR.

Regla especial:

- Administrativo frente muestra nombre y puesto; no muestra matricula ni nivel.

## 10. Reportes y auditoria

El dashboard debe mostrar:

- Solicitudes totales.
- Credenciales impresas.
- Credenciales entregadas.
- Por imprimir.
- Listas para entrega.
- Distribucion por estatus.
- Distribucion por tipo de solicitante.
- Impresas por nivel, carrera y tipo de credencial.

El sistema registra cambios operativos en `audit_logs`.

## 11. Notificaciones

Se generan correos institucionales para eventos clave:

- Solicitud recibida.
- Solicitud en revision.
- Solicitud rechazada.
- Aprobada para impresion.
- Impresa.
- Lista para entrega.

Los mensajes deben usar formato institucional HTML, logo TUP, asunto claro y
llamado a accion. El area de entrega indicada es el area de sistemas.

## 12. Criterios de aceptacion

- Build Angular correcto.
- Pruebas unitarias correctas.
- Lint y build de Functions correctos.
- Rutas protegidas redirigen si no hay sesion.
- Solicitud de estudiante exige matricula, programa, cuatrimestre, telefono y
  foto.
- Solicitud docente exige solo nombre y foto.
- Solicitud colaborador exige nombre, puesto y foto.
- Reposicion exige comprobante.
- Portal solicitante muestra interfaz responsive por secciones, con iconos
  alineados, alerta de accion requerida y seguimiento visible de solicitudes.
- Carga de foto y comprobante conserva botones, previews y nombres de archivo
  dentro de sus tarjetas en escritorio y movil.
- La foto seleccionada aparece antes de iniciar la compresion y mantiene un
  estado visible `Optimizando` con barra de progreso durante el procesamiento.
- El preview inmediato y el indicador de optimizacion funcionan tanto en el
  formulario principal como en las correcciones de solicitudes rechazadas, en
  escritorio y movil.
- Portal solicitante conserva jerarquia visual, foco visible, mensajes
  accesibles y controles tactiles legibles en movil.
- Portal administrativo conserva menu lateral accesible, foco visible, cards
  ejecutivas, formularios claros y tablas responsivas sin cambiar logica de
  negocio.
- Historicos bloquean primera vez.
- QR valido muestra verificacion publica.
- No se exponen datos sensibles en QR.
- Cambios administrativos quedan auditados.
- Un administrador puede abrir `Mi credencial`, crear su solicitud, regresar al
  panel y procesar su propio flujo sin perder permisos administrativos.
