import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
import './AlumnoPage.css';

const tabs = [
  { id: 'resumen', label: 'Mi Resumen' },
  { id: 'calificaciones', label: 'Calificaciones y Kardex' },
  { id: 'finanzas', label: 'Finanzas y Pagos' },
  { id: 'ventanilla', label: 'Ventanilla y Trámites' },
];

const tramiteLabels = {
  constancia: 'Constancia',
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

const expedienteDocumentos = [
  { key: 'curp', label: 'CURP', detalle: 'Identificación oficial', estatus: 'faltante' },
  { key: 'acta', label: 'Acta de nacimiento', detalle: 'Documentación de registro', estatus: 'pendiente' },
  { key: 'certificado', label: 'Certificado de bachillerato', detalle: 'Boleta de preparatoria', estatus: 'entregado' },
  { key: 'foto', label: 'Foto oficial', detalle: 'Formato escolar vigente', estatus: 'pendiente' },
];

const pagoSchema = z.object({
  id_concepto_pago: z.string().min(1, 'Selecciona un concepto de pago.'),
  monto_pagado: z.preprocess(
    (value) => (value === '' || value == null ? NaN : Number(value)),
    z.number().positive('El monto debe ser mayor a 0.'),
  ),
});

const tramiteSchema = z.object({
  tipo: z.enum(['constancia', 'uniforme']),
  descripcion: z.string().trim().optional(),
});

function formatDate(value, withTime = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(value));
}

function getStatusBadgeClass(estatus) {
  if (estatus === 'resuelto') return 'badge-success';
  if (estatus === 'en_proceso' || estatus === 'en_revision') return 'badge-warn';
  if (estatus === 'rechazado' || estatus === 'cancelado') return 'badge-danger';
  return 'badge-neutral';
}

