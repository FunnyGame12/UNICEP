import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
import './AlumnoPage.css';

const tabs = [
  { id: 'dia', label: 'Mi Dia' },
  { id: 'calificaciones', label: 'Calificaciones' },
  { id: 'ventanilla', label: 'Ventanilla' },
  { id: 'perfil', label: 'Perfil y Alertas' },
];

const tramiteLabels = {
  constancia: 'Constancia',
  credencial: 'Credencial',
  uniforme: 'Uniforme',
  comprobante_pago: 'Comprobante de pago',
};

const estatusTramiteLabels = {
  recibido: 'Recibido',
  en_revision: 'En revision',
  en_proceso: 'En proceso',
  resuelto: 'Listo para entrega',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

const pagoSchema = z.object({
  id_concepto_pago: z.string().min(1, 'Selecciona un concepto de pago.'),
  monto_pagado: z.preprocess(
    (value) => (value === '' || value == null ? NaN : Number(value)),
    z.number().positive('El monto debe ser mayor a 0.'),
  ),
});

const tramiteSchema = z.object({
  tipo: z.enum(['constancia', 'credencial', 'uniforme']),
  descripcion: z.string().trim().optional(),
});

function formatDate(value, withTime = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(value));
}

function getUrgencyClass(hours) {
  if (hours == null) return 'urgency-normal';
  if (hours <= 6) return 'urgency-high';
  if (hours <= 24) return 'urgency-medium';
  return 'urgency-normal';
}

function getStatusBadgeClass(estatus) {
  if (estatus === 'resuelto') return 'badge-success';
  if (estatus === 'en_proceso' || estatus === 'en_revision') return 'badge-warn';
  if (estatus === 'rechazado' || estatus === 'cancelado') return 'badge-danger';
  return 'badge-neutral';
}

