import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

function formatDate(value, withTime = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(value));
}

function CustomDropdown({ label, value, options, onChange, placeholder }) {
  const dropdownRef = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const selectedOption = options.find((option) => String(option.value) === String(value));

  return (
    <label>
      {label}
      <div className="teacher-custom-select" ref={dropdownRef}>
        <button
          type="button"
          className={`teacher-custom-select-trigger ${open ? 'open' : ''}`}
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={open ? 'true' : 'false'}
        >
          <span>{selectedOption?.label || placeholder}</span>
        </button>

        {open ? (
          <div className="teacher-custom-select-menu" role="listbox" aria-label={label}>
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`teacher-custom-select-option ${String(value) === String(option.value) ? 'selected' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  );
}

export default function DocentePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [dashboard, setDashboard] = useState({ resumen: {}, anuncios: [], salas_video: [] });
  const [grupos, setGrupos] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [portafolios, setPortafolios] = useState([]);
  const [finales, setFinales] = useState([]);
  const [asistencias, setAsistencias] = useState([]);
  const [aprovechamiento, setAprovechamiento] = useState([]);
  const [justificantes, setJustificantes] = useState([]);

  const [anuncioForm, setAnuncioForm] = useState({ titulo: '', descripcion: '', id_materia: '' });
  const [tareaForm, setTareaForm] = useState({ id_materia: '', titulo: '', descripcion: '', fecha_limite: '', archivo_adjunto_url: '' });
  const [materialForm, setMaterialForm] = useState({ id_materia: '', tema_semana: '', tipo_archivo: 'pdf', archivo_url: '' });
  const [salaForm, setSalaForm] = useState({ titulo: '', plataforma: 'Google Meet', enlace: '', fecha_programada: '' });
  const [asistenciaForm, setAsistenciaForm] = useState({
    id_materia: '',
    id_alumno: '',
    fecha_clase: '',
    estatus_asistencia: 'presente',
    aprovechamiento: 'medio',
    observaciones: '',
  });
  const [grading, setGrading] = useState({});

  async function loadDocenteData() {
    setLoading(true);
    setError('');

    try {
      const [
        dashboardResponse,
        gruposResponse,
        tareasResponse,
        entregasResponse,
        materialesResponse,
        portafoliosResponse,
        finalesResponse,
      ] = await Promise.all([
        api.get('/docentes/dashboard'),
        api.get('/docentes/grupos'),
        api.get('/docentes/tareas'),
        api.get('/docentes/entregas'),
        api.get('/docentes/materiales'),
        api.get('/docentes/portafolios'),
        api.get('/docentes/calificaciones-finales'),
      ]);

      const readOptionalItems = async (request) => {
        try {
          const response = await request;
          return response.data?.items || [];
        } catch (requestError) {
          if (requestError?.response?.status === 404) {
            return [];
          }

          throw requestError;
        }
      };

      const [asistenciasItems, aprovechamientoItems, justificantesItems] = await Promise.all([
        readOptionalItems(api.get('/docentes/asistencias')),
        readOptionalItems(api.get('/docentes/aprovechamiento')),
        readOptionalItems(api.get('/docentes/justificantes-preaprobados')),
      ]);

      setDashboard(dashboardResponse.data || { resumen: {}, anuncios: [], salas_video: [] });
      setGrupos(gruposResponse.data.items || []);
      setTareas(tareasResponse.data.items || []);
      setEntregas(entregasResponse.data.items || []);
      setMateriales(materialesResponse.data.items || []);
      setPortafolios(portafoliosResponse.data.items || []);
      setFinales(finalesResponse.data.items || []);
      setAsistencias(asistenciasItems);
      setAprovechamiento(aprovechamientoItems);
      setJustificantes(justificantesItems);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el panel del docente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDocenteData();
  }, []);

  async function handleCreateAnuncio(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/docentes/anuncios', {
        titulo: anuncioForm.titulo.trim(),
        descripcion: anuncioForm.descripcion.trim(),
        id_materia: anuncioForm.id_materia ? Number(anuncioForm.id_materia) : undefined,
      });
      setMessage('Anuncio publicado correctamente.');
      setAnuncioForm({ titulo: '', descripcion: '', id_materia: '' });
      await loadDocenteData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo publicar el anuncio.');
    }
  }

  async function handleCreateTarea(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post(`/docentes/materias/${Number(tareaForm.id_materia)}/tareas`, {
        titulo: tareaForm.titulo.trim(),
        descripcion: tareaForm.descripcion.trim(),
        fecha_limite: tareaForm.fecha_limite,
        archivo_adjunto_url: tareaForm.archivo_adjunto_url.trim() || undefined,
      });
      setMessage('Tarea creada y programada correctamente.');
      setTareaForm({ id_materia: '', titulo: '', descripcion: '', fecha_limite: '', archivo_adjunto_url: '' });
      await loadDocenteData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo crear la tarea.');
    }
  }

  async function handleCreateMaterial(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post(`/docentes/materias/${Number(materialForm.id_materia)}/materiales`, {
        tema_semana: materialForm.tema_semana.trim(),
        tipo_archivo: materialForm.tipo_archivo,
        archivo_url: materialForm.archivo_url.trim(),
      });
      setMessage('Material publicado correctamente.');
      setMaterialForm({ id_materia: '', tema_semana: '', tipo_archivo: 'pdf', archivo_url: '' });
      await loadDocenteData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo publicar el material.');
    }
  }

  async function handleCreateSala(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/docentes/salas-video', {
        titulo: salaForm.titulo.trim(),
        plataforma: salaForm.plataforma.trim(),
        enlace: salaForm.enlace.trim() || undefined,
        fecha_programada: salaForm.fecha_programada,
      });
      setMessage('Sala de videoconferencia creada correctamente.');
      setSalaForm({ titulo: '', plataforma: 'Google Meet', enlace: '', fecha_programada: '' });
      await loadDocenteData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo crear la sala de videoconferencia.');
    }
  }

  async function handleRegistroAsistencia(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/docentes/asistencias', {
        id_materia: Number(asistenciaForm.id_materia),
        id_alumno: asistenciaForm.id_alumno ? Number(asistenciaForm.id_alumno) : undefined,
        fecha_clase: asistenciaForm.fecha_clase || undefined,
        estatus_asistencia: asistenciaForm.estatus_asistencia,
        aprovechamiento: asistenciaForm.aprovechamiento,
        observaciones: asistenciaForm.observaciones.trim() || undefined,
      });

      setMessage('Asistencia y aprovechamiento registrados correctamente.');
      setAsistenciaForm({
        id_materia: '',
        id_alumno: '',
        fecha_clase: '',
        estatus_asistencia: 'presente',
        aprovechamiento: 'medio',
        observaciones: '',
      });
      await loadDocenteData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar asistencia/aprovechamiento.');
    }
  }

  async function handleCalificar(idEntrega) {
    setError('');
    setMessage('');
    const data = grading[idEntrega] || { calificacion: '', retroalimentacion: '' };

    try {
      await api.patch(`/docentes/entregas/${idEntrega}/calificar`, {
        calificacion: Number(data.calificacion),
        retroalimentacion: data.retroalimentacion?.trim() || undefined,
      });
      setMessage('Entrega calificada correctamente.');
      await loadDocenteData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo calificar la entrega.');
    }
  }

  const materiaOptions = grupos.map((item) => ({
    value: String(item.id_materia),
    label: `${item.materia?.nombre_materia || 'Materia'} · Grupo ${item.grupo}`,
  }));
  const anuncioOptions = [
    { value: '', label: 'Anuncio general para todos mis grupos' },
    ...materiaOptions,
  ];
  const tipoMaterialOptions = [
    { value: 'diapositivas', label: 'Diapositivas' },
    { value: 'libro', label: 'Libro digital' },
    { value: 'resumen', label: 'Resumen' },
    { value: 'pdf', label: 'PDF' },
    { value: 'enlace', label: 'Enlace externo' },
  ];
  const estatusAsistenciaOptions = [
    { value: 'presente', label: 'Presente' },
    { value: 'ausente', label: 'Ausente' },
    { value: 'retardo', label: 'Retardo' },
    { value: 'justificado', label: 'Justificado' },
  ];
  const aprovechamientoOptions = [
    { value: 'alto', label: 'Alto' },
    { value: 'medio', label: 'Medio' },
    { value: 'bajo', label: 'Bajo' },
  ];

  return (
    <section className="teacher-page">
      {error ? <p className="error-box teacher-feedback">{error}</p> : null}
      {message ? <p className="ok-box teacher-feedback">{message}</p> : null}

      <section className="teacher-hero card-panel">
        <div>
          <p className="student-eyebrow">Panel docente</p>
          <h2>Gestión académica del docente</h2>
          <p className="teacher-subtitle">Supervisa grupos, publica recursos, programa tareas, califica entregas y da seguimiento al portafolio del alumnado.</p>
        </div>
        <div className="teacher-summary-grid">
          <article className="summary-card"><span>Grupos</span><strong>{dashboard.resumen?.grupos || 0}</strong></article>
          <article className="summary-card"><span>Materias</span><strong>{dashboard.resumen?.materias || 0}</strong></article>
          <article className="summary-card"><span>Tareas</span><strong>{dashboard.resumen?.tareas || 0}</strong></article>
          <article className="summary-card"><span>Entregas por revisar</span><strong>{dashboard.resumen?.entregas_por_revisar || 0}</strong></article>
        </div>
      </section>

      <section id="docente-grupos" className="card-panel teacher-section">
        <div className="section-heading"><h3>Grupos y materias asignadas</h3><p>Consulta las asignaciones activas por grupo y materia.</p></div>
        <div className="teacher-card-grid">
          {grupos.length > 0 ? grupos.map((item) => (
            <article key={item.id_asignacion} className="teacher-card">
              <strong>{item.materia?.nombre_materia}</strong>
              <span>Código: {item.materia?.codigo_materia}</span>
              <span>Grupo: {item.grupo}</span>
              <span>Bimestre: {item.materia?.bimestre_pertenece}</span>
            </article>
          )) : <p className="empty-state">No hay grupos asignados todavía.</p>}
        </div>
      </section>

      <section id="docente-anuncios" className="card-panel teacher-section">
        <div className="section-heading"><h3>Publicar anuncios</h3><p>Genera avisos rápidos para tus grupos o para una materia específica.</p></div>
        <form className="form-grid teacher-form" onSubmit={handleCreateAnuncio}>
          <label>Título<input id="anuncio-titulo" name="titulo" type="text" value={anuncioForm.titulo} onChange={(event) => setAnuncioForm((prev) => ({ ...prev, titulo: event.target.value }))} required /></label>
          <label>Descripción<textarea id="anuncio-descripcion" name="descripcion" value={anuncioForm.descripcion} onChange={(event) => setAnuncioForm((prev) => ({ ...prev, descripcion: event.target.value }))} rows="4" required /></label>
          <CustomDropdown
            label="Dirigidos a la materia..."
            value={anuncioForm.id_materia}
            options={anuncioOptions}
            onChange={(nextValue) => setAnuncioForm((prev) => ({ ...prev, id_materia: nextValue }))}
            placeholder="Anuncio general para todos mis grupos"
          />
          <button type="submit" className="btn-primary mini-action-button teacher-action-button">Publicar anuncio</button>
        </form>
        <div className="teacher-list">
          {dashboard.anuncios?.map((item) => (
            <article key={item.id_anuncio} className="teacher-list-item">
              <strong>{item.titulo}</strong>
              <p>{item.descripcion}</p>
              <span>{formatDate(item.fecha_publicacion, true)}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="docente-tareas" className="card-panel teacher-section">
        <div className="section-heading"><h3>Crear y programar tareas</h3><p>Define actividades por materia con fecha límite y adjuntos opcionales.</p></div>
        <form className="form-grid teacher-form" onSubmit={handleCreateTarea}>
          <CustomDropdown
            label="Materia"
            value={tareaForm.id_materia}
            options={[{ value: '', label: 'Selecciona una materia' }, ...materiaOptions]}
            onChange={(nextValue) => setTareaForm((prev) => ({ ...prev, id_materia: nextValue }))}
            placeholder="Selecciona una materia"
          />
          <label>Título<input id="tarea-titulo" name="titulo" type="text" value={tareaForm.titulo} onChange={(event) => setTareaForm((prev) => ({ ...prev, titulo: event.target.value }))} required /></label>
          <label>Descripción<textarea id="tarea-descripcion" name="descripcion" rows="4" value={tareaForm.descripcion} onChange={(event) => setTareaForm((prev) => ({ ...prev, descripcion: event.target.value }))} required /></label>
          <label className="teacher-datetime-field">Fecha y hora límite<input id="tarea-fecha-limite" name="fecha_limite" className="teacher-datetime-input" type="datetime-local" value={tareaForm.fecha_limite} onChange={(event) => setTareaForm((prev) => ({ ...prev, fecha_limite: event.target.value }))} required /></label>
          <label>Archivo adjunto opcional<input id="tarea-archivo-url" name="archivo_adjunto_url" type="url" value={tareaForm.archivo_adjunto_url} onChange={(event) => setTareaForm((prev) => ({ ...prev, archivo_adjunto_url: event.target.value }))} placeholder="https://..." /></label>
          <button type="submit" className="btn-primary mini-action-button teacher-action-button">Crear tarea</button>
        </form>
        <div className="teacher-card-grid">
          {tareas.length > 0 ? tareas.map((item) => (
            <article key={item.id_tarea} className="teacher-card">
              <strong>{item.titulo}</strong>
              <span>{item.materia?.nombre_materia}</span>
              <p>{item.descripcion}</p>
              <span>Límite: {formatDate(item.fecha_limite, true)}</span>
            </article>
          )) : <p className="empty-state">Aún no hay tareas publicadas.</p>}
        </div>
      </section>

      <section id="docente-entregas" className="card-panel teacher-section">
        <div className="section-heading"><h3>Calificar tareas</h3><p>Revisa entregas, retroalimenta y asigna calificaciones.</p></div>
        <div className="teacher-list">
          {entregas.length > 0 ? entregas.map((item) => (
            <article key={item.id_entrega} className="teacher-list-item teacher-evaluation-card">
              <div className="card-topline">
                <strong>{item.alumno?.usuario?.nombre_completo || 'Alumno'}</strong>
                <span className={`status-pill status-${item.estatus}`}>{item.estatus}</span>
              </div>
              <p>{item.tarea?.titulo} · {item.tarea?.materia?.nombre_materia}</p>
              <span>Entrega: {formatDate(item.fecha_entrega, true)}</span>
              <a href={item.archivo_entrega_url} target="_blank" rel="noreferrer">Abrir evidencia</a>
              <div className="teacher-grade-grid">
                <input id={`calificacion-${item.id_entrega}`} name={`calificacion_${item.id_entrega}`} type="number" min="0" max="10" step="0.1" placeholder="Calificación" value={grading[item.id_entrega]?.calificacion || ''} onChange={(event) => setGrading((prev) => ({ ...prev, [item.id_entrega]: { ...prev[item.id_entrega], calificacion: event.target.value } }))} />
                <textarea id={`retroalimentacion-${item.id_entrega}`} name={`retroalimentacion_${item.id_entrega}`} rows="3" placeholder="Retroalimentación" value={grading[item.id_entrega]?.retroalimentacion || ''} onChange={(event) => setGrading((prev) => ({ ...prev, [item.id_entrega]: { ...prev[item.id_entrega], retroalimentacion: event.target.value } }))} />
                <button type="button" className="btn-secondary alumno-inline-button teacher-secondary-action" onClick={() => handleCalificar(item.id_entrega)}>Guardar calificación</button>
              </div>
            </article>
          )) : <p className="empty-state">No hay entregas registradas para revisar.</p>}
        </div>
      </section>

      <section id="docente-asistencia" className="card-panel teacher-section">
        <div className="section-heading"><h3>Asistencia y aprovechamiento diario</h3><p>Registra control de clase dentro de la ventana reglamentaria institucional.</p></div>
        <form className="form-grid teacher-form" onSubmit={handleRegistroAsistencia}>
          <CustomDropdown
            label="Materia"
            value={asistenciaForm.id_materia}
            options={[{ value: '', label: 'Selecciona una materia' }, ...materiaOptions]}
            onChange={(nextValue) => setAsistenciaForm((prev) => ({ ...prev, id_materia: nextValue }))}
            placeholder="Selecciona una materia"
          />
          <label>ID alumno (opcional)<input id="asistencia-id-alumno" name="id_alumno" type="number" min="1" value={asistenciaForm.id_alumno} onChange={(event) => setAsistenciaForm((prev) => ({ ...prev, id_alumno: event.target.value }))} /></label>
          <label className="teacher-datetime-field">Fecha clase<input id="asistencia-fecha-clase" name="fecha_clase" className="teacher-datetime-input" type="datetime-local" value={asistenciaForm.fecha_clase} onChange={(event) => setAsistenciaForm((prev) => ({ ...prev, fecha_clase: event.target.value }))} /></label>
          <CustomDropdown
            label="Asistencia"
            value={asistenciaForm.estatus_asistencia}
            options={estatusAsistenciaOptions}
            onChange={(nextValue) => setAsistenciaForm((prev) => ({ ...prev, estatus_asistencia: nextValue }))}
            placeholder="Selecciona asistencia"
          />
          <CustomDropdown
            label="Aprovechamiento"
            value={asistenciaForm.aprovechamiento}
            options={aprovechamientoOptions}
            onChange={(nextValue) => setAsistenciaForm((prev) => ({ ...prev, aprovechamiento: nextValue }))}
            placeholder="Selecciona nivel"
          />
          <label>Observaciones<textarea id="asistencia-observaciones" name="observaciones" rows="3" value={asistenciaForm.observaciones} onChange={(event) => setAsistenciaForm((prev) => ({ ...prev, observaciones: event.target.value }))} /></label>
          <button type="submit" className="btn-primary mini-action-button teacher-action-button">Registrar control diario</button>
        </form>

        <div className="table-wrap dark-table">
          <table>
            <thead>
              <tr>
                <th>Materia</th>
                <th>Total</th>
                <th>Alto</th>
                <th>Medio</th>
                <th>Bajo</th>
              </tr>
            </thead>
            <tbody>
              {aprovechamiento.length > 0 ? aprovechamiento.map((item) => (
                <tr key={`apr-${item.id_materia}`}>
                  <td>{item.id_materia}</td>
                  <td>{item.total}</td>
                  <td>{item.alto}</td>
                  <td>{item.medio}</td>
                  <td>{item.bajo}</td>
                </tr>
              )) : <tr><td colSpan="5">Sin métricas de aprovechamiento registradas.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="table-wrap dark-table">
          <table>
            <thead>
              <tr>
                <th>Materia</th>
                <th>Alumno</th>
                <th>Fecha</th>
                <th>Asistencia</th>
                <th>Aprovechamiento</th>
              </tr>
            </thead>
            <tbody>
              {asistencias.length > 0 ? asistencias.map((item) => (
                <tr key={`asis-${item.id_registro}`}>
                  <td>{item.id_materia}</td>
                  <td>{item.id_alumno || 'General'}</td>
                  <td>{formatDate(item.fecha_clase, true)}</td>
                  <td>{item.estatus_asistencia}</td>
                  <td>{item.aprovechamiento}</td>
                </tr>
              )) : <tr><td colSpan="5">Sin registros de asistencia.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section id="docente-materiales" className="card-panel teacher-section">
        <div className="section-heading"><h3>Subir material de clase</h3><p>Publica diapositivas, libros digitales, resúmenes, PDFs y enlaces.</p></div>
        <form className="form-grid teacher-form" onSubmit={handleCreateMaterial}>
          <CustomDropdown
            label="Materia"
            value={materialForm.id_materia}
            options={[{ value: '', label: 'Selecciona una materia' }, ...materiaOptions]}
            onChange={(nextValue) => setMaterialForm((prev) => ({ ...prev, id_materia: nextValue }))}
            placeholder="Selecciona una materia"
          />
          <label>Tema o semana<input id="material-tema" name="tema_semana" type="text" value={materialForm.tema_semana} onChange={(event) => setMaterialForm((prev) => ({ ...prev, tema_semana: event.target.value }))} required /></label>
          <CustomDropdown
            label="Tipo de recurso"
            value={materialForm.tipo_archivo}
            options={tipoMaterialOptions}
            onChange={(nextValue) => setMaterialForm((prev) => ({ ...prev, tipo_archivo: nextValue }))}
            placeholder="Selecciona un tipo de recurso"
          />
          <label>URL del recurso<input id="material-url" name="archivo_url" type="url" value={materialForm.archivo_url} onChange={(event) => setMaterialForm((prev) => ({ ...prev, archivo_url: event.target.value }))} required /></label>
          <button type="submit" className="btn-primary mini-action-button teacher-action-button">Publicar material</button>
        </form>
        <div className="teacher-card-grid">
          {materiales.length > 0 ? materiales.map((item) => (
            <article key={item.id_material} className="teacher-card">
              <strong>{item.materia?.nombre_materia}</strong>
              <span>{item.tema_semana}</span>
              <span>{item.tipo_archivo}</span>
              <a href={item.archivo_url} target="_blank" rel="noreferrer">Abrir recurso</a>
            </article>
          )) : <p className="empty-state">No hay materiales cargados todavía.</p>}
        </div>
      </section>

      <section id="docente-portafolios" className="card-panel teacher-section">
        <div className="section-heading"><h3>Revisar portafolios de evidencia</h3><p>Consulta archivos finales por materia y bimestre enviados por el alumnado.</p></div>
        <div className="teacher-card-grid">
          {portafolios.length > 0 ? portafolios.map((item) => (
            <article key={item.id_evidencia} className="teacher-card">
              <strong>{item.alumno?.usuario?.nombre_completo || 'Alumno'}</strong>
              <span>{item.materia?.nombre_materia}</span>
              <span>Periodo {item.periodo_bimestre}</span>
              <a href={item.archivo_url} target="_blank" rel="noreferrer">Abrir evidencia</a>
            </article>
          )) : <p className="empty-state">No hay portafolios registrados para tus materias.</p>}
        </div>
      </section>

      <section id="docente-finales" className="card-panel teacher-section">
        <div className="section-heading"><h3>Calificaciones finales</h3><p>Resumen por alumno y materia para apoyo en el cierre del bimestre.</p></div>
        <div className="table-wrap dark-table">
          <table>
            <thead>
              <tr>
                <th>Alumno</th>
                <th>Folio</th>
                <th>Materia</th>
                <th>Promedio</th>
                <th>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {finales.length > 0 ? finales.map((item) => (
                <tr key={`${item.folio}-${item.materia}`}>
                  <td>{item.alumno}</td>
                  <td>{item.folio}</td>
                  <td>{item.materia}</td>
                  <td>{item.promedio}</td>
                  <td>{item.estatus}</td>
                </tr>
              )) : <tr><td colSpan="5">No hay calificaciones finales disponibles.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section id="docente-salas" className="card-panel teacher-section">
        <div className="section-heading"><h3>Clases en vivo</h3><p>Crea sesiones y, si no defines enlace, se genera automáticamente por plataforma.</p></div>
        <form className="form-grid teacher-form" onSubmit={handleCreateSala}>
          <label>Título<input id="sala-titulo" name="titulo" type="text" value={salaForm.titulo} onChange={(event) => setSalaForm((prev) => ({ ...prev, titulo: event.target.value }))} required /></label>
          <label>Plataforma<input id="sala-plataforma" name="plataforma" type="text" value={salaForm.plataforma} onChange={(event) => setSalaForm((prev) => ({ ...prev, plataforma: event.target.value }))} required /></label>
          <label>Enlace (opcional)<input id="sala-enlace" name="enlace" type="url" value={salaForm.enlace} onChange={(event) => setSalaForm((prev) => ({ ...prev, enlace: event.target.value }))} placeholder="Si lo dejas vacío, se autogenera" /></label>
          <label className="teacher-datetime-field">Fecha programada<input id="sala-fecha-programada" name="fecha_programada" className="teacher-datetime-input" type="datetime-local" value={salaForm.fecha_programada} onChange={(event) => setSalaForm((prev) => ({ ...prev, fecha_programada: event.target.value }))} required /></label>
          <button type="submit" className="btn-primary mini-action-button teacher-action-button">Crear sala</button>
        </form>
        <div className="teacher-list">
          {dashboard.salas_video?.map((item) => (
            <article key={item.id_sala} className="teacher-list-item">
              <strong>{item.titulo}</strong>
              <p>{item.plataforma} · {formatDate(item.fecha_programada, true)}</p>
              <a href={item.enlace} target="_blank" rel="noreferrer">Entrar a la sala</a>
            </article>
          ))}
        </div>
      </section>

      <section id="docente-justificantes" className="card-panel teacher-section">
        <div className="section-heading"><h3>Notificaciones y justificantes preaprobados</h3><p>Consulta justificantes médicos o personales previamente resueltos por la institución.</p></div>
        <div className="teacher-list">
          {justificantes.length > 0 ? justificantes.map((item) => (
            <article key={`jus-${item.id_tramite}`} className="teacher-list-item">
              <strong>{item.alumno?.usuario?.nombre_completo || `Alumno ${item.id_alumno}`}</strong>
              <p>{item.descripcion}</p>
              <span>Estatus: {item.estatus} · Tipo: {item.tipo}</span>
              <span>Resolución: {formatDate(item.fecha_resolucion, true)}</span>
              <span>Respuesta: {item.respuesta || 'Sin respuesta institucional'}</span>
            </article>
          )) : <p className="empty-state">No hay justificantes preaprobados para tus grupos.</p>}
        </div>
      </section>

      {loading ? <p className="student-loading">Cargando panel docente...</p> : null}
    </section>
  );
}
