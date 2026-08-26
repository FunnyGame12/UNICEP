import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
import './DocentePage.css';

const tabs = [
  { id: 'aula', label: 'Aula Virtual' },
  { id: 'vivo', label: 'Clases en Vivo' },
  { id: 'registro', label: 'Registro y Asistencia' },
  { id: 'avisos', label: 'Avisos y Justificantes' },
];

const tareaSchema = z.object({
  titulo: z.string().trim().min(3, 'Ingresa un titulo.'),
  descripcion: z.string().trim().min(8, 'Ingresa una descripcion mas completa.'),
  fecha_limite: z.string().min(1, 'Selecciona fecha limite.'),
  puntaje_maximo: z.preprocess(
    (value) => (value === '' || value == null ? NaN : Number(value)),
    z.number().positive('El puntaje debe ser mayor a 0.').min(1, 'El puntaje minimo es 1.'),
  ),
  archivo_adjunto_url: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const date = new Date(data.fecha_limite);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fecha_limite'],
      message: 'La fecha limite debe ser futura.',
    });
  }
});

const materialSchema = z.object({
  titulo: z.string().trim().min(3, 'Ingresa titulo de recurso.'),
  descripcion: z.string().trim().optional(),
  tipo_recurso: z.enum(['pdf', 'enlace', 'diapositivas', 'libro', 'resumen']),
  recurso_url: z.string().url('Ingresa una URL valida.'),
});

const calificacionSchema = z.object({
  calificacion: z.preprocess(
    (value) => (value === '' || value == null ? NaN : Number(value)),
    z.number().min(0, 'Minimo 0.00').max(10, 'Maximo 10.00'),
  ),
  retroalimentacion: z.string().trim().optional(),
});

const sesionSchema = z.object({
  titulo: z.string().trim().min(3, 'Ingresa titulo de la sesion.'),
  fecha_hora: z.string().min(1, 'Selecciona fecha y hora.'),
  enlace_reunion: z.string().url('Ingresa un enlace valido.'),
  plataforma: z.string().trim().min(2, 'Indica la plataforma.'),
}).superRefine((data, ctx) => {
  const date = new Date(data.fecha_hora);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fecha_hora'],
      message: 'La fecha de sesion debe ser futura.',
    });
  }
});

const asistenciaSchema = z.object({
  alumno_id: z.string().min(1, 'Selecciona un alumno.'),
  fecha: z.string().min(1, 'Selecciona fecha de clase.'),
  estatus: z.enum(['presente', 'falta', 'retardo', 'justificado']),
});

const parcialSchema = z.object({
  parcial_numero: z.preprocess(
    (value) => (value === '' || value == null ? NaN : Number(value)),
    z.number().int().min(1, 'Parcial minimo 1').max(10, 'Parcial maximo 10'),
  ),
  calificacion: z.preprocess(
    (value) => (value === '' || value == null ? NaN : Number(value)),
    z.number().min(0, 'Minimo 0').max(10, 'Maximo 10'),
  ),
  retroalimentacion: z.string().trim().optional(),
});

const avisoSchema = z.object({
  titulo: z.string().trim().min(3, 'Ingresa un titulo.'),
  descripcion: z.string().trim().min(6, 'Escribe el aviso para el grupo.'),
});

function formatDate(value, withTime = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(value));
}

