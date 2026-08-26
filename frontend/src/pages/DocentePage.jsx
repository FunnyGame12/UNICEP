import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import './DocentePage.css';

const tabs = [
  { id: 'asistencia', label: 'Control de Asistencia' },
  { id: 'calificaciones', label: 'Calificaciones y Cierre de Actas' },
  { id: 'avisos', label: 'Avisos y Justificantes' },
];

const statusOptions = [
  { value: 'presente', label: 'Presente', className: 'is-present' },
  { value: 'falta', label: 'Falta', className: 'is-missing' },
  { value: 'retardo', label: 'Retardo', className: 'is-late' },
  { value: 'justificado', label: 'Justificado', className: 'is-justified' },
];

function formatDate(value, withTime = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(value));
}

export default function DocentePage() {
  const [activeTab, setActiveTab] = useState('asistencia');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [actaCerrada, setActaCerrada] = useState(false);

  const [misMaterias, setMisMaterias] = useState([]);
  const [selectedAsignacionId, setSelectedAsignacionId] = useState('');
  const [selectedAsignacion, setSelectedAsignacion] = useState(null);

  const [alumnos, setAlumnos] = useState([]);
  const [justificantes, setJustificantes] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [asistenciaPorAlumno, setAsistenciaPorAlumno] = useState({});
  const [calificacionesPorAlumno, setCalificacionesPorAlumno] = useState({});

  const selectedMateria = useMemo(
    () => (selectedAsignacion ? Number(selectedAsignacion.materia_id) : null),
    [selectedAsignacion],
  );

  useEffect(() => {
    if (!message && !error) return undefined;
    const timer = setTimeout(() => {
      setMessage('');
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, error]);

  useEffect(() => {
    let isMounted = true;

    async function loadContextData() {
      try {
        setLoading(true);
        const response = await api.get('/docente/mis-materias');
        const items = response?.data?.items || [];

        if (!isMounted) return;

        setMisMaterias(items);
        const nextSelection = items.find((item) => String(item.id_asignacion) === String(selectedAsignacionId)) || items[0] || null;
        setSelectedAsignacion(nextSelection);
        setSelectedAsignacionId(nextSelection ? String(nextSelection.id_asignacion) : '');

        if (!nextSelection) {
          setAlumnos([]);
          setJustificantes([]);
          setAvisos([]);
          setAsistenciaPorAlumno({});
          setCalificacionesPorAlumno({});
          return;
        }

        const materiaId = Number(nextSelection.materia_id);
        const grupoId = String(nextSelection.grupo_id);
        const [alumnosResp, justificantesResp, avisosResp] = await Promise.all([
          api.get(`/docente/grupos/${encodeURIComponent(grupoId)}/materias/${materiaId}/alumnos`),
          api.get('/docente/justificantes-recibidos'),
          api.get('/docente/avisos-grupales'),
        ]);

        if (!isMounted) return;

        const alumnosItems = alumnosResp?.data?.items || [];
        setAlumnos(alumnosItems);
        setJustificantes(justificantesResp?.data?.items || []);
        setAvisos(avisosResp?.data?.items || []);

        setAsistenciaPorAlumno((prev) => {
          const next = { ...prev };
          alumnosItems.forEach((row) => {
            if (!next[row.id_alumno]) {
              next[row.id_alumno] = { status: 'presente' };
            }
          });
          return next;
        });

        setCalificacionesPorAlumno((prev) => {
          const next = { ...prev };
          alumnosItems.forEach((row) => {
            if (!next[row.id_alumno]) {
              next[row.id_alumno] = {
                parcial_1: '',
                parcial_2: '',
                proyecto_final: '',
                definitiva: '',
              };
            }
          });
          return next;
        });
      } catch (requestError) {
        if (isMounted) {
          setError(requestError?.response?.data?.message || 'No se pudo cargar el panel docente.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadContextData();
    return () => {
      isMounted = false;
    };
  }, [selectedAsignacionId]);

  async function guardarAsistencia(alumnoId) {
    if (!selectedAsignacion) return;
    const draft = asistenciaPorAlumno[alumnoId] || { status: 'presente' };

    try {
      setSending(true);
      setError('');
      await api.post('/docente/asistencia', {
        alumno_id: Number(alumnoId),
        materia_id: Number(selectedAsignacion.materia_id),
        fecha: new Date().toISOString().slice(0, 10),
        estatus: draft.status || 'presente',
      });
      setMessage('Asistencia guardada correctamente.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar la asistencia.');
    } finally {
      setSending(false);
    }
  }

  function handleGradeChange(alumnoId, field, value) {
    setCalificacionesPorAlumno((prev) => {
      const current = prev[alumnoId] || {
        parcial_1: '',
        parcial_2: '',
        proyecto_final: '',
        definitiva: '',
      };
      const nextValue = value === '' ? '' : Math.min(10, Math.max(0, Number(value)));
      const updated = { ...current, [field]: nextValue };

      if (field !== 'definitiva') {
        const partialScores = [
          Number(updated.parcial_1 ?? 0),
          Number(updated.parcial_2 ?? 0),
          Number(updated.proyecto_final ?? 0),
        ].filter((number) => Number.isFinite(number));

        updated.definitiva = partialScores.length > 0
          ? (partialScores.reduce((sum, item) => sum + item, 0) / partialScores.length).toFixed(1)
          : '';
      }

      return { ...prev, [alumnoId]: updated };
    });
  }

  async function guardarCalificacion(alumnoId, field) {
    if (!selectedAsignacion) return;
    const current = calificacionesPorAlumno[alumnoId] || {};
    const rawValue = current[field];
    const value = rawValue === '' || rawValue === null || rawValue === undefined ? null : Number(rawValue);

    if (value === null) return;
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      setError('La calificación debe estar entre 0 y 10.');
      return;
    }

    const parcialMap = {
      parcial_1: 1,
      parcial_2: 2,
      proyecto_final: 3,
    };

    try {
      setSending(true);
      setError('');
      await api.put('/docente/calificaciones/parcial', {
        materia_id: Number(selectedAsignacion.materia_id),
        grupo_id: selectedAsignacion.grupo_id,
        parcial_numero: parcialMap[field],
        alumno_id: Number(alumnoId),
        calificacion: value,
        retroalimentacion: '',
      });
      setMessage('Calificación guardada correctamente.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar la calificación.');
    } finally {
      setSending(false);
    }
  }

  function handleGradeBlur(alumnoId, field) {
    const value = calificacionesPorAlumno[alumnoId]?.[field];
    if (value === '' || value === null || value === undefined) {
      return;
    }
    guardarCalificacion(alumnoId, field);
  }

  async function cerrarActa() {
    if (!selectedAsignacion) return;
    try {
      setSending(true);
      setError('');
      await api.post('/docente/actas/enviar-a-coordinacion', {
        materia_id: Number(selectedAsignacion.materia_id),
        grupo_id: selectedAsignacion.grupo_id,
      });
      setActaCerrada(true);
      setMessage('Acta enviada a Coordinación Académica.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cerrar el acta.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="docente-page">
      <header className="docente-header">
        <p className="docente-eyebrow">Cuerpo Docente UNICEP</p>
        <h2>Panel Académico del Docente</h2>
        <p>Control de asistencia, calificaciones y cierre de actas para tu materia asignada.</p>
      </header>

      <article className="docente-card docente-context-card">
        <label htmlFor="docente-contexto">Materia y Grupo activo</label>
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

      {error ? <p className="error-box sticky-toast">{error}</p> : null}
      {message ? <p className="ok-box sticky-toast">{message}</p> : null}
      {loading ? <p className="docente-loading">Cargando panel docente...</p> : null}

      {activeTab === 'asistencia' ? (
        <article className="docente-card">
          <h3>Control de Asistencia</h3>
          {alumnos.length === 0 ? (
            <p className="docente-empty">Sin alumnos asignados a este grupo. Contacte a Coordinación Académica.</p>
          ) : (
            <div className="table-wrap dark-table">
              <table>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Asistencia</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.map((row) => {
                    const alumno = row.alumno?.usuario;
                    const currentStatus = asistenciaPorAlumno[row.id_alumno]?.status || 'presente';

                    return (
                      <tr key={row.id_alumno_grupo}>
                        <td>
                          <strong>{alumno?.nombre_completo || `Alumno ${row.id_alumno}`}</strong>
                          <p>{alumno?.folio_matricula || 'Sin matrícula'}</p>
                        </td>
                        <td>
                          <div className="toggle-group">
                            {statusOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                className={currentStatus === option.value ? `toggle-btn ${option.className} active` : `toggle-btn ${option.className}`}
                                onClick={() => setAsistenciaPorAlumno((prev) => ({
                                  ...prev,
                                  [row.id_alumno]: { ...(prev[row.id_alumno] || {}), status: option.value },
                                }))}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td>
                          <button type="button" className="btn-secondary" onClick={() => guardarAsistencia(row.id_alumno)} disabled={sending}>
                            Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : null}

      {activeTab === 'calificaciones' ? (
        <article className="docente-card">
          <div className="docente-actions-row">
            <button type="button" className="btn-primary" onClick={cerrarActa} disabled={!selectedAsignacion || sending || actaCerrada}>
              {actaCerrada ? 'Acta cerrada' : 'Cerrar acta y enviar a coordinación'}
            </button>
          </div>

          {alumnos.length === 0 ? (
            <p className="docente-empty">Sin alumnos asignados a este grupo. Contacte a Coordinación Académica.</p>
          ) : (
            <div className="table-wrap dark-table">
              <table>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Parcial 1</th>
                    <th>Parcial 2</th>
                    <th>Proyecto Final</th>
                    <th>Calificación Final</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnos.map((row) => {
                    const alumno = row.alumno?.usuario;
                    const draft = calificacionesPorAlumno[row.id_alumno] || {
                      parcial_1: '',
                      parcial_2: '',
                      proyecto_final: '',
                      definitiva: '',
                    };

                    return (
                      <tr key={row.id_alumno_grupo}>
                        <td>
                          <strong>{alumno?.nombre_completo || `Alumno ${row.id_alumno}`}</strong>
                        </td>
                        {['parcial_1', 'parcial_2', 'proyecto_final', 'definitiva'].map((field) => (
                          <td key={`${row.id_alumno}-${field}`}>
                            <input
                              className="grade-input"
                              type="number"
                              min="0"
                              max="10"
                              step="0.1"
                              value={field === 'definitiva' ? (draft.definitiva || '') : (draft[field] ?? '')}
                              disabled={actaCerrada || field === 'definitiva'}
                              onChange={(event) => handleGradeChange(row.id_alumno, field, event.target.value)}
                              onBlur={() => handleGradeBlur(row.id_alumno, field)}
                              onKeyDown={(event) => {
                                if (event.key === 'Tab' || event.key === 'Enter') {
                                  event.preventDefault();
                                  const inputs = Array.from(document.querySelectorAll('.grade-input'));
                                  const currentIndex = inputs.indexOf(event.target);
                                  const next = inputs[currentIndex + 1];
                                  if (next) next.focus();
                                }
                              }}
                            />
                          </td>
                        ))}
                        <td>
                          <button
                            type="button"
                            className="save-mini"
                            onClick={() => {
                              ['parcial_1', 'parcial_2', 'proyecto_final'].forEach((field) => {
                                const value = calificacionesPorAlumno[row.id_alumno]?.[field];
                                if (value !== '' && value !== undefined && value !== null) {
                                  guardarCalificacion(row.id_alumno, field);
                                }
                              });
                            }}
                            disabled={sending || actaCerrada}
                          >
                            💾 Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </article>
      ) : null}

      {activeTab === 'avisos' ? (
        <div className="docente-grid-2">
          <article className="docente-card">
            <h3>Avisos institucionales</h3>
            {avisos.length === 0 ? (
              <p className="docente-empty">Sin avisos institucionales para este grupo o materia.</p>
            ) : (
              <div className="docente-list">
                {avisos.map((item) => (
                  <article key={item.id_anuncio} className="docente-list-item">
                    <strong>{item.titulo}</strong>
                    <span>{item.materia?.nombre_materia || 'Aviso general'} · {formatDate(item.fecha_publicacion, true)}</span>
                    <p>{item.descripcion}</p>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="docente-card">
            <h3>Justificantes médicos / administrativos</h3>
            {justificantes.length === 0 ? (
              <p className="docente-empty">No hay justificantes aprobados o solicitudes resueltas para tus alumnos.</p>
            ) : (
              <div className="docente-list">
                {justificantes.map((item) => (
                  <article key={item.id_tramite} className="docente-list-item">
                    <strong>{item.alumno?.usuario?.nombre_completo || `Alumno ${item.id_alumno}`}</strong>
                    <span>{item.tipo || 'Justificante'} · {item.estatus || 'Resuelto'}</span>
                    <p>{item.descripcion || 'Sin descripción del justificante.'}</p>
                    <small>{formatDate(item.fecha_resolucion || item.fecha_solicitud, true)}</small>
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
