# Arquitectura de Roles y Dominios - UNICEP Backend

## Objetivo
Alinear el backend con la documentacion funcional para que los roles base, subroles y permisos granulares se complementen en una misma cadena academica y administrativa.

## Flujo de complementariedad entre roles
1. Director supervisa, autoriza excepciones y conserva acceso transversal.
2. Control Escolar opera pagos, folios, desbloqueos y tramites.
3. Coordinacion Academica administra plan de estudios, horarios y validaciones academicas.
4. Maestro opera materias, tareas, materiales, videoclases y calificaciones dentro de su scope.
5. Alumno consume tareas/material, entrega evidencias y consulta calificaciones/pagos propios.
6. Soporte TI mantiene infraestructura, cuentas y respaldos sin tocar decisiones academicas o financieras de negocio.

## Dominios implementados
- `auth`: autenticacion por correo/folio + password con JWT y contexto RBAC.
- `alumnos`: dashboard, tareas, entrega de tareas validada por pertenencia, calificaciones, pagos.
- `docentes`: grupos, creacion de tareas, calificacion de entregas, materiales, portafolios, salones de video.
- `admin`: resumen de usuarios, alta de usuario, validacion de pagos, asignacion alumno-grupo, reglas de desbloqueo y reportes.
- `auditoria`: bitacora de eventos criticos por actor, modulo y entidad.
- `rbac`: tablas de roles, subroles, permisos, roles_permisos y subroles_permisos.

## Matriz operativa vigente
- `director`: lectura transversal, alta de usuarios/folios, cambios financieros extraordinarios, reglas de desbloqueo, reportes, respaldos y asignaciones academicas.
- `control_escolar`: pagos, validacion financiera, desbloqueos manuales, consulta de usuarios y validacion operativa de calificaciones.
- `coordinacion_academica`: materias, planes, periodos, asignaciones alumno-grupo/docente-grupo, validaciones academicas y reportes de avance.
- `maestro`: grupos propios, tareas, materiales, videoclases, anuncios, portafolios y calificaciones de su scope.
- `alumno`: consulta individual de dashboard, tareas, materiales, meritos, plan, pagos y entrega de evidencias.
- `soporte_ti`: dashboard tecnico, consulta/alta de usuarios y respaldos, sin permisos financieros ni academicos de negocio.

## Cuentas demo base
- Director: `admin@unicep.test` / `Admin123!`
- Control Escolar: `control.escolar@unicep.test` / `Control123!`
- Coordinacion Academica: `coordinacion@unicep.test` / `Coordina123!`
- Maestro: `docente@unicep.test` / `Docente123!`
- Alumno: `alumno@unicep.test` / `Alumno123!`
- Soporte TI: `soporte.ti@unicep.test` / `Soporte123!`

- RBAC en todas las rutas por permiso, con roles base `director`, `control_escolar`, `coordinacion_academica`, `maestro`, `alumno` y `soporte_ti`.
- Subroles operativos para `control_escolar_preparatoria` y `prefecto_en_linea`.
- Bloqueo financiero academico para alumno cuando existe pago vencido.
- Desbloqueo operativo al marcar pago como `pagado` por administrativo.
- Maestro solo puede crear tareas y calificar entregas de materias asignadas y con scope propio.
- Alumno solo puede entregar tareas de materias donde esta inscrito en `alumno_grupos`.
- Acciones criticas generan evento de auditoria (`auditoria_eventos`).
- Control Escolar controla altas, bajas y cambios de asignacion alumno-grupo con trazabilidad.
- Director puede autorizar excepciones extemporaneas de calificacion.

## Interdependencias del modelo
- Usuario es raiz de identidad para alumno/docente.
- Materias conectan grupos, tareas, materiales y evidencias.
- Entregas y calificaciones unen flujo docente-alumno.
- Pagos condicionan accesos academicos del alumno.
- Roles y subroles definen el permiso efectivo via catalogo dinamico en base de datos.

## Siguiente nivel recomendado
- Completar middleware de scope por entidad para reutilizar validaciones en controladores.
- Exponer consulta paginada y filtrada de `auditoria_eventos` para direccion y control escolar.
- Agregar trazabilidad de IP y user-agent en auditoria para capa de cumplimiento.