function countdownLabel(target) {
  if (!target) return 'Sin fecha programada';
  const ms = new Date(target).getTime() - Date.now();
  if (Number.isNaN(ms)) return 'Fecha invalida';
  if (ms <= 0) return 'Inicia en breve';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m restantes`;
}

export default function DocentePage() {
  const [activeTab, setActiveTab] = useState('aula');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [misMaterias, setMisMaterias] = useState([]);
  const [selectedAsignacionId, setSelectedAsignacionId] = useState('');

  const [tareas, setTareas] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [justificantes, setJustificantes] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [entregasByTarea, setEntregasByTarea] = useState({});
  const [gradingDrafts, setGradingDrafts] = useState({});

  const [selectedTareaId, setSelectedTareaId] = useState('');
  const [asistenciaPorAlumno, setAsistenciaPorAlumno] = useState({});
  const [parcialPorAlumno, setParcialPorAlumno] = useState({});

  const tareaForm = useForm({
    resolver: zodResolver(tareaSchema),
    defaultValues: {
      titulo: '',
      descripcion: '',
      fecha_limite: '',
      puntaje_maximo: 10,
      archivo_adjunto_url: '',
    },
  });

  const materialForm = useForm({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      titulo: '',
      descripcion: '',
      tipo_recurso: 'pdf',
      recurso_url: '',
    },
  });

  const sesionForm = useForm({
    resolver: zodResolver(sesionSchema),
    defaultValues: {
      titulo: '',
      fecha_hora: '',
      enlace_reunion: '',
      plataforma: 'Google Meet',
    },
  });

  const avisoForm = useForm({
    resolver: zodResolver(avisoSchema),
    defaultValues: {
      titulo: '',
      descripcion: '',
    },
  });

  const selectedAsignacion = useMemo(
    () => misMaterias.find((item) => String(item.id_asignacion) === String(selectedAsignacionId)) || null,
    [misMaterias, selectedAsignacionId],
  );

  async function loadMisMaterias() {
    const response = await api.get('/docente/mis-materias');
    const items = response?.data?.items || [];
    setMisMaterias(items);
    if (!selectedAsignacionId && items[0]) {
      setSelectedAsignacionId(String(items[0].id_asignacion));
    }
    return items;
  }

  async function loadContextData(asignacion) {
    if (!asignacion) {
      setTareas([]);
      setSesiones([]);
      setAlumnos([]);
      setJustificantes([]);
      setAvisos([]);
      setSelectedTareaId('');
      return;
    }

    const materiaId = Number(asignacion.materia_id);
    const grupoId = String(asignacion.grupo_id);

    const [tareasResp, sesionesResp, alumnosResp, justificantesResp, avisosResp] = await Promise.all([
      api.get(`/docente/materias/${materiaId}/tareas`),
      api.get(`/docente/materias/${materiaId}/sesiones-en-vivo`),
      api.get(`/docente/grupos/${encodeURIComponent(grupoId)}/materias/${materiaId}/alumnos`),
      api.get('/docente/justificantes-recibidos'),
      api.get('/docente/avisos-grupales'),
    ]);

    const tareasItems = tareasResp?.data?.items || [];
    setTareas(tareasItems);
    setSesiones(sesionesResp?.data?.items || []);
    setAlumnos(alumnosResp?.data?.items || []);
    setJustificantes(justificantesResp?.data?.items || []);
    setAvisos(avisosResp?.data?.items || []);

    const firstTarea = tareasItems[0];
    setSelectedTareaId(firstTarea ? String(firstTarea.id_tarea) : '');
  }

  async function loadInitialData() {
    setLoading(true);
    setError('');

    try {
      const materiasItems = await loadMisMaterias();
      const current = materiasItems.find((item) => String(item.id_asignacion) === String(selectedAsignacionId)) || materiasItems[0] || null;
      await loadContextData(current);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el panel docente.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedAsignacion) return;
    loadContextData(selectedAsignacion).catch((requestError) => {
      setError(requestError?.response?.data?.message || 'No se pudo actualizar el contexto docente.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsignacionId]);

  useEffect(() => {
    async function loadEntregas() {
      if (!selectedTareaId) return;
      try {
        const response = await api.get(`/docente/tareas/${Number(selectedTareaId)}/entregas`);
        setEntregasByTarea((prev) => ({
          ...prev,
          [selectedTareaId]: response?.data?.items || [],
        }));
      } catch {
        setEntregasByTarea((prev) => ({ ...prev, [selectedTareaId]: [] }));
      }
    }

    loadEntregas();
  }, [selectedTareaId]);

  const entregasActivas = useMemo(
    () => entregasByTarea[selectedTareaId] || [],
    [entregasByTarea, selectedTareaId],
  );

  async function submitTarea(values) {
    if (!selectedAsignacion) return;
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post(`/docente/materias/${Number(selectedAsignacion.materia_id)}/tareas`, {
        ...values,
        grupo_id: selectedAsignacion.grupo_id,
      });
      tareaForm.reset({ titulo: '', descripcion: '', fecha_limite: '', puntaje_maximo: 10, archivo_adjunto_url: '' });
      setMessage('Tarea publicada correctamente.');
      await loadContextData(selectedAsignacion);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo crear la tarea.');
    } finally {
      setSending(false);
    }
  }

  async function submitMaterial(values) {
    if (!selectedAsignacion) return;
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post(`/docente/materias/${Number(selectedAsignacion.materia_id)}/materiales`, {
        ...values,
        grupo_id: selectedAsignacion.grupo_id,
      });
      materialForm.reset({ titulo: '', descripcion: '', tipo_recurso: 'pdf', recurso_url: '' });
      setMessage('Material didactico publicado.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo publicar el material.');
    } finally {
      setSending(false);
    }
  }

  async function submitCalificacion(entregaId, payload) {
    const parsed = calificacionSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Calificacion invalida.');
      return;
    }

    setError('');
    setMessage('');
    try {
      await api.put(`/docente/entregas/${Number(entregaId)}/calificar`, parsed.data);
      setMessage('Entrega calificada correctamente.');
      const response = await api.get(`/docente/tareas/${Number(selectedTareaId)}/entregas`);
      setEntregasByTarea((prev) => ({ ...prev, [selectedTareaId]: response?.data?.items || [] }));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo calificar la entrega.');
    }
  }

  async function submitSesion(values) {
    if (!selectedAsignacion) return;
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post(`/docente/materias/${Number(selectedAsignacion.materia_id)}/sesiones-en-vivo`, {
        ...values,
        grupo_id: selectedAsignacion.grupo_id,
      });
      sesionForm.reset({ titulo: '', fecha_hora: '', enlace_reunion: '', plataforma: 'Google Meet' });
      setMessage('Sesion en vivo programada.');
      await loadContextData(selectedAsignacion);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo programar la sesion.');
    } finally {
      setSending(false);
    }
  }

  async function submitAsistencia(alumnoId) {
    if (!selectedAsignacion) return;

    const draft = asistenciaPorAlumno[alumnoId] || {
      alumno_id: String(alumnoId),
      fecha: new Date().toISOString().slice(0, 10),
      estatus: 'presente',
    };

    const parsed = asistenciaSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Asistencia invalida.');
      return;
    }

    setError('');
    setMessage('');
    try {
      await api.post('/docente/asistencia', {
        ...parsed.data,
        materia_id: Number(selectedAsignacion.materia_id),
      });
      setMessage('Asistencia registrada.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar la asistencia.');
    }
  }

  async function submitParcial(alumnoId) {
    if (!selectedAsignacion) return;

    const draft = parcialPorAlumno[alumnoId] || { parcial_numero: 1, calificacion: '', retroalimentacion: '' };
    const parsed = parcialSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Calificacion parcial invalida.');
      return;
    }

    setError('');
    setMessage('');
    try {
      await api.put('/docente/calificaciones/parcial', {
        materia_id: Number(selectedAsignacion.materia_id),
        grupo_id: selectedAsignacion.grupo_id,
        parcial_numero: parsed.data.parcial_numero,
        alumno_id: Number(alumnoId),
        calificacion: parsed.data.calificacion,
        retroalimentacion: parsed.data.retroalimentacion || undefined,
      });
      setMessage('Calificacion parcial guardada.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar la calificacion parcial.');
    }
  }

  async function enviarActaCoordinacion() {
    if (!selectedAsignacion) return;
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/docente/actas/enviar-a-coordinacion', {
        materia_id: Number(selectedAsignacion.materia_id),
        grupo_id: selectedAsignacion.grupo_id,
      });
      setMessage('Acta enviada a Coordinacion Academica.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo enviar el acta.');
    } finally {
      setSending(false);
    }
  }

  async function submitAviso(values) {
    if (!selectedAsignacion) return;
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/docente/avisos-grupales', {
        ...values,
        materia_id: Number(selectedAsignacion.materia_id),
        grupo_id: selectedAsignacion.grupo_id,
      });
      avisoForm.reset({ titulo: '', descripcion: '' });
      setMessage('Aviso grupal publicado.');
      await loadContextData(selectedAsignacion);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo publicar el aviso grupal.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="docente-page">
      <header className="docente-header">
        <p className="docente-eyebrow">Cuerpo Docente UNICEP</p>
        <h2>Panel Operativo del Docente</h2>
        <p>Administra tareas, sesiones, asistencia, parciales, actas y avisos de tus grupos asignados.</p>
      </header>

      <article className="docente-card docente-context-card">
        <label htmlFor="docente-contexto">Materia y Grupo Activo</label>
        <select
          id="docente-contexto"
          value={selectedAsignacionId}
          onChange={(event) => setSelectedAsignacionId(event.target.value)}
        >
          {misMaterias.length === 0 ? <option value="">Sin materias asignadas</option> : null}
          {misMaterias.map((item) => (
            <option key={item.id_asignacion} value={String(item.id_asignacion)}>
              [{item.materia?.carrera || 'Programa'}] {item.materia?.nombre_materia} · Grupo {item.grupo_id}
            </option>
          ))}
        </select>
      </article>

      <div className="docente-tabs" role="tablist" aria-label="Secciones operativas">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="error-box">{error}</p> : null}
      {message ? <p className="ok-box">{message}</p> : null}
      {loading ? <p className="docente-loading">Cargando modulo docente...</p> : null}

      {activeTab === 'aula' ? (
        <div className="docente-grid-2">
          <article className="docente-card">
            <h3>Nueva Tarea</h3>
            <form className="docente-form" onSubmit={tareaForm.handleSubmit(submitTarea)}>
              <label htmlFor="doc-titulo">Titulo</label>
              <input id="doc-titulo" {...tareaForm.register('titulo')} />

              <label htmlFor="doc-desc">Descripcion</label>
              <textarea id="doc-desc" rows="3" {...tareaForm.register('descripcion')} />

              <label htmlFor="doc-fecha">Fecha limite</label>
              <input id="doc-fecha" type="datetime-local" {...tareaForm.register('fecha_limite')} />

              <label htmlFor="doc-puntaje">Puntaje maximo</label>
              <input id="doc-puntaje" type="number" step="0.1" min="1" {...tareaForm.register('puntaje_maximo')} />

              <label htmlFor="doc-adjunto">Archivo adjunto (opcional)</label>
              <input id="doc-adjunto" type="url" placeholder="https://..." {...tareaForm.register('archivo_adjunto_url')} />

              <button type="submit" className="btn-primary" disabled={!selectedAsignacion || sending}>Publicar tarea</button>
            </form>

            <h3>Nuevo Material</h3>
            <form className="docente-form" onSubmit={materialForm.handleSubmit(submitMaterial)}>
              <label htmlFor="doc-material-titulo">Titulo del recurso</label>
              <input id="doc-material-titulo" {...materialForm.register('titulo')} />

              <label htmlFor="doc-material-desc">Descripcion</label>
              <textarea id="doc-material-desc" rows="2" {...materialForm.register('descripcion')} />

              <label htmlFor="doc-material-tipo">Tipo</label>
              <select id="doc-material-tipo" {...materialForm.register('tipo_recurso')}>
                <option value="pdf">PDF</option>
                <option value="enlace">Enlace</option>
                <option value="diapositivas">Diapositivas</option>
                <option value="libro">Libro</option>
                <option value="resumen">Resumen</option>
              </select>

              <label htmlFor="doc-material-url">URL</label>
              <input id="doc-material-url" type="url" placeholder="https://..." {...materialForm.register('recurso_url')} />

              <button type="submit" className="btn-secondary" disabled={!selectedAsignacion || sending}>Publicar material</button>
            </form>
          </article>

          <article className="docente-card">
            <h3>Tareas Activas</h3>
            {tareas.length === 0 ? (
              <p className="docente-empty">Sin tareas asignadas para este contexto.</p>
            ) : (
              <div className="docente-list">
                {tareas.map((tarea) => (
                  <button
                    type="button"
                    key={tarea.id_tarea}
                    className={`docente-list-item ${String(selectedTareaId) === String(tarea.id_tarea) ? 'is-selected' : ''}`}
                    onClick={() => setSelectedTareaId(String(tarea.id_tarea))}
                  >
                    <strong>{tarea.titulo}</strong>
                    <span>{`Grupo ${tarea.grupo_id || selectedAsignacion?.grupo_id} · Puntaje ${tarea.puntaje_maximo}`}</span>
                    <span>{`Pendientes por revisar: ${tarea.entregas_pendientes || 0}`}</span>
                  </button>
                ))}
              </div>
            )}

            <h3>Entregas</h3>
            {entregasActivas.length === 0 ? (
              <p className="docente-empty">Sin entregas pendientes para la tarea seleccionada.</p>
            ) : (
              <div className="docente-list">
                {entregasActivas.map((item) => (
                  <article key={item.id_entrega} className="docente-list-item docente-delivery-item">
                    <strong>{item.alumno?.usuario?.nombre_completo || `Alumno ${item.id_alumno}`}</strong>
                    <span>{`Estatus: ${item.estatus} · Entrega: ${formatDate(item.fecha_entrega, true)}`}</span>
                    <a href={item.archivo_entrega_url} target="_blank" rel="noreferrer">Abrir evidencia</a>
                    <div className="docente-inline-grid">
                      <input
                        type="number"
                        min="0"
                        max="10"
                        step="0.01"
                        placeholder="Calificacion"
                        value={gradingDrafts[item.id_entrega]?.calificacion || ''}
                        onChange={(event) => {
                          setGradingDrafts((prev) => ({
                            ...prev,
                            [item.id_entrega]: {
                              ...prev[item.id_entrega],
                              calificacion: event.target.value,
                            },
                          }));
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Retroalimentacion"
                        value={gradingDrafts[item.id_entrega]?.retroalimentacion || ''}
                        onChange={(event) => {
                          setGradingDrafts((prev) => ({
                            ...prev,
                            [item.id_entrega]: {
                              ...prev[item.id_entrega],
                              retroalimentacion: event.target.value,
                            },
                          }));
                        }}
                      />
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => submitCalificacion(item.id_entrega, {
                          calificacion: gradingDrafts[item.id_entrega]?.calificacion,
                          retroalimentacion: gradingDrafts[item.id_entrega]?.retroalimentacion,
                        })}
                      >
                        Guardar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === 'vivo' ? (
        <div className="docente-grid-2">
          <article className="docente-card">
            <h3>Programar Sesion</h3>
            <form className="docente-form" onSubmit={sesionForm.handleSubmit(submitSesion)}>
              <label htmlFor="doc-ses-titulo">Titulo</label>
              <input id="doc-ses-titulo" {...sesionForm.register('titulo')} />

              <label htmlFor="doc-ses-fecha">Fecha y hora</label>
              <input id="doc-ses-fecha" type="datetime-local" {...sesionForm.register('fecha_hora')} />

              <label htmlFor="doc-ses-link">Enlace de reunion</label>
              <input id="doc-ses-link" type="url" placeholder="https://..." {...sesionForm.register('enlace_reunion')} />

              <label htmlFor="doc-ses-plat">Plataforma</label>
              <input id="doc-ses-plat" {...sesionForm.register('plataforma')} />

              <button type="submit" className="btn-primary" disabled={!selectedAsignacion || sending}>Programar</button>
            </form>
          </article>

          <article className="docente-card">
            <h3>Proximas Videoconferencias</h3>
            {sesiones.length === 0 ? (
              <p className="docente-empty">Sin clases en vivo programadas.</p>
            ) : (
              <div className="docente-list">
                {sesiones.map((item) => (
                  <article key={item.id_sala} className="docente-list-item">
                    <strong>{item.titulo}</strong>
                    <span>{`${item.plataforma} · ${formatDate(item.fecha_programada, true)}`}</span>
                    <span>{countdownLabel(item.fecha_programada)}</span>
                    <div className="docente-session-actions">
                      <a href={item.enlace} target="_blank" rel="noreferrer" className="btn-secondary">Abrir</a>
                      <button type="button" className="btn-secondary" onClick={() => navigator.clipboard.writeText(item.enlace)}>Copiar enlace</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === 'registro' ? (
        <article className="docente-card">
          <h3>Lista de Alumnos · Asistencia y Parciales</h3>
          {alumnos.length === 0 ? (
            <p className="docente-empty">Sin alumnos inscritos en este grupo/materia.</p>
          ) : (
            <div className="table-wrap dark-table">
              <table>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Asistencia</th>
                    <th>Calificacion Parcial</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.map((row) => {
                    const alumno = row.alumno?.usuario;
                    const asist = asistenciaPorAlumno[row.id_alumno] || {
                      alumno_id: String(row.id_alumno),
                      fecha: new Date().toISOString().slice(0, 10),
                      estatus: 'presente',
                    };
                    const parcial = parcialPorAlumno[row.id_alumno] || {
                      parcial_numero: 1,
                      calificacion: '',
                      retroalimentacion: '',
                    };

                    return (
                      <tr key={row.id_alumno_grupo}>
                        <td>
                          <strong>{alumno?.nombre_completo || `Alumno ${row.id_alumno}`}</strong>
                          <p>{alumno?.folio_matricula || 'SIN-FOLIO'}</p>
                        </td>
                        <td>
                          <div className="docente-inline-grid">
                            <input
                              type="date"
                              value={asist.fecha}
                              onChange={(event) => setAsistenciaPorAlumno((prev) => ({
                                ...prev,
                                [row.id_alumno]: { ...asist, fecha: event.target.value },
                              }))}
                            />
                            <select
                              value={asist.estatus}
                              onChange={(event) => setAsistenciaPorAlumno((prev) => ({
                                ...prev,
                                [row.id_alumno]: { ...asist, estatus: event.target.value },
                              }))}
                            >
                              <option value="presente">Presente</option>
                              <option value="falta">Falta</option>
                              <option value="retardo">Retardo</option>
                              <option value="justificado">Justificado</option>
                            </select>
                          </div>
                        </td>
                        <td>
                          <div className="docente-inline-grid">
                            <input
                              type="number"
                              min="1"
                              max="10"
                              step="1"
                              value={parcial.parcial_numero}
                              onChange={(event) => setParcialPorAlumno((prev) => ({
                                ...prev,
                                [row.id_alumno]: { ...parcial, parcial_numero: event.target.value },
                              }))}
                              placeholder="Parcial"
                            />
                            <input
                              type="number"
                              min="0"
                              max="10"
                              step="0.01"
                              value={parcial.calificacion}
                              onChange={(event) => setParcialPorAlumno((prev) => ({
                                ...prev,
                                [row.id_alumno]: { ...parcial, calificacion: event.target.value },
                              }))}
                              placeholder="0.00 - 10.00"
                            />
                            <input
                              type="text"
                              value={parcial.retroalimentacion}
                              onChange={(event) => setParcialPorAlumno((prev) => ({
                                ...prev,
                                [row.id_alumno]: { ...parcial, retroalimentacion: event.target.value },
                              }))}
                              placeholder="Retroalimentacion"
                            />
                          </div>
                        </td>
                        <td>
                          <div className="docente-inline-grid">
                            <button type="button" className="btn-secondary" onClick={() => submitAsistencia(row.id_alumno)}>Guardar asistencia</button>
                            <button type="button" className="btn-secondary" onClick={() => submitParcial(row.id_alumno)}>Guardar parcial</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="docente-actions-row">
            <button type="button" className="btn-primary" onClick={enviarActaCoordinacion} disabled={!selectedAsignacion || sending}>
              Enviar Acta a Coordinacion
            </button>
          </div>
        </article>
      ) : null}

      {activeTab === 'avisos' ? (
        <div className="docente-grid-2">
          <article className="docente-card">
            <h3>Publicar Aviso Grupal</h3>
            <form className="docente-form" onSubmit={avisoForm.handleSubmit(submitAviso)}>
              <label htmlFor="doc-aviso-title">Titulo</label>
              <input id="doc-aviso-title" {...avisoForm.register('titulo')} />

              <label htmlFor="doc-aviso-desc">Mensaje</label>
              <textarea id="doc-aviso-desc" rows="3" {...avisoForm.register('descripcion')} />

              <button type="submit" className="btn-primary" disabled={!selectedAsignacion || sending}>Publicar aviso</button>
            </form>

            <h3>Avisos recientes</h3>
            {avisos.length === 0 ? (
              <p className="docente-empty">Sin avisos grupales recientes.</p>
            ) : (
              <div className="docente-list">
                {avisos.map((item) => (
                  <article key={item.id_anuncio} className="docente-list-item">
                    <strong>{item.titulo}</strong>
                    <span>{item.materia?.nombre_materia || 'General'} · {formatDate(item.fecha_publicacion, true)}</span>
                    <p>{item.descripcion}</p>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="docente-card">
            <h3>Justificantes Recibidos</h3>
            {justificantes.length === 0 ? (
              <p className="docente-empty">Sin justificantes institucionales vinculados a tus alumnos.</p>
            ) : (
              <div className="docente-list">
                {justificantes.map((item) => (
                  <article key={item.id_tramite} className="docente-list-item">
                    <strong>{item.alumno?.usuario?.nombre_completo || `Alumno ${item.id_alumno}`}</strong>
                    <span>{`Tipo: ${item.tipo} · Estatus: ${item.estatus}`}</span>
                    <p>{item.descripcion || 'Sin descripcion'}</p>
                    <span>{`Resuelto: ${formatDate(item.fecha_resolucion, true)}`}</span>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}
    </section>
  );
}
