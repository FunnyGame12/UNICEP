import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../auth/AuthContext';

const anunciosDemo = [
  {
    title: 'Actualización institucional',
    detail: 'Consulta semanalmente tus módulos académicos, materiales y recordatorios publicados por control escolar.',
  },
  {
    title: 'Integración de video clases',
    detail: 'Los enlaces de YouTube se mostrarán aquí en cuanto el docente publique nuevas sesiones o clases de apoyo.',
  },
  {
    title: 'Portafolio con Drive',
    detail: 'La carga final de evidencias se conectará con una carpeta institucional de Google Drive en la siguiente fase.',
  },
];

const videoClasesDemo = [
  {
    title: 'Video clases por publicar',
    description: 'Aquí se concentrarán los enlaces que comparta cada docente para reforzar los temas por materia.',
  },
  {
    title: 'Canal académico institucional',
    description: 'La integración de YouTube se mostrará en este espacio cuando se habilite el repositorio oficial.',
  },
];

const statusLabels = {
  pendiente: 'Pendiente',
  entregada: 'Entregada',
  fuera_de_tiempo: 'Fuera de tiempo',
  calificada: 'Calificada',
  pagado: 'Pagado',
  condonado: 'Condonado por Dirección',
  vencido: 'Vencido',
  cursada: 'Cursada',
  en_curso: 'En curso',
  recibido: 'Recibido',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

const tramiteLabels = {
  constancia: 'Constancia',
  credencial: 'Credencial',
  uniforme: 'Uniforme',
  papeleria_oficial: 'Papelería oficial',
  comprobante_pago: 'Comprobante de pago',
  otro: 'Otro',
};

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(value || 0));
}

