# Documentacion de Cambios del Dia

Fecha: 2026-08-13
Repositorio: UNICEP
Rama: main

## Resumen Ejecutivo
Durante esta jornada se consolidaron mejoras de frontend, backend, seguridad operativa y despliegue. Los bloques mas relevantes fueron:

1. Endurecimiento del panel Director con formularios robustos, validaciones y auditoria.
2. Sistema de folios por rol con generacion aleatoria y tabla por tipos de usuario.
3. Catalogo jerarquico de conceptos de pago (base y subrama) con CRUD completo.
4. Override financiero por alumno con sincronizacion al flujo de Alumno.
5. Mejoras de UX/UI (tema oscuro consistente, datepicker, placeholders dinamicos).
6. Script unico de despliegue remoto y ejecuciones exitosas en servidor.

## Cambios Funcionales Relevantes

### 1) Frontend Institucional, PDF y Navegacion
- Se corrigio la carga de PDFs para evitar conflictos con rutas SPA y mejorar apertura en movil.
- Se estabilizo el visor PDF y se ajustaron rutas relativas/absolutas para produccion.
- Se mejoro navbar responsive y comportamiento en movil (alineacion, orden, visibilidad de inicio de sesion).
- Se actualizaron enlaces institucionales y mapas de planteles.

### 2) Login, Registro y Recuperacion
- Se mejoro la UX de login/registro y se corrigieron estilos propios del registro.
- Se agregaron flujos de confirmacion y recuperacion de acceso.
- Se documento el control de seguridad y excepciones operativas.

### 3) Panel Director y Control Operativo
- Se creo y evoluciono el dashboard ejecutivo del Director.
- Se aplicaron controles exclusivos por rol y se corrigieron asociaciones RBAC.
- Se mejoraron formularios con busqueda, calendario y validacion de entradas.
- Se integro feed de auditoria y confirmaciones para acciones criticas.

### 4) Folios por Rol y Tabla de Folios
- Generacion de folios por rol con entropia para reducir predictibilidad.
- Acciones para preasignar folios por nombre y rol.
- Tabla de folios por tipo de usuario con filtros y refinamientos de interfaz.

### 5) Catalogo Jerarquico de Conceptos de Pago
- Se implemento CRUD jerarquico de conceptos con clasificaciones:
  - Base: con precio inicial.
  - Subrama: con ajuste por monto fijo o porcentaje.
- Se normalizo a migracion formal de base de datos para campos jerarquicos.
- Se ajustaron labels y placeholders dinamicos en formularios del catalogo.

### 6) Override Financiero y Sincronizacion con Alumno
- Se amplió estatus de pagos para soportar condonado y cancelado.
- Se agrego flujo dependiente en Director:
  - Busqueda de alumno.
  - Seleccion de folio ligada al alumno.
  - Cambio de estado con motivo opcional y auditoria.
- Se sincronizo la logica financiera:
  - Condonado cuenta como liberatorio junto con pagado.
  - Pendiente y vencido se mantienen como adeudo para resumen.
  - Ajustes en bloqueo financiero y referencia de pago.
- Se ajustaron etiquetas en Alumno para reflejar estados nuevos.
- Mejora UX adicional:
  - Campo Folio de pago deshabilitado hasta elegir alumno valido.
  - Placeholder dinamico segun contexto:
    - Primero selecciona un alumno.
    - Selecciona un folio/adeudo de [Nombre del Alumno].
    - Este alumno no tiene folios o adeudos pendientes.

### 7) Despliegue
- Se agrego script unico de despliegue remoto.
- Se realizaron despliegues exitosos, incluyendo:
  - Actualizacion de codigo en servidor.
  - Ejecucion de migraciones.
  - Reinicio de API en PM2 en estado online.
  - Build frontend completado correctamente.

## Migraciones Aplicadas Durante el Dia
- 20260813002000-add-hierarchical-fields-to-conceptos-pago
- 20260813003000-expand-pagos-estatus-enum

## Bitacora Completa de Commits del Dia
Formato: hash | fecha-hora | mensaje