function resolveBackendFileUrl(filePath) {
  const raw = String(filePath || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const baseUrl = String(api.defaults.baseURL || '').trim();
  const absoluteBase = /^https?:\/\//i.test(baseUrl)
    ? baseUrl
    : `${window.location.origin}${baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`}`;

  try {
    return new URL(raw, absoluteBase).toString();
  } catch (_error) {
    return raw;
  }
}

export default function AlumnoPage() {
  const [activeTab, setActiveTab] = useState('dia');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [acceso, setAcceso] = useState(null);
  const [horario, setHorario] = useState([]);
  const [tareasPendientes, setTareasPendientes] = useState([]);
  const [materiales, setMateriales] = useState([]);
  const [calificaciones, setCalificaciones] = useState({ parciales: [], finales: [], resumen: [] });
  const [calificacionesBloqueadas, setCalificacionesBloqueadas] = useState(false);
  const [asistencia, setAsistencia] = useState({ items: [], acumulado: [] });
  const [historialTramites, setHistorialTramites] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [meritos, setMeritos] = useState([]);
  const [pagos, setPagos] = useState({ items: [], resumen: null });
  const [conceptosPago, setConceptosPago] = useState([]);

  const [openPagoAccordion, setOpenPagoAccordion] = useState(true);
  const [openTramiteAccordion, setOpenTramiteAccordion] = useState(false);

  const [entregaDrafts, setEntregaDrafts] = useState({});
  const [pagoArchivo, setPagoArchivo] = useState(null);
  const [tramiteArchivo, setTramiteArchivo] = useState(null);

  const pagoForm = useForm({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      id_concepto_pago: '',
      monto_pagado: '',
    },
  });

  const tramiteForm = useForm({
    resolver: zodResolver(tramiteSchema),
    defaultValues: {
      tipo: 'constancia',
      descripcion: '',
    },
  });

  function handleEntregaFileChange(tareaId, event) {
    const archivo = event.target.files?.[0] || null;
    setEntregaDrafts((prev) => ({
      ...prev,
      [tareaId]: {
        ...prev[tareaId],
        archivo,
      },
    }));
  }

  function handlePagoFileChange(event) {
    setPagoArchivo(event.target.files?.[0] || null);
  }

  function handleTramiteFileChange(event) {
    setTramiteArchivo(event.target.files?.[0] || null);
  }

  const primeraClase = useMemo(() => {
    if (horario.length === 0) return null;

    return [...horario]
      .sort((a, b) => {
        const aDate = a.sala_virtual?.fecha_programada ? new Date(a.sala_virtual.fecha_programada).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.sala_virtual?.fecha_programada ? new Date(b.sala_virtual.fecha_programada).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      })
      .find((item) => item.sala_virtual?.fecha_programada) || horario[0];
  }, [horario]);

  async function loadBase() {
    setLoading(true);
    setError('');

    try {
      const [estadoResp, pagosResp] = await Promise.all([
        api.get('/alumno/estado-acceso'),
        api.get('/alumno/pagos'),
      ]);

      setAcceso(estadoResp.data);
      setPagos(pagosResp.data || { items: [], resumen: null });

      const conceptosUnicos = [];
      const seen = new Set();
      (pagosResp.data?.items || []).forEach((item) => {
        if (!item.id_concepto_pago || seen.has(item.id_concepto_pago)) return;
        seen.add(item.id_concepto_pago);
        conceptosUnicos.push({
          id_concepto_pago: item.id_concepto_pago,
          nombre: item.concepto,
        });
      });
      setConceptosPago(conceptosUnicos);

      const [tramitesResp, meritosResp] = await Promise.all([
        api.get('/alumno/historial-tramites'),
        api.get('/alumno/meritos').catch(() => ({ data: { items: [] } })),
      ]);

      setHistorialTramites(tramitesResp.data?.items || []);
      setMeritos(meritosResp.data?.items || []);

      if (estadoResp.data?.bloqueo_plataforma) {
        setHorario([]);
        setTareasPendientes([]);
        setMateriales([]);
        setCalificaciones({ parciales: [], finales: [], resumen: [] });
        setAsistencia({ items: [], acumulado: [] });
        setNotificaciones([]);
        setCalificacionesBloqueadas(Boolean(estadoResp.data?.bloqueo_calificaciones));
        return;
      }

      const [horarioResp, tareasResp, materialesResp, asistenciaResp, notificacionesResp, calificacionesResp] = await Promise.all([
        api.get('/alumno/horario-aulas'),
        api.get('/alumno/tareas-pendientes'),
        api.get('/alumno/materiales-clase'),
        api.get('/alumno/asistencia'),
        api.get('/alumno/notificaciones'),
        api.get('/alumno/calificaciones').catch((requestError) => {
          if (requestError?.response?.status === 403) {
            setCalificacionesBloqueadas(true);
            return { data: { parciales: [], finales: [], resumen: [] } };
          }
          throw requestError;
        }),
      ]);

      setHorario(horarioResp.data?.items || []);
      setTareasPendientes(tareasResp.data?.items || []);
      setMateriales(materialesResp.data?.items || []);
      setAsistencia(asistenciaResp.data || { items: [], acumulado: [] });
      setNotificaciones(notificacionesResp.data?.items || []);
      setCalificaciones(calificacionesResp.data || { parciales: [], finales: [], resumen: [] });
      if (!calificacionesBloqueadas) {
        setCalificacionesBloqueadas(false);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el panel del alumno.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitComprobante(values) {
    if (!pagoArchivo) {
      setError('Debes seleccionar un archivo de comprobante (PDF o imagen).');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('archivo', pagoArchivo);
      formData.append('id_concepto_pago', String(Number(values.id_concepto_pago)));
      formData.append('monto_pagado', String(Number(values.monto_pagado)));
      formData.append('tipo_tramite', 'comprobante_pago');

      await api.post('/alumno/pagos/comprobantes', formData);

      pagoForm.reset({ id_concepto_pago: '', monto_pagado: '' });
      setPagoArchivo(null);
      setMessage('Comprobante enviado correctamente a ventanilla.');
      await loadBase();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo enviar el comprobante.');
    } finally {
      setSending(false);
    }
  }

  async function submitTramite(values) {
    if (!tramiteArchivo) {
      setError('Debes adjuntar un archivo para la solicitud (PDF o imagen).');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('archivo', tramiteArchivo);
      formData.append('tipo', values.tipo);
      formData.append('tipo_tramite', values.tipo);
      formData.append('descripcion', values.descripcion?.trim() || `Solicitud de ${values.tipo}.`);

      await api.post('/alumno/tramites/solicitar', formData);

      tramiteForm.reset({ tipo: 'constancia', descripcion: '' });
      setTramiteArchivo(null);
      setMessage('Solicitud enviada a ventanilla.');
      await loadBase();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar el tramite.');
    } finally {
      setSending(false);
    }
  }

  async function entregarTarea(tareaId) {
    const archivo = entregaDrafts[tareaId]?.archivo || null;
    if (!archivo) {
      setError('Selecciona un archivo para entregar la tarea.');
      return;
    }

    const sizeMb = archivo.size / (1024 * 1024);
    if (sizeMb > 10) {
      setError('El archivo excede el limite de 10MB.');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('archivo', archivo);

      await api.post(`/alumno/tareas/${Number(tareaId)}/entregar`, formData);
      setMessage('Entrega registrada correctamente.');
      setEntregaDrafts((prev) => ({ ...prev, [tareaId]: { archivo: null } }));
      await loadBase();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo entregar la tarea.');
    } finally {
      setSending(false);
    }
  }

  const bloqueadoTotal = Boolean(acceso?.bloqueo_plataforma);

  return (
    <section className="alumno-page">
      {bloqueadoTotal ? (
        <div className="alumno-overlay" role="dialog" aria-modal="true">
          <div className="alumno-overlay-card">
            <h2>Acceso Restringido</h2>
            <p>
              Tu acceso academico esta restringido temporalmente.
              Comunicate con Tesoreria para regularizar tu cuenta.
            </p>
            <p className="alumno-overlay-note">
              Mientras tanto, solo puedes usar la Ventanilla Digital para subir tu comprobante de pago.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setActiveTab('ventanilla')}
            >
              Ir a Ventanilla
            </button>
          </div>
        </div>
      ) : null}

      <header className="alumno-header alumno-card">
        <p className="alumno-eyebrow">Portal Estudiantil UNICEP</p>
        <h2>Hola, {acceso?.perfil?.nombre_completo || 'Alumno'}</h2>
        <p>{acceso?.perfil?.carrera || 'Sin carrera'} · Bimestre {acceso?.perfil?.bimestre_actual || 'N/A'}</p>
      </header>

      <div className="alumno-tabs desktop-only" role="tablist" aria-label="Panel alumno">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
            disabled={bloqueadoTotal && tab.id !== 'ventanilla'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="error-box">{error}</p> : null}
      {message ? <p className="ok-box">{message}</p> : null}
      {loading ? <p className="alumno-loading">Cargando panel...</p> : null}

      {activeTab === 'dia' ? (
        <div className="alumno-section-grid">
          <article className="alumno-card next-class-card">
            <h3>Proxima clase</h3>
            {primeraClase ? (
              <>
                <strong>{primeraClase.materia}</strong>
                <p>Grupo {primeraClase.grupo}</p>
                <p>Aula: {primeraClase.aula_fisica || 'Por confirmar'}</p>
                {primeraClase.sala_virtual?.enlace ? (
                  <a className="btn-primary" href={primeraClase.sala_virtual.enlace} target="_blank" rel="noreferrer">
                    Unirme a videollamada
                  </a>
                ) : (
                  <button type="button" className="btn-secondary" disabled>Sin sala virtual</button>
                )}
              </>
            ) : (
              <p className="alumno-empty">Sin clases programadas.</p>
            )}
          </article>

          <article className="alumno-card">
            <h3>Tareas por entregar</h3>
            {tareasPendientes.length === 0 ? (
              <p className="alumno-empty">No tienes tareas pendientes.</p>
            ) : (
              <div className="alumno-list">
                {tareasPendientes.map((item) => (
                  <article key={item.id_tarea} className="alumno-list-item">
                    <div className="alumno-list-head">
                      <strong>{item.titulo}</strong>
                      <span className={`urgency-chip ${getUrgencyClass(item.vence_en_horas)}`}>
                        {item.vence_en_horas != null ? `Vence en ${item.vence_en_horas} horas` : 'Fecha no disponible'}
                      </span>
                    </div>
                    <p>{item.materia?.nombre_materia || 'Materia'} · Grupo {item.grupo_id || '-'}</p>
                    <p>{formatDate(item.fecha_limite, true)}</p>
                    <div className="alumno-inline-form">
                      <div className="file-upload-wrapper">
                        <label className="btn-file-custom">
                          <input
                            type="file"
                            accept=".pdf, .jpg, .jpeg, .png"
                            onChange={(event) => handleEntregaFileChange(item.id_tarea, event)}
                            style={{ display: 'none' }}
                          />
                          📎 {entregaDrafts[item.id_tarea]?.archivo ? 'Cambiar archivo' : 'Seleccionar archivo'}
                        </label>
                        <span className="file-name-display">
                          {entregaDrafts[item.id_tarea]?.archivo?.name || 'Ningun archivo seleccionado'}
                        </span>
                      </div>
                      <button type="button" className="btn-primary" onClick={() => entregarTarea(item.id_tarea)} disabled={sending}>
                        Entregar tarea
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="alumno-card full-width">
            <h3>Materiales de clase</h3>
            {materiales.length === 0 ? (
              <p className="alumno-empty">No hay materiales publicados.</p>
            ) : (
              <div className="alumno-list compact">
                {materiales.map((item) => (
                  <article key={item.id_material} className="alumno-list-item">
                    <strong>{item.tema_semana}</strong>
                    <p>{item.materia?.nombre_materia || 'Materia'} · {item.tipo_archivo}</p>
                    <a href={resolveBackendFileUrl(item.archivo_url)} target="_blank" rel="noreferrer">Abrir recurso</a>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === 'calificaciones' ? (
        <article className="alumno-card">
          <h3>Mis Calificaciones</h3>
          {calificacionesBloqueadas ? (
            <div className="alumno-empty lock-empty">
              <strong>Calificaciones bloqueadas</strong>
              <p>Tus calificaciones estan temporalmente ocultas por un tema administrativo.</p>
            </div>
          ) : (
            <>
              {calificaciones.resumen.length === 0 ? (
                <p className="alumno-empty">Aun no hay calificaciones registradas.</p>
              ) : (
                <div className="table-wrap dark-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Materia</th>
                        <th>Parcial</th>
                        <th>Final</th>
                        <th>Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calificaciones.resumen.map((item) => (
                        <tr key={item.id_materia}>
                          <td>{item.materia}</td>
                          <td>{item.parcial_promedio ?? 'N/D'}</td>
                          <td>{item.final_promedio ?? 'N/D'}</td>
                          <td>{item.estatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <h4>Asistencia acumulada</h4>
              {asistencia.acumulado.length === 0 ? (
                <p className="alumno-empty">Sin registros de asistencia.</p>
              ) : (
                <div className="alumno-list compact">
                  {asistencia.acumulado.map((item) => (
                    <article key={item.id_materia} className="alumno-list-item">
                      <strong>{item.materia}</strong>
                      <p>{item.porcentaje_asistencia}% asistencia</p>
                      <p>{item.presentes} presentes · {item.faltas} faltas · {item.retardos} retardos</p>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </article>
      ) : null}

      {activeTab === 'ventanilla' ? (
        <div className="alumno-section-grid">
          <article className="alumno-card">
            <button
              type="button"
              className="accordion-toggle"
              onClick={() => setOpenPagoAccordion((prev) => !prev)}
            >
              Subir Comprobante de Pago
            </button>
            {openPagoAccordion ? (
              <form className="alumno-form" onSubmit={pagoForm.handleSubmit(submitComprobante)}>
                <label htmlFor="pago-concepto">Concepto</label>
                <select id="pago-concepto" {...pagoForm.register('id_concepto_pago')}>
                  <option value="">Selecciona concepto</option>
                  {conceptosPago.map((item) => (
                    <option key={item.id_concepto_pago} value={String(item.id_concepto_pago)}>
                      {item.nombre}
                    </option>
                  ))}
                </select>

                <label htmlFor="pago-monto">Monto pagado</label>
                <input id="pago-monto" type="number" min="0" step="0.01" {...pagoForm.register('monto_pagado')} />

                <label htmlFor="pago-adjunto">Comprobante (PDF o imagen)</label>
                <div className="file-upload-wrapper">
                  <label className="btn-file-custom" htmlFor="pago-adjunto">
                    <input
                      id="pago-adjunto"
                      type="file"
                      accept=".pdf, .jpg, .jpeg, .png"
                      onChange={handlePagoFileChange}
                      style={{ display: 'none' }}
                    />
                    📎 {pagoArchivo ? 'Cambiar archivo' : 'Seleccionar archivo'}
                  </label>
                  <span className="file-name-display">
                    {pagoArchivo?.name || 'Ningun archivo seleccionado'}
                  </span>
                </div>

                <button type="submit" className="btn-primary" disabled={sending}>Subir comprobante</button>
              </form>
            ) : null}
          </article>

          <article className="alumno-card">
            <button
              type="button"
              className="accordion-toggle"
              onClick={() => setOpenTramiteAccordion((prev) => !prev)}
            >
              Solicitar Documento
            </button>
            {openTramiteAccordion ? (
              <form className="alumno-form" onSubmit={tramiteForm.handleSubmit(submitTramite)}>
                <label htmlFor="tramite-tipo">Tipo de tramite</label>
                <select id="tramite-tipo" {...tramiteForm.register('tipo')}>
                  <option value="constancia">Constancia</option>
                  <option value="credencial">Credencial</option>
                  <option value="uniforme">Uniforme</option>
                </select>

                <label htmlFor="tramite-descripcion">Descripcion (opcional)</label>
                <textarea id="tramite-descripcion" rows="3" {...tramiteForm.register('descripcion')} />

                <label htmlFor="tramite-adjunto">Adjunto (PDF o imagen)</label>
                <div className="file-upload-wrapper">
                  <label className="btn-file-custom" htmlFor="tramite-adjunto">
                    <input
                      id="tramite-adjunto"
                      type="file"
                      accept=".pdf, .jpg, .jpeg, .png"
                      onChange={handleTramiteFileChange}
                      style={{ display: 'none' }}
                    />
                    📎 {tramiteArchivo ? 'Cambiar archivo' : 'Seleccionar archivo'}
                  </label>
                  <span className="file-name-display">
                    {tramiteArchivo?.name || 'Ningun archivo seleccionado'}
                  </span>
                </div>

                <button type="submit" className="btn-secondary" disabled={sending}>Enviar solicitud</button>
              </form>
            ) : null}
          </article>

          <article className="alumno-card full-width">
            <h3>Historial de tramites</h3>
            {historialTramites.length === 0 ? (
              <p className="alumno-empty">Sin tramites registrados.</p>
            ) : (
              <div className="alumno-list compact">
                {historialTramites.map((item) => (
                  <article key={item.id_tramite} className="alumno-list-item">
                    <div className="alumno-list-head">
                      <strong>{tramiteLabels[item.tipo] || item.tipo}</strong>
                      <span className={`status-badge ${getStatusBadgeClass(item.estatus)}`}>
                        {estatusTramiteLabels[item.estatus] || item.estatus}
                      </span>
                    </div>
                    <p>{item.descripcion}</p>
                    {item.adjunto_url ? (
                      <a href={resolveBackendFileUrl(item.adjunto_url)} target="_blank" rel="noreferrer">Ver adjunto</a>
                    ) : null}
                    <small>{formatDate(item.fecha_resolucion || item.fecha_solicitud, true)}</small>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === 'perfil' ? (
        <div className="alumno-section-grid">
          <article className="alumno-card">
            <h3>Insignias y Meritos</h3>
            {meritos.length === 0 ? (
              <p className="alumno-empty">Aun no tienes meritos registrados.</p>
            ) : (
              <div className="chips-grid">
                {meritos.map((item) => (
                  <div key={item.id_merito} className="merito-chip">
                    <strong>{item.nombre}</strong>
                    <span>{item.tipo_merito}</span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="alumno-card">
            <h3>Notificaciones recientes</h3>
            {notificaciones.length === 0 ? (
              <p className="alumno-empty">No hay notificaciones por mostrar.</p>
            ) : (
              <div className="alumno-list scroll-area">
                {notificaciones.map((item, index) => (
                  <article key={`${item.tipo}-${index}`} className="alumno-list-item">
                    <strong>{item.titulo}</strong>
                    <p>{item.detalle}</p>
                    <small>{formatDate(item.fecha, true)}</small>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className="alumno-card full-width">
            <h3>Resumen financiero</h3>
            <div className="payment-cards">
              <div>
                <span>Estado</span>
                <strong>{pagos.resumen?.estado_general || 'N/D'}</strong>
              </div>
              <div>
                <span>Total pagado</span>
                <strong>{Number(pagos.resumen?.total_pagado || 0).toFixed(2)} MXN</strong>
              </div>
              <div>
                <span>Adeudo pendiente</span>
                <strong>{Number(pagos.resumen?.adeudo_pendiente || 0).toFixed(2)} MXN</strong>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      <nav className="alumno-bottom-nav mobile-only" aria-label="Navegacion alumno">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
            disabled={bloqueadoTotal && tab.id !== 'ventanilla'}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </section>
  );
}