function groupBy(items, keyBuilder) {
  return items.reduce((acc, item) => {
    const key = keyBuilder(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {});
}

function getItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  return [];
}

export default function AlumnoPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sectionErrors, setSectionErrors] = useState({});
  const [dashboard, setDashboard] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [calificaciones, setCalificaciones] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [portafolio, setPortafolio] = useState([]);
  const [meritos, setMeritos] = useState([]);
  const [planEstudio, setPlanEstudio] = useState({ items: [], porcentaje_avance: 0 });
  const [pagos, setPagos] = useState([]);
  const [resumenPagos, setResumenPagos] = useState(null);
  const [tramites, setTramites] = useState([]);
  const [entregaLinks, setEntregaLinks] = useState({});
  const [submittingTaskId, setSubmittingTaskId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [tramiteForm, setTramiteForm] = useState({
    tipo: 'constancia',
    descripcion: '',
    adjunto_url: '',
  });

  async function loadAlumnoData() {
    setLoading(true);
    setError('');
    setSectionErrors({});
    setActionError('');

    try {
      const dashboardResponse = await api.get('/alumnos/dashboard');
      setDashboard(dashboardResponse.data);

      const results = await Promise.allSettled([
        api.get('/alumnos/tareas'),
        api.get('/alumnos/calificaciones'),
        api.get('/alumnos/materiales'),
        api.get('/alumnos/portafolio'),
        api.get('/alumnos/meritos'),
        api.get('/alumnos/plan-estudio'),
        api.get('/alumnos/pagos'),
        api.get('/alumnos/tramites'),
      ]);

      const nextSectionErrors = {};

      if (results[0].status === 'fulfilled') {
        setTareas(getItems(results[0].value.data));
      } else {
        setTareas([]);
        nextSectionErrors.tareas = results[0].reason?.response?.data?.message || 'No se pudieron cargar las tareas.';
      }

      if (results[1].status === 'fulfilled') {
        setCalificaciones(getItems(results[1].value.data));
      } else {
        setCalificaciones([]);
        nextSectionErrors.calificaciones = results[1].reason?.response?.data?.message || 'No se pudieron cargar las calificaciones.';
      }

      if (results[2].status === 'fulfilled') {
        setMateriales(getItems(results[2].value.data));
      } else {
        setMateriales([]);
        nextSectionErrors.materiales = results[2].reason?.response?.data?.message || 'No se pudieron cargar los materiales.';
      }

      if (results[3].status === 'fulfilled') {
        setPortafolio(getItems(results[3].value.data));
      } else {
        setPortafolio([]);
        nextSectionErrors.portafolio = results[3].reason?.response?.data?.message || 'No se pudo cargar el portafolio.';
      }

      if (results[4].status === 'fulfilled') {
        setMeritos(getItems(results[4].value.data));
      } else {
        setMeritos([]);
        nextSectionErrors.meritos = results[4].reason?.response?.data?.message || 'No se pudieron cargar los méritos.';
      }

      if (results[5].status === 'fulfilled') {
        setPlanEstudio(results[5].value.data || { items: [], porcentaje_avance: 0 });
      } else {
        setPlanEstudio({ items: [], porcentaje_avance: 0 });
        nextSectionErrors.plan = results[5].reason?.response?.data?.message || 'No se pudo cargar el plan de estudios.';
      }

      if (results[6].status === 'fulfilled') {
        setPagos(getItems(results[6].value.data));
        setResumenPagos(results[6].value.data.resumen || dashboardResponse.data.resumen_pagos || null);
      } else {
        setPagos([]);
        setResumenPagos(dashboardResponse.data.resumen_pagos || null);
        nextSectionErrors.pagos = results[6].reason?.response?.data?.message || 'No se pudo cargar el módulo de pagos.';
      }

      if (results[7].status === 'fulfilled') {
        setTramites(getItems(results[7].value.data));
      } else {
        setTramites([]);
        nextSectionErrors.tramites = results[7].reason?.response?.data?.message || 'No se pudo cargar la ventanilla virtual.';
      }

      setSectionErrors(nextSectionErrors);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el panel del alumno.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlumnoData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id_usuario, user?.rol]);

  async function handleEntregarTarea(idTarea, initialUrl = '') {
    const archivoUrl = String(entregaLinks[idTarea] ?? initialUrl).trim();
    setActionError('');
    setActionMessage('');

    if (!archivoUrl) {
      setActionError('Pega una URL válida del archivo o evidencia antes de registrar la entrega.');
      return;
    }

    setSubmittingTaskId(idTarea);

    try {
      await api.post(`/alumnos/tareas/${idTarea}/entregas`, {
        archivo_entrega_url: archivoUrl,
      });
      setActionMessage('Entrega registrada correctamente.');
      await loadAlumnoData();
    } catch (requestError) {
      setActionError(requestError?.response?.data?.message || 'No se pudo registrar la entrega de la tarea.');
    } finally {
      setSubmittingTaskId(null);
    }
  }

  async function handleCrearTramite(event) {
    event.preventDefault();
    setActionError('');
    setActionMessage('');

    if (!tramiteForm.descripcion.trim()) {
      setActionError('Describe el trámite que deseas solicitar.');
      return;
    }

    try {
      await api.post('/alumnos/tramites', {
        tipo: tramiteForm.tipo,
        descripcion: tramiteForm.descripcion.trim(),
        adjunto_url: tramiteForm.adjunto_url.trim() || undefined,
      });
      setTramiteForm({ tipo: 'constancia', descripcion: '', adjunto_url: '' });
      setActionMessage('Trámite enviado a ventanilla virtual.');
      await loadAlumnoData();
    } catch (requestError) {
      setActionError(requestError?.response?.data?.message || 'No se pudo registrar el trámite.');
    }
  }

  function handleDownloadCalificaciones() {
    if (calificaciones.length === 0) {
      setActionError('No hay calificaciones disponibles para descargar.');
      return;
    }

    const rows = [
      ['Materia', 'Tarea', 'Calificación', 'Estatus académico', 'Retroalimentación'],
      ...calificaciones.map((item) => [
        item.tarea?.materia?.nombre_materia || 'Sin materia',
        item.tarea?.titulo || 'Sin tarea',
        item.calificacion ?? 'Sin calificación',
        item.estatus_academico,
        item.retroalimentacion || '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kardex-alumno.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  const perfil = dashboard?.perfil;
  const usuarioPerfil = perfil?.usuario || user || {};
  const pagosResumen = resumenPagos || dashboard?.resumen_pagos || {
    estado_general: 'pendiente',
    total_pagado: 0,
    adeudo_pendiente: 0,
  };
  const tareasPorMateria = groupBy(tareas, (item) => item.materia?.nombre_materia || 'Sin materia');
  const materialesPorMateria = groupBy(materiales, (item) => item.materia?.nombre_materia || 'Sin materia');
  const portafolioPorMateria = groupBy(portafolio, (item) => item.materia?.nombre_materia || 'Sin materia');
  const planPorBimestre = groupBy(planEstudio.items || [], (item) => item.bimestre_pertenece || 'Sin bimestre');

  if (!dashboard && !loading) {
    return (
      <section className="student-page">
        <div className="student-toast-stack">
          <div className="error-box student-feedback">{error || 'No se pudo cargar el panel del alumno.'}</div>
        </div>
        <button type="button" className="btn-primary mini-action-button" onClick={loadAlumnoData}>
          Reintentar carga
        </button>
      </section>
    );
  }

  return (
    <section className="student-page">
      <div className="student-toast-stack" aria-live="polite" aria-atomic="true">
        {error ? <p className="error-box student-feedback">{error}</p> : null}
        {actionError ? <p className="error-box student-feedback">{actionError}</p> : null}
        {actionMessage ? <p className="ok-box student-feedback">{actionMessage}</p> : null}
      </div>

      <section id="alumno-dashboard" className="student-hero card-panel">
        <div className="student-profile-card">
          <div className="student-avatar">
            {usuarioPerfil.foto_url ? (
              <img src={usuarioPerfil.foto_url} alt={usuarioPerfil.nombre_completo} />
            ) : (
              <span>{(usuarioPerfil.nombre_completo || 'A').charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div className="student-profile-copy">
            <p className="student-eyebrow">Dashboard del alumno</p>
            <h2>{usuarioPerfil.nombre_completo || 'Alumno UNICEP'}</h2>
            <p>{usuarioPerfil.correo || 'Sin correo registrado'}</p>
            <div className="student-meta-grid">
              <div>
                <strong>Folio</strong>
                <span>{usuarioPerfil.folio_matricula || 'Sin folio'}</span>
              </div>
              <div>
                <strong>Carrera</strong>
                <span>{perfil?.carrera || 'Sin carrera asignada'}</span>
              </div>
              <div>
                <strong>Bimestre actual</strong>
                <span>{perfil?.bimestre_actual || 'Sin asignar'}</span>
              </div>
              <div>
                <strong>Estado de pagos</strong>
                <span>{pagosResumen.estado_general === 'al_corriente' ? 'Al corriente' : pagosResumen.estado_general === 'adeudo' ? 'Con adeudo' : 'Pendiente'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="student-summary-grid">
          <article className="summary-card">
            <span>Tareas activas</span>
            <strong>{tareas.length}</strong>
            <p>Incluye pendientes, entregadas, fuera de tiempo y calificadas.</p>
          </article>
          <article className="summary-card">
            <span>Promedio visible</span>
            <strong>
              {calificaciones.length > 0
                ? (calificaciones.reduce((acc, item) => acc + Number(item.calificacion || 0), 0) / calificaciones.length).toFixed(1)
                : 'N/D'}
            </strong>
            <p>Kardex digital con base en las tareas ya calificadas.</p>
          </article>
          <article className="summary-card">
            <span>Avance curricular</span>
            <strong>{planEstudio.porcentaje_avance || 0}%</strong>
            <p>Mide materias cursadas, en curso y pendientes por bimestre.</p>
          </article>
          <article className="summary-card">
            <span>Adeudo pendiente</span>
            <strong>{formatCurrency(pagosResumen.adeudo_pendiente)}</strong>
            <p>Resumen financiero consultivo sin cobro en esta primera etapa.</p>
          </article>
        </div>

        <div className="quick-access-panel">
          <a href="#alumno-anuncios" className="quick-link">Anuncios</a>
          <a href="#alumno-tareas" className="quick-link">Tareas</a>
          <a href="#alumno-calificaciones" className="quick-link">Calificaciones</a>
          <a href="#alumno-materiales" className="quick-link">Material</a>
          <a href="#alumno-portafolio" className="quick-link">Portafolio</a>
          <a href="#alumno-tramites" className="quick-link">Trámites</a>
          <a href="#alumno-videos" className="quick-link">Video clases</a>
        </div>

        <div className="schedule-dashboard-grid">
          <article className="card-panel student-schedule-card">
            <div className="section-heading">
              <h3>Horario de clases por bimestre</h3>
              <p>Consulta tus grupos actuales y el rango oficial de horarios para modalidad flexible.</p>
            </div>
            <div className="bimestre-stack">
              {(dashboard?.horario_bimestre || []).length > 0 ? (dashboard.horario_bimestre.map((bloque) => (
                <div key={bloque.bimestre} className="bimestre-card">
                  <strong>Bimestre {bloque.bimestre}</strong>
                  {bloque.materias.map((materia) => (
                    <div key={`${materia.codigo_materia}-${materia.grupo}`} className="mini-row">
                      <span>{materia.nombre_materia}</span>
                      <small>{materia.grupo} · {materia.docente}</small>
                    </div>
                  ))}
                </div>
              ))) : <p className="empty-state">Aún no hay grupos cargados para este alumno.</p>}
            </div>
          </article>

          <article className="card-panel student-schedule-card">
            <div className="section-heading">
              <h3>Rangos oficiales</h3>
              <p>Ventanas horarias institucionales aplicables a la modalidad ejecutiva.</p>
            </div>
            <div className="official-schedule-list">
              {(dashboard?.horarios_oficiales || []).map((horario) => (
                <div key={horario.id_horario} className="official-schedule-item">
                  <strong>{horario.turno}</strong>
                  <span>{horario.periodo}</span>
                  <small>{horario.hora_inicio} - {horario.hora_fin}</small>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      {loading ? <p className="student-loading">Cargando información del alumno...</p> : null}

      <section id="alumno-anuncios" className="card-panel student-section">
        <div className="section-heading">
          <h3>Anuncios y accesos prioritarios</h3>
          <p>Este bloque concentra avisos institucionales y recordatorios de uso frecuente.</p>
        </div>
        <div className="info-grid">
          {anunciosDemo.map((item) => (
            <article key={item.title} className="info-card">
              <h4>{item.title}</h4>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="alumno-tareas" className="card-panel student-section">
        <div className="section-heading">
          <h3>Zona de tareas</h3>
          <p>Tareas asignadas por materia con estado, fecha límite, calificación y retroalimentación docente.</p>
        </div>
        {sectionErrors.tareas ? <p className="error-box">{sectionErrors.tareas}</p> : null}
        {Object.keys(tareasPorMateria).length > 0 ? Object.entries(tareasPorMateria).map(([materia, items]) => (
          <div key={materia} className="subject-block">
            <h4>{materia}</h4>
            <div className="student-card-grid">
              {items.map((item) => (
                <article key={item.id_tarea} className="student-feature-card">
                  <div className="card-topline">
                    <span className={`status-pill status-${item.estatus}`}>{statusLabels[item.estatus] || item.estatus}</span>
                    <strong>Grupo {item.grupo}</strong>
                  </div>
                  <h5>{item.titulo}</h5>
                  <p>{item.descripcion}</p>
                  <div className="detail-list">
                    <div><strong>Fecha límite:</strong> <span>{formatDateTime(item.fecha_limite)}</span></div>
                    <div><strong>Adjunto:</strong> <span>{item.archivo_adjunto_url ? <a href={item.archivo_adjunto_url} target="_blank" rel="noreferrer">Ver archivo</a> : 'Sin adjunto'}</span></div>
                    <div><strong>Calificación:</strong> <span>{item.calificacion ?? 'Sin calificar'}</span></div>
                    <div><strong>Retroalimentación:</strong> <span>{item.retroalimentacion || 'Aún no hay comentarios del docente.'}</span></div>
                  </div>
                  <div className="delivery-box">
                    <label>
                      URL de entrega
                      <input
                        id={`entrega-url-${item.id_tarea}`}
                        name={`entrega_url_${item.id_tarea}`}
                        type="url"
                        value={entregaLinks[item.id_tarea] ?? item.entrega?.archivo_entrega_url ?? ''}
                        onChange={(event) => setEntregaLinks((actual) => ({ ...actual, [item.id_tarea]: event.target.value }))}
                        placeholder="https://..."
                      />
                    </label>
                    <button
                      type="button"
                      className="btn-primary mini-action-button"
                      disabled={submittingTaskId === item.id_tarea}
                      onClick={() => handleEntregarTarea(item.id_tarea, item.entrega?.archivo_entrega_url)}
                    >
                      {submittingTaskId === item.id_tarea ? 'Guardando...' : 'Registrar entrega'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )) : <p className="empty-state">No hay tareas asignadas por el momento.</p>}
      </section>

      <section id="alumno-portafolio" className="card-panel student-section">
        <div className="section-heading">
          <h3>Portafolio de evidencias</h3>
          <p>Espacio para evidencias finales por materia o bimestre, visible para docentes y control escolar.</p>
        </div>
        {sectionErrors.portafolio ? <p className="error-box">{sectionErrors.portafolio}</p> : null}
        <div className="integration-banner">
          <strong>Integración prevista con Google Drive</strong>
          <p>La siguiente fase conectará este módulo con una carpeta institucional específica para carga múltiple y organización automática.</p>
        </div>
        {Object.keys(portafolioPorMateria).length > 0 ? Object.entries(portafolioPorMateria).map(([materia, items]) => (
          <div key={materia} className="subject-block">
            <h4>{materia}</h4>
            <div className="student-card-grid">
              {items.map((item) => (
                <article key={item.id_evidencia} className="student-feature-card compact-card">
                  <h5>Periodo {item.periodo_bimestre}</h5>
                  <p>Archivo final cargado para revisión académica.</p>
                  <div className="detail-list">
                    <div><strong>Materia:</strong> <span>{item.materia?.nombre_materia || materia}</span></div>
                    <div><strong>Archivo:</strong> <span><a href={item.archivo_url} target="_blank" rel="noreferrer">Abrir evidencia</a></span></div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )) : <p className="empty-state">Aún no hay evidencias registradas en el portafolio.</p>}
      </section>

      <section id="alumno-materiales" className="card-panel student-section">
        <div className="section-heading">
          <h3>Material de clases</h3>
          <p>Repositorio digital por materia con visualización, descarga y organización por temas o semanas.</p>
        </div>
        {sectionErrors.materiales ? <p className="error-box">{sectionErrors.materiales}</p> : null}
        {Object.keys(materialesPorMateria).length > 0 ? Object.entries(materialesPorMateria).map(([materia, items]) => (
          <div key={materia} className="subject-block">
            <h4>{materia}</h4>
            <div className="student-card-grid">
              {items.map((item) => (
                <article key={item.id_material} className="student-feature-card compact-card">
                  <div className="card-topline">
                    <span className="material-type">{item.tipo_archivo}</span>
                    <strong>{item.tema_semana}</strong>
                  </div>
                  <p>Recurso publicado por el docente para seguimiento semanal.</p>
                  <div className="material-actions">
                    <a href={item.archivo_url} target="_blank" rel="noreferrer">Visualizar</a>
                    <a href={item.archivo_url} target="_blank" rel="noreferrer">Descargar</a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )) : <p className="empty-state">Todavía no hay materiales de clase publicados.</p>}
      </section>

      <section id="alumno-videos" className="card-panel student-section">
        <div className="section-heading">
          <h3>Video clases enlazadas a YouTube</h3>
          <p>Este espacio se alimentará con los enlaces externos que comparta cada docente por materia.</p>
        </div>
        <div className="info-grid">
          {videoClasesDemo.map((item) => (
            <article key={item.title} className="info-card">
              <h4>{item.title}</h4>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="alumno-meritos" className="card-panel student-section">
        <div className="section-heading">
          <h3>Méritos académicos</h3>
          <p>Portafolio curricular con diplomas, constancias, reconocimientos, cursos y talleres.</p>
        </div>
        {sectionErrors.meritos ? <p className="error-box">{sectionErrors.meritos}</p> : null}
        <div className="student-card-grid">
          {meritos.length > 0 ? meritos.map((item) => (
            <article key={item.id_merito} className="student-feature-card compact-card">
              <div className="card-topline">
                <span className="material-type">{item.tipo_merito}</span>
                <strong>{formatDate(item.fecha)}</strong>
              </div>
              <h5>{item.nombre}</h5>
              <p>Archivo académico cargado como respaldo curricular.</p>
              <a href={item.archivo_url} target="_blank" rel="noreferrer">Abrir archivo</a>
            </article>
          )) : <p className="empty-state">Aún no hay méritos académicos registrados.</p>}
        </div>
      </section>

      <section id="alumno-calificaciones" className="card-panel student-section">
        <div className="section-heading section-heading-inline">
          <div>
            <h3>Calificaciones y kardex digital</h3>
            <p>Consulta calificaciones por materia, historial académico y retroalimentación docente.</p>
          </div>
          <button type="button" className="btn-primary mini-action-button" onClick={handleDownloadCalificaciones}>
            Descargar kardex
          </button>
        </div>
        {sectionErrors.calificaciones ? <p className="error-box">{sectionErrors.calificaciones}</p> : null}
        <div className="integration-banner slim-banner">
          <strong>Integración prevista con Excel académico en la nube</strong>
          <p>Este módulo podrá sincronizarse con el archivo institucional de calificaciones en la siguiente etapa.</p>
        </div>
        <div className="table-wrap dark-table">
          <table>
            <thead>
              <tr>
                <th>Materia</th>
                <th>Tarea</th>
                <th>Calificación</th>
                <th>Estatus</th>
                <th>Retroalimentación</th>
              </tr>
            </thead>
            <tbody>
              {calificaciones.length > 0 ? calificaciones.map((item) => (
                <tr key={item.id_entrega}>
                  <td>{item.tarea?.materia?.nombre_materia || 'Sin materia'}</td>
                  <td>{item.tarea?.titulo || 'Sin tarea'}</td>
                  <td>{item.calificacion ?? 'Sin calificación'}</td>
                  <td>{item.estatus_academico}</td>
                  <td>{item.retroalimentacion || 'Sin retroalimentación'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5">No hay calificaciones registradas todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="alumno-plan" className="card-panel student-section">
        <div className="section-heading">
          <h3>Plan de estudios</h3>
          <p>Malla curricular organizada por bimestres con avance académico, materias cursadas, en curso y pendientes.</p>
        </div>
        {sectionErrors.plan ? <p className="error-box">{sectionErrors.plan}</p> : null}
        <div className="progress-banner">
          <strong>Avance general: {planEstudio.porcentaje_avance || 0}%</strong>
          <div className="progress-bar">
            <span style={{ width: `${planEstudio.porcentaje_avance || 0}%` }} />
          </div>
        </div>
        {Object.keys(planPorBimestre).length > 0 ? Object.entries(planPorBimestre).map(([bimestre, materias]) => (
          <div key={bimestre} className="subject-block">
            <h4>Bimestre {bimestre}</h4>
            <div className="student-card-grid">
              {materias.map((item) => (
                <article key={item.id_materia} className="student-feature-card compact-card">
                  <div className="card-topline">
                    <span className={`status-pill status-${item.estatus}`}>{statusLabels[item.estatus] || item.estatus}</span>
                    <strong>{item.codigo_materia}</strong>
                  </div>
                  <h5>{item.nombre_materia}</h5>
                  <p>{item.grupo ? `Grupo asignado: ${item.grupo}` : 'Pendiente de cursar.'}</p>
                </article>
              ))}
            </div>
          </div>
        )) : <p className="empty-state">No hay materias registradas para mostrar el plan de estudios.</p>}
      </section>

      <section id="alumno-pagos" className="card-panel student-section">
        <div className="section-heading">
          <h3>Pagos</h3>
          <p>Consulta tu estatus financiero, conceptos liberados, pagos pendientes y referencias internas.</p>
        </div>
        {sectionErrors.pagos ? <p className="error-box">{sectionErrors.pagos}</p> : null}
        <div className="payment-summary-grid">
          <article className="summary-card">
            <span>Estado general</span>
            <strong>{pagosResumen.estado_general === 'al_corriente' ? 'Al corriente' : pagosResumen.estado_general === 'adeudo' ? 'Adeudo' : 'Pendiente'}</strong>
            <p>Resumen consultivo sin función de cobro en esta primera etapa.</p>
          </article>
          <article className="summary-card">
            <span>Periodo activo</span>
            <strong>{pagosResumen.periodo_activo ? formatDate(pagosResumen.periodo_activo) : 'Sin periodo'}</strong>
            <p>Fecha o mes de referencia más cercano en tu historial de pagos.</p>
          </article>
          <article className="summary-card">
            <span>Total pagado</span>
            <strong>{formatCurrency(pagosResumen.total_pagado)}</strong>
            <p>Conceptos liberados, mensualidades e inscripción cubiertos.</p>
          </article>
          <article className="summary-card">
            <span>Adeudo pendiente</span>
            <strong>{formatCurrency(pagosResumen.adeudo_pendiente)}</strong>
            <p>Incluye conceptos pendientes o vencidos aún no regularizados.</p>
          </article>
        </div>
        <div className="table-wrap dark-table">
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Monto</th>
                <th>Fecha límite</th>
                <th>Estatus</th>
                <th>Fecha de pago</th>
                <th>Folio interno</th>
              </tr>
            </thead>
            <tbody>
              {pagos.length > 0 ? pagos.map((item) => (
                <tr key={item.id_pago}>
                  <td>{item.concepto}</td>
                  <td>{formatCurrency(item.monto)}</td>
                  <td>{formatDate(item.fecha_limite)}</td>
                  <td>{statusLabels[item.estatus] || item.estatus}</td>
                  <td>{item.fecha_pago ? formatDate(item.fecha_pago) : 'Sin pago'}</td>
                  <td>{item.folio_interno || 'Sin referencia'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6">No hay movimientos de pago registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section id="alumno-tramites" className="card-panel student-section">
        <div className="section-heading">
          <h3>Ventanilla virtual</h3>
          <p>Solicita constancias, credenciales, uniformes, papelería oficial o registro de comprobantes para revisión institucional.</p>
        </div>
        {sectionErrors.tramites ? <p className="error-box">{sectionErrors.tramites}</p> : null}

        <form className="form-grid admin-form-grid" onSubmit={handleCrearTramite}>
          <h4>Nuevo trámite</h4>
          <label>Tipo
            <select id="tramite-tipo" name="tipo" value={tramiteForm.tipo} onChange={(event) => setTramiteForm((current) => ({ ...current, tipo: event.target.value }))}>
              {Object.entries(tramiteLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="admin-form-wide">Descripción
            <input id="tramite-descripcion" name="descripcion" value={tramiteForm.descripcion} onChange={(event) => setTramiteForm((current) => ({ ...current, descripcion: event.target.value }))} placeholder="Explica el trámite o la solicitud que deseas registrar" />
          </label>
          <label className="admin-form-wide">Adjunto o referencia
            <input id="tramite-adjunto-url" name="adjunto_url" value={tramiteForm.adjunto_url} onChange={(event) => setTramiteForm((current) => ({ ...current, adjunto_url: event.target.value }))} placeholder="https://... (opcional)" />
          </label>
          <button type="submit" className="btn-primary admin-btn admin-btn-save">Enviar trámite</button>
        </form>

        <div className="table-wrap dark-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Estatus</th>
                <th>Solicitud</th>
                <th>Respuesta</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {tramites.length > 0 ? tramites.map((item) => (
                <tr key={item.id_tramite}>
                  <td>{item.id_tramite}</td>
                  <td>{tramiteLabels[item.tipo] || item.tipo}</td>
                  <td>{statusLabels[item.estatus] || item.estatus}</td>
                  <td>{item.descripcion}</td>
                  <td>{item.respuesta || 'Sin respuesta aún'}</td>
                  <td>{formatDateTime(item.fecha_resolucion || item.fecha_solicitud)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6">Aún no has registrado trámites.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