function getDocumentStatusClass(estatus) {
  if (estatus === 'entregado') return 'doc-status success';
  if (estatus === 'pendiente') return 'doc-status warn';
  return 'doc-status danger';
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
  const [activeTab, setActiveTab] = useState('resumen');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [acceso, setAcceso] = useState(null);
  const [horario, setHorario] = useState([]);
  const [calificaciones, setCalificaciones] = useState({ parciales: [], finales: [], resumen: [] });
  const [calificacionesBloqueadas, setCalificacionesBloqueadas] = useState(false);
  const [asistencia, setAsistencia] = useState({ items: [], acumulado: [] });
  const [historialTramites, setHistorialTramites] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [meritos, setMeritos] = useState([]);
  const [pagos, setPagos] = useState({ items: [], resumen: null });
  const [conceptosPago, setConceptosPago] = useState([]);

  const [openPagoAccordion, setOpenPagoAccordion] = useState(true);
  const [openTramiteAccordion, setOpenTramiteAccordion] = useState(true);

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

  const kardexRows = useMemo(() => {
    const partialMap = new Map();

    (calificaciones.parciales || []).forEach((item) => {
      const idMateria = Number(item.id_materia);
      const materiaKey = Number.isFinite(idMateria) ? idMateria : (item.materia?.nombre_materia || item.materia || 'materia');
      const current = partialMap.get(materiaKey) || {
        id_materia: idMateria || materiaKey,
        materia: item.materia?.nombre_materia || item.materia || 'Materia',
        parcial_1: null,
        parcial_2: null,
        final: null,
      };

      const numeroParcial = Number(item.parcial_numero);
      if (numeroParcial === 1) current.parcial_1 = Number(item.calificacion ?? 0);
      if (numeroParcial === 2) current.parcial_2 = Number(item.calificacion ?? 0);
      partialMap.set(materiaKey, current);
    });

    (calificaciones.resumen || []).forEach((item) => {
      const idMateria = Number(item.id_materia);
      const materiaKey = Number.isFinite(idMateria) ? idMateria : (item.materia || 'materia');
      const current = partialMap.get(materiaKey) || {
        id_materia: idMateria || materiaKey,
        materia: item.materia || 'Materia',
        parcial_1: null,
        parcial_2: null,
        final: null,
      };
      current.final = item.final_promedio ?? item.parcial_promedio ?? null;
      partialMap.set(materiaKey, current);
    });

    return [...partialMap.values()].map((item) => {
      const docente = horario.find((clase) => {
        if (Number(clase.id_materia) === Number(item.id_materia)) return true;
        return String(clase.materia || '').trim().toLowerCase() === String(item.materia || '').trim().toLowerCase();
      })?.docente || 'Sin docente asignado';

      return {
        ...item,
        docente,
      };
    });
  }, [calificaciones, horario]);

  const historialTramitesFiltrados = useMemo(
    () => (historialTramites || []).filter((item) => !['comprobante_pago', 'credencial'].includes(item.tipo)),
    [historialTramites],
  );

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
        setCalificaciones({ parciales: [], finales: [], resumen: [] });
        setAsistencia({ items: [], acumulado: [] });
        setNotificaciones([]);
        setCalificacionesBloqueadas(Boolean(estadoResp.data?.bloqueo_calificaciones));
        return;
      }

      const [horarioResp, asistenciaResp, notificacionesResp, calificacionesResp] = await Promise.all([
        api.get('/alumno/horario-aulas'),
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
      setAsistencia(asistenciaResp.data || { items: [], acumulado: [] });
      setNotificaciones(notificacionesResp.data?.items || []);
      setCalificaciones(calificacionesResp.data || { parciales: [], finales: [], resumen: [] });
      setCalificacionesBloqueadas(false);
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
      setMessage('Comprobante enviado correctamente a Tesorería.');
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

  function handleDownloadKardex() {
    if (!kardexRows.length) {
      setMessage('Todavía no hay materias registradas en tu kardex.');
      return;
    }

    const payload = [
      'UNICEP - Kardex Digital',
      `Alumno: ${acceso?.perfil?.nombre_completo || 'Estudiante'}`,
      `Carrera: ${acceso?.perfil?.carrera || 'N/D'}`,
      '',
      'Materia;Docente;Parcial 1;Parcial 2;Calificación Final',
      ...kardexRows.map((item) => `${item.materia};${item.docente};${item.parcial_1 ?? 'N/D'};${item.parcial_2 ?? 'N/D'};${item.final ?? 'N/D'}`),
    ].join('\n');

    const blob = new Blob([payload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'kardex-digital-unicep.txt';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Kardex digital descargado correctamente.');
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
              Mientras tanto, puedes seguir tu estatus financiero y ventanilla digital.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setActiveTab('finanzas')}
            >
              Ir a Finanzas
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
            disabled={bloqueadoTotal && tab.id !== 'finanzas'}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <p className="error-box">{error}</p> : null}
      {message ? <p className="ok-box">{message}</p> : null}
      {loading ? <p className="alumno-loading">Cargando panel...</p> : null}

      {activeTab === 'resumen' ? (
        <div className="alumno-section-grid">
          <article className="alumno-card next-class-card">
            <h3>Próxima clase</h3>
            {primeraClase ? (
              <>
                <strong>{primeraClase.materia}</strong>
                <p>Grupo {primeraClase.grupo}</p>
                <p>Docente: {primeraClase.docente || 'Por asignar'}</p>
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
            <h3>Alertas y avisos</h3>
            {notificaciones.length === 0 ? (
              <p className="alumno-empty">No hay alertas por mostrar.</p>
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
        </div>
      ) : null}

      {activeTab === 'calificaciones' ? (
        <article className="alumno-card">
          <div className="section-head">
            <h3>Materias en Curso</h3>
            <button type="button" className="btn-primary kardex-download" onClick={handleDownloadKardex}>
              📄 Descargar Kardex Digital
            </button>
          </div>

          {calificacionesBloqueadas ? (
            <div className="alumno-empty lock-empty">
              <strong>Calificaciones bloqueadas</strong>
              <p>Tus calificaciones estan temporalmente ocultas por un tema administrativo.</p>
            </div>
          ) : (
            <>
              {kardexRows.length === 0 ? (
                <p className="alumno-empty">Aun no hay materias en curso registradas.</p>
              ) : (
                <div className="table-wrap dark-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Materia</th>
                        <th>Docente</th>
                        <th>Parcial 1</th>
                        <th>Parcial 2</th>
                        <th>Calificación Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardexRows.map((item) => (
                        <tr key={item.id_materia || item.materia}>
                          <td>{item.materia}</td>
                          <td>{item.docente}</td>
                          <td>{item.parcial_1 ?? 'N/D'}</td>
                          <td>{item.parcial_2 ?? 'N/D'}</td>
                          <td>{item.final ?? 'N/D'}</td>
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

      {activeTab === 'finanzas' ? (
        <div className="alumno-section-grid">
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

          <article className="alumno-card">
            <h3>Subir comprobante de pago</h3>
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
          </article>

          <article className="alumno-card">
            <h3>Estado de pagos</h3>
            {pagos.items.length === 0 ? (
              <p className="alumno-empty">No hay pagos registrados.</p>
            ) : (
              <div className="alumno-list compact">
                {pagos.items.map((item) => (
                  <article key={item.id_pago || `${item.concepto}-${item.fecha_limite}`} className="alumno-list-item">
                    <div className="alumno-list-head">
                      <strong>{item.concepto || 'Pago'}</strong>
                      <span className={`status-badge ${getStatusBadgeClass(item.estatus === 'pagado' ? 'resuelto' : item.estatus === 'pendiente' ? 'badge-neutral' : item.estatus)}`}>
                        {item.estatus || 'N/D'}
                      </span>
                    </div>
                    <p>{Number(item.monto || 0).toFixed(2)} MXN</p>
                    <small>{formatDate(item.fecha_limite || item.fecha_pago, true)}</small>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === 'ventanilla' ? (
        <div className="alumno-section-grid">
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

          <article className="alumno-card">
            <h3>Mi Expediente</h3>
            <div className="document-list">
              {expedienteDocumentos.map((item) => (
                <div key={item.key} className="doc-card">
                  <div className="doc-meta">
                    <strong>{item.label}</strong>
                    <span>{item.detalle}</span>
                  </div>
                  <span className={getDocumentStatusClass(item.estatus)}>
                    {item.estatus === 'entregado' ? 'Entregado' : item.estatus === 'pendiente' ? 'Pendiente' : 'Falta'}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="alumno-card full-width">
            <h3>Historial de tramites</h3>
            {historialTramitesFiltrados.length === 0 ? (
              <p className="alumno-empty">Sin tramites registrados.</p>
            ) : (
              <div className="alumno-list compact">
                {historialTramitesFiltrados.map((item) => (
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

      <nav className="alumno-bottom-nav mobile-only" aria-label="Navegacion alumno">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
            disabled={bloqueadoTotal && tab.id !== 'finanzas'}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </section>
  );
}