- abe3db8 | 2026-08-13 23:54:53 +0000 | feat: mejora dependencia UX en override financiero
- 16622a8 | 2026-08-13 23:48:55 +0000 | feat: override financiero por alumno y sincronizacion estatus
- 4ba662e | 2026-08-13 23:40:06 +0000 | fix(ui): label y placeholder dinámicos para valor de concepto
- 767e8c5 | 2026-08-13 23:34:51 +0000 | style(director): dark theme consistente y layout vertical de catálogo
- 2fb5a9a | 2026-08-13 23:30:53 +0000 | refactor(db): migracion formal de conceptos jerarquicos de pago
- ed00101 | 2026-08-13 23:25:19 +0000 | feat(finanzas): CRUD jerárquico de conceptos y folios impredecibles
- 34bff75 | 2026-08-13 23:05:48 +0000 | refactor(director): folios preasignados por nombre y rol con filtros
- 4d07f2b | 2026-08-13 22:56:03 +0000 | feat(director): tabla de folios por tipo de usuario
- 903af89 | 2026-08-13 22:48:22 +0000 | feat(director): generar folios aleatorios por usuario y mejorar UI de folios
- a47ee66 | 2026-08-13 22:33:49 +0000 | feat(folios): generar folios por rol con entropia; style(ui): reloj rojo
- 450a588 | 2026-08-13 22:24:53 +0000 | style(ui): restaurar icono reloj y crear estilos oscuros reutilizables
- 72c8155 | 2026-08-13 22:21:44 +0000 | style(datepicker): destacar icono de hora y pista visual
- 0125861 | 2026-08-13 22:18:30 +0000 | style(datepicker): oscurecer selector de hora nativo
- 8729b67 | 2026-08-13 22:14:30 +0000 | style(datepicker): forzar tema oscuro en react-day-picker
- 314efa6 | 2026-08-13 22:10:30 +0000 | style(director): pulir botones y limpiar navegacion secundaria
- 82c248c | 2026-08-13 22:05:07 +0000 | chore(deploy): agregar script unico de despliegue remoto
- 1f09f15 | 2026-08-13 21:54:14 +0000 | feat(director): mejorar UX, auditoria y validacion de formularios
- 2154854 | 2026-08-13 21:35:57 +0000 | Mejorar formularios ejecutivos con busqueda y calendario
- 31de5f6 | 2026-08-13 21:32:15 +0000 | Cambiar navbar segun el rol autenticado
- b198278 | 2026-08-13 21:26:46 +0000 | Mejorar UX del panel del Director
- 18c781a | 2026-08-13 21:21:54 +0000 | Aplicar controles exclusivos del Director
- ad63ccb | 2026-08-13 21:14:36 +0000 | Corregir asociaciones RBAC de usuarios
- 506203f | 2026-08-13 20:29:37 +0000 | Crear dashboard ejecutivo del Director
- 8c04c6e | 2026-08-13 20:17:42 +0000 | Recuperar backend y optimizar documentos PDF
- de5110d | 2026-08-13 20:08:58 +0000 | Documentar controles de seguridad y excepciones
- 64dd025 | 2026-08-13 19:58:24 +0000 | Diseñar formulario de recuperacion
- ee94dea | 2026-08-13 19:55:59 +0000 | Agregar confirmacion y recuperacion de acceso
- 7c781b1 | 2026-08-13 19:48:45 +0000 | Mejorar experiencia de login y registro
- 94a77ae | 2026-08-13 19:46:43 +0000 | Diseñar estilos propios del registro
- cadc6e8 | 2026-08-13 19:42:40 +0000 | Corregir estilos del registro
- 47b7b35 | 2026-08-13 19:39:27 +0000 | Corregir icono y limpieza del Service Worker
- 3eacf52 | 2026-08-13 19:34:08 +0000 | Actualizar mapa del plantel prepa
- 7a6f556 | 2026-08-13 19:32:13 +0000 | Actualizar mapa del plantel universitario
- a48f3f7 | 2026-08-13 19:30:09 +0000 | Actualizar enlaces institucionales
- fda686c | 2026-08-13 19:17:29 +0000 | Usar API relativa en produccion
- bef9455 | 2026-08-13 19:15:37 +0000 | Corregir inicializacion del visor PDF
- dbe2ec7 | 2026-08-13 19:14:04 +0000 | Cargar PDFs en iframe sin rutas SPA
- 9544df1 | 2026-08-13 19:11:28 +0000 | Evitar error de router en visor PDF
- e378b4e | 2026-08-13 19:06:20 +0000 | Identificar selector personalizado docente
- b793024 | 2026-08-13 19:03:38 +0000 | Agregar nombres a campos de formularios
- eb2a0bd | 2026-08-13 18:58:01 +0000 | Evitar rutas del router al abrir PDF
- 406dd9e | 2026-08-13 18:50:13 +0000 | Ajustar orden del header movil
- 31aa464 | 2026-08-13 18:46:23 +0000 | Alinear menu a la izquierda en movil
- f93e78d | 2026-08-13 18:43:14 +0000 | Mostrar inicio de sesion en movil
- d5736b9 | 2026-08-13 18:38:34 +0000 | Actualizar menu institucional responsive
- 6d542e5 | 2026-08-13 18:30:50 +0000 | Restaurar navbar responsive del frontend
- 929ea20 | 2026-08-13 18:09:24 +0000 | Mejorar apertura inicial de PDF en móvil
- 9255d50 | 2026-08-13 17:46:29 +0000 | Usar URLs absolutas para documentos PDF
- 7909158 | 2026-08-13 17:44:31 +0000 | Estabilizar cambio de PDFs en el visor
- c4509cf | 2026-08-13 17:33:38 +0000 | Corregir CSP de fuentes externas
- 0eb3eb7 | 2026-08-13 17:03:36 +0000 | Continuación del código
- e4ea4cd | 2026-08-13 03:29:14 +0000 | Initial commit

## Observaciones Tecnicas
- El frontend reporta advertencia por tamano de chunk mayor a 500 kB en build de produccion.
- Se detectan vulnerabilidades de dependencias reportadas por npm audit (moderadas en backend, altas en frontend), sin bloqueo de build.
- PM2 reporto API online despues de reinicios en despliegue.
