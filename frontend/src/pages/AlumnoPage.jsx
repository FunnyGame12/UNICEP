import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import api from '../services/api';
import './AlumnoPage.css';

const tabs = [
  { id: 'resumen', label: 'Mi Resumen' },
  { id: 'portafolio', label: 'Portafolio y Documentos' },
  { id: 'calificaciones', label: 'Calificaciones y Asistencias' },
  { id: 'finanzas', label: 'Constancias de Pagos' },
  { id: 'ventanilla', label: 'Ventanilla y Trámites' },
];

const tramiteLabels = {
  constancia: 'Constancia',
  credencial: 'Credencial',
  uniforme: 'Uniforme',
  papeleria_oficial: 'Papelería oficial',
  comprobante_pago: 'Comprobante de pago',
};

const rolLabels = {
  control_escolar: 'Control Escolar',
  coordinacion_academica: 'Coordinación Académica',
  director: 'Dirección',
};

const pagoEstatusLabels = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
};

const pagoEstatusBadgeClass = {
  pendiente: 'badge-neutral',
  en_revision: 'badge-warn',
  aprobado: 'badge-success',
};

const portafolioBadgeInfo = {
  validado: { label: 'Validado para Boleta', className: 'badge-success' },
  entregado: { label: 'Entregado, en revision', className: 'badge-warn' },
  pendiente: { label: 'Pendiente de entrega', className: 'badge-neutral' },
};

const pagoSchema = z.object({
  id_concepto_pago: z.string().min(1, 'Selecciona un concepto de pago.'),
  monto_pagado: z.preprocess(
    (value) => (value === '' || value == null ? NaN : Number(value)),
    z.number().positive('El monto debe ser mayor a 0.'),
  ),
});

const tramiteSchema = z.object({
  tipo: z.string().min(1, 'Selecciona un tipo de tramite.'),
  descripcion: z.string().trim().optional(),
});

function formatDate(value, withTime = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(value));
}

function getTramiteEstatusInfo(estatus) {
  if (['entregado', 'resuelto'].includes(estatus)) {
    return { label: 'Finalizado', badgeClass: 'badge-success', finalizado: true };
  }
  if (['en_proceso', 'listo_para_entrega'].includes(estatus)) {
    return { label: 'En proceso (Coordinación)', badgeClass: 'badge-warn', finalizado: false };
  }
  if (['rechazado', 'cancelado'].includes(estatus)) {
    return { label: 'Rechazado', badgeClass: 'badge-danger', finalizado: false };
  }
  return { label: 'En revisión (Control Escolar)', badgeClass: 'badge-neutral', finalizado: false };
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

function esUrlValida(value) {
  try {
    // eslint-disable-next-line no-new
    new URL(value);
    return true;
  } catch (_error) {
    return false;
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
  const [calificaciones, setCalificaciones] = useState({ formativas: [], finales: [], resumen: [] });
  const [calificacionesBloqueadas, setCalificacionesBloqueadas] = useState(false);
  const [asistencia, setAsistencia] = useState({ items: [], acumulado: [] });
  const [historialTramites, setHistorialTramites] = useState([]);
  const [tiposTramiteCatalogo, setTiposTramiteCatalogo] = useState([]);
  const [avisos, setAvisos] = useState([]);
  const [avisosDescartados, setAvisosDescartados] = useState(new Set());
  const [pagos, setPagos] = useState({ items: [], resumen: null });
  const [conceptosPago, setConceptosPago] = useState([]);
  const [misEvidencias, setMisEvidencias] = useState([]);
  const [recursosInstitucionales, setRecursosInstitucionales] = useState([]);
  const [draftsPortafolio, setDraftsPortafolio] = useState({});
  const [savingMateriaId, setSavingMateriaId] = useState(null);

  const [pagoArchivo, setPagoArchivo] = useState(null);
  const [tramiteArchivo, setTramiteArchivo] = useState(null);
  const [descargandoBoleta, setDescargandoBoleta] = useState(false);

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
      tipo: '',
      descripcion: '',
    },
  });

  function handlePagoFileChange(event) {
    setPagoArchivo(event.target.files?.[0] || null);
  }

  function handleTramiteFileChange(event) {
    setTramiteArchivo(event.target.files?.[0] || null);
  }

  async function handleDescartarAviso(idAviso) {
    try {
      await api.post(`/alumno/avisos/${idAviso}/descartar`);
      setAvisosDescartados((prev) => new Set(prev).add(idAviso));
    } catch (_error) {
      setError('No se pudo descartar el aviso. Intenta de nuevo.');
    }
  }

  const avisosVisibles = useMemo(
    () => avisos.filter((item) => !avisosDescartados.has(item.id_aviso)),
    [avisos, avisosDescartados],
  );

  const kardexRows = useMemo(() => {
    const partialMap = new Map();

    (calificaciones.formativas || []).forEach((item) => {
      const idMateria = Number(item.id_materia);
      const materiaKey = Number.isFinite(idMateria) ? idMateria : (item.materia?.nombre_materia || item.materia || 'materia');
      const current = partialMap.get(materiaKey) || {
        id_materia: idMateria || materiaKey,
        materia: item.materia?.nombre_materia || item.materia || 'Materia',
        formativa_1: null,
        formativa_2: null,
        final: null,
      };

      const numeroFormativa = Number(item.formativa_numero);
      if (numeroFormativa === 1) current.formativa_1 = Number(item.calificacion ?? 0);
      if (numeroFormativa === 2) current.formativa_2 = Number(item.calificacion ?? 0);
      partialMap.set(materiaKey, current);
    });

    (calificaciones.resumen || []).forEach((item) => {
      const idMateria = Number(item.id_materia);
      const materiaKey = Number.isFinite(idMateria) ? idMateria : (item.materia || 'materia');
      const current = partialMap.get(materiaKey) || {
        id_materia: idMateria || materiaKey,
        materia: item.materia || 'Materia',
        formativa_1: null,
        formativa_2: null,
        final: null,
      };
      current.final = item.final_promedio ?? item.formativa_promedio ?? null;
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

  const recursosOrdenados = useMemo(
    () => [...recursosInstitucionales],
    [recursosInstitucionales],
  );

  function handleDriveInputChange(materiaId, value) {
    setDraftsPortafolio((prev) => ({ ...prev, [materiaId]: value }));
  }

  async function handleGuardarEnlacePortafolio(materiaId) {
    const driveUrl = String(draftsPortafolio[materiaId] || '').trim();
    if (!driveUrl || !esUrlValida(driveUrl)) {
      setError('Ingresa un enlace de Drive valido antes de guardar.');
      return;
    }

    setSavingMateriaId(materiaId);
    setError('');
    setMessage('');

    try {
      await api.post('/alumno/portafolio', { materia_id: materiaId, drive_url: driveUrl });
      setMessage('Enlace de Drive guardado correctamente.');
      await loadBase();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar el enlace de Drive.');
    } finally {
      setSavingMateriaId(null);
    }
  }

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

      const [tramitesResp, tiposTramiteResp] = await Promise.all([
        api.get('/alumno/historial-tramites'),
        api.get('/alumno/tramites/tipos').catch(() => ({ data: { items: [] } })),
      ]);

      setHistorialTramites(tramitesResp.data?.items || []);
      setTiposTramiteCatalogo(tiposTramiteResp.data?.items || []);

      if (estadoResp.data?.bloqueo_plataforma) {
        setHorario([]);
        setCalificaciones({ formativas: [], finales: [], resumen: [] });
        setAsistencia({ items: [], acumulado: [] });
        setAvisos([]);
        setMisEvidencias([]);
        setRecursosInstitucionales([]);
        setDraftsPortafolio({});
        setCalificacionesBloqueadas(Boolean(estadoResp.data?.bloqueo_calificaciones));
        return;
      }

      const idAlumno = Number(estadoResp.data?.id_alumno || 0);

      const [horarioResp, asistenciaResp, avisosResp, calificacionesResp, portafolioResp] = await Promise.all([
        api.get('/alumno/horario-aulas'),
        api.get('/alumno/asistencia'),
        api.get('/alumno/avisos').catch(() => ({ data: { items: [] } })),
        api.get('/alumno/calificaciones').catch((requestError) => {
          if (requestError?.response?.status === 403) {
            setCalificacionesBloqueadas(true);
            return { data: { formativas: [], finales: [], resumen: [] } };
          }
          throw requestError;
        }),
        idAlumno > 0
          ? api.get(`/alumno/${idAlumno}/portafolio-recursos`).catch(() => ({ data: { misEvidencias: [], recursosInstitucionales: [] } }))
          : Promise.resolve({ data: { misEvidencias: [], recursosInstitucionales: [] } }),
      ]);

      setHorario(horarioResp.data?.items || []);
      setAsistencia(asistenciaResp.data || { items: [], acumulado: [] });
      setAvisos(avisosResp.data?.items || []);
      setCalificaciones(calificacionesResp.data || { formativas: [], finales: [], resumen: [] });
      const evidencias = portafolioResp.data?.misEvidencias || [];
      setMisEvidencias(evidencias);
      setRecursosInstitucionales(portafolioResp.data?.recursosInstitucionales || []);
      setDraftsPortafolio((prev) => {
        const next = { ...prev };
        evidencias.forEach((item) => {
          if (next[item.materia_id] === undefined) {
            next[item.materia_id] = item.drive_url || '';
          }
        });
        return next;
      });
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

      tramiteForm.reset({ tipo: '', descripcion: '' });
      setTramiteArchivo(null);
      setMessage('Solicitud enviada a ventanilla.');
      await loadBase();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar el tramite.');
    } finally {
      setSending(false);
    }
  }

  const handleDescargarBoletaExcel = async () => {
    setError('');
    setMessage('');
    setDescargandoBoleta(true);

    try {
      const response = await api.get('/alumno/boleta', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Boleta_Oficial_UNICEP.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessage('Boleta descargada correctamente.');
    } catch (requestError) {
      console.error('Error al descargar la boleta de Excel:', requestError);
      setError(requestError?.response?.data?.message || 'No se pudo generar la boleta.');
    } finally {
      setDescargandoBoleta(false);
    }
  };

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
              Ir a Constancias de Pagos
            </button>
          </div>
        </div>
      ) : null}

      <header className="alumno-header alumno-card">
        <p className="alumno-eyebrow">Portal Estudiantil UNICEP</p>
        <h2>Hola, {acceso?.perfil?.nombre_completo || 'Alumno'}</h2>
        <p>{acceso?.perfil?.carrera || 'Sin carrera'} · Bimestre {acceso?.perfil?.bimestre_actual || 'N/A'}</p>
        <Link to="/alumno/portafolio-recursos" className="btn-secondary portafolio-link">
          📁 Portafolio y Recursos
        </Link>
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
          <article className="alumno-card full-width">
            <h3>Alertas y avisos</h3>
            {avisosVisibles.length === 0 ? (
              <p className="alumno-empty">No hay avisos recientes de Coordinación, Docentes o Control Escolar.</p>
            ) : (
              <div className="alumno-list scroll-area">
                {avisosVisibles.map((item) => (
                  <article key={item.id_aviso} className="alumno-list-item">
                    <div className="alumno-list-head">
                      <strong>{item.titulo}</strong>
                      <button
                        type="button"
                        className="dismiss-btn"
                        aria-label="Descartar aviso"
                        title="Descartar aviso"
                        onClick={() => handleDescartarAviso(item.id_aviso)}
                      >
                        ✕
                      </button>
                    </div>
                    <p>{item.mensaje}</p>
                    <small>
                      {item.remitente_tipo === 'coordinacion' ? 'Coordinación Académica' : item.remitente_tipo === 'control_escolar' ? 'Control Escolar' : 'Docente'}
                      {' · '}
                      {formatDate(item.created_at, true)}
                    </small>
                  </article>
                ))}
              </div>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === 'portafolio' ? (
        <div className="alumno-section-grid animate-fade-in">
          <div className="alumno-portafolio-intro full-width">
            <h3>Portafolio y Documentos</h3>
            <p>Captura tus evidencias por materia y descarga los recursos oficiales.</p>
          </div>

          <div className="alumno-portafolio-grid full-width">
            <article className="alumno-card alumno-portafolio-column">
              <h4>📁 Mis Evidencias (Drive)</h4>
              {misEvidencias.length === 0 ? (
                <p className="alumno-empty">Aun no tienes materias con evidencias por entregar.</p>
              ) : (
                <div className="alumno-list">
                  {misEvidencias.map((item) => {
                    const badge = portafolioBadgeInfo[item.estado] || portafolioBadgeInfo.pendiente;
                    const isSaving = savingMateriaId === item.materia_id;

                    return (
                      <article key={item.materia_id} className="alumno-list-item alumno-portafolio-item">
                        <div className="alumno-list-head alumno-portafolio-item-head">
                          <div>
                            <strong>{item.materia_nombre}</strong>
                            <small>Docente: {item.docente_nombre}</small>
                          </div>
                          <span className={`status-badge ${badge.className}`}>{badge.label}</span>
                        </div>

                        <label htmlFor={`drive-url-${item.materia_id}`}>Enlace de Google Drive</label>
                        <div className="alumno-portafolio-form-row">
                          <input
                            id={`drive-url-${item.materia_id}`}
                            type="url"
                            placeholder="https://drive.google.com/..."
                            value={draftsPortafolio[item.materia_id] ?? ''}
                            onChange={(event) => handleDriveInputChange(item.materia_id, event.target.value)}
                          />
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={isSaving}
                            onClick={() => handleGuardarEnlacePortafolio(item.materia_id)}
                          >
                            {isSaving ? 'Guardando...' : 'Guardar Enlace'}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </article>

            <article className="alumno-card alumno-portafolio-column">
              <h4>📥 Recursos y Material Didactico</h4>
              {recursosOrdenados.length === 0 ? (
                <p className="alumno-empty">Coordinacion y Docentes aun no han compartido recursos.</p>
              ) : (
                <div className="alumno-list">
                  {recursosOrdenados.map((item, index) => {
                    const esEnlaceDrive = item.tipo_recurso === 'enlace_drive';
                    const recursoUrl = resolveBackendFileUrl(item.url_recurso);
                    const remitente = item.remitente_tipo === 'coordinacion' ? 'Coordinacion Academica' : 'Docente';

                    return (
                      <article key={`${item.titulo}-${index}`} className="alumno-list-item alumno-portafolio-item">
                        <strong>{item.titulo}</strong>
                        <small>
                          {remitente}
                          {item.materia_nombre ? ` · ${item.materia_nombre}` : ''}
                        </small>
                        {item.remitente_nombre ? <small>Publico: {item.remitente_nombre}</small> : null}
                        {recursoUrl ? (
                          <a href={recursoUrl} target="_blank" rel="noreferrer">
                            {esEnlaceDrive ? 'Abrir enlace de Drive' : 'Descargar archivo'}
                          </a>
                        ) : (
                          <p className="alumno-empty">Recurso sin enlace disponible.</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </article>
          </div>

          <article className="alumno-card full-width alumno-portafolio-tab">
            <p>
              Si prefieres una vista dedicada, tambien puedes abrir el modulo completo de portafolio.
            </p>
            <Link to="/alumno/portafolio-recursos" className="btn-secondary alumno-portafolio-cta">
              Abrir modulo completo
            </Link>
          </article>
        </div>
      ) : null}

      {activeTab === 'calificaciones' ? (
        <article className="alumno-card">
          <div className="section-head">
            <h3>Materias en Curso</h3>
            <button type="button" className="btn-primary kardex-download" onClick={handleDescargarBoletaExcel} disabled={descargandoBoleta}>
              {descargandoBoleta ? 'Generando...' : '📄 Descargar Boleta'}
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
                        <th>Formativa 1</th>
                        <th>Formativa 2</th>
                        <th>Calificación Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardexRows.map((item) => (
                        <tr key={item.id_materia || item.materia}>
                          <td>{item.materia}</td>
                          <td>{item.docente}</td>
                          <td>{item.formativa_1 ?? 'N/D'}</td>
                          <td>{item.formativa_2 ?? 'N/D'}</td>
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
                <div className="table-wrap dark-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Materia</th>
                        <th>Docente</th>
                        <th>Total Clases</th>
                        <th>Asistencias</th>
                        <th>Faltas</th>
                        <th>% Asistencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistencia.acumulado.map((item) => (
                        <tr key={item.id_materia}>
                          <td>{item.materia}</td>
                          <td>{item.docente}</td>
                          <td>{item.total}</td>
                          <td>{item.presentes}</td>
                          <td>{item.faltas}</td>
                          <td>{item.porcentaje_asistencia}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </article>
      ) : null}

      {activeTab === 'finanzas' ? (
        <div className="alumno-section-grid">
          <article className="alumno-card full-width">
            <p className="alumno-warning-banner">
              ⚠️ Es obligatorio adjuntar el comprobante de pago legible para la validación de cada concepto.
            </p>
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

              <label htmlFor="pago-adjunto">Comprobante (Obligatorio)</label>
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

          <article className="alumno-card full-width">
            <h3>Estado de Pagos del Cuatrimestre</h3>
            {pagos.items.length === 0 ? (
              <p className="alumno-empty">No hay pagos registrados.</p>
            ) : (
              <div className="table-wrap dark-table">
                <table>
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th>Monto</th>
                      <th>Fecha límite</th>
                      <th>Estatus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.items.map((item) => (
                      <tr key={item.id_pago || `${item.concepto}-${item.fecha_limite}`}>
                        <td>{item.concepto || 'Pago'}</td>
                        <td>{Number(item.monto || 0).toFixed(2)} MXN</td>
                        <td>{formatDate(item.fecha_limite, false)}</td>
                        <td>
                          <span className={`status-badge ${pagoEstatusBadgeClass[item.estatus_visible] || 'badge-neutral'}`}>
                            {pagoEstatusLabels[item.estatus_visible] || item.estatus_visible}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      ) : null}

      {activeTab === 'ventanilla' ? (
        <div className="alumno-section-grid">
          <article className="alumno-card">
            <h3>Solicitar Documento</h3>
            <form className="alumno-form" onSubmit={tramiteForm.handleSubmit(submitTramite)}>
              <label htmlFor="tramite-tipo">Tipo de tramite</label>
              <select id="tramite-tipo" {...tramiteForm.register('tipo')}>
                <option value="">Selecciona un tipo</option>
                {tiposTramiteCatalogo.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              {tramiteForm.formState.errors.tipo ? <small>{tramiteForm.formState.errors.tipo.message}</small> : null}

              <label htmlFor="tramite-descripcion">Descripcion (opcional)</label>
              <textarea id="tramite-descripcion" rows="3" {...tramiteForm.register('descripcion')} />

              <label htmlFor="tramite-adjunto">Adjunto (Obligatorio)</label>
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
          </article>

          <article className="alumno-card full-width">
            <h3>Historial de tramites</h3>
            {historialTramitesFiltrados.length === 0 ? (
              <p className="alumno-empty">Sin tramites registrados.</p>
            ) : (
              <div className="alumno-list compact">
                {historialTramitesFiltrados.map((item) => {
                  const estatusInfo = getTramiteEstatusInfo(item.estatus);
                  return (
                    <article key={item.id_tramite} className="alumno-list-item">
                      <div className="alumno-list-head">
                        <strong>{tramiteLabels[item.tipo] || item.tipo}</strong>
                        <span className={`status-badge ${estatusInfo.badgeClass}`}>
                          {estatusInfo.label}
                        </span>
                      </div>
                      <p>{item.descripcion}</p>
                      {item.resolutor ? (
                        <small>
                          Atendido por: {item.resolutor.nombre_completo} · {rolLabels[item.resolutor.rol] || item.resolutor.rol}
                        </small>
                      ) : null}
                      {item.adjunto_url ? (
                        <a href={resolveBackendFileUrl(item.adjunto_url)} target="_blank" rel="noreferrer">Ver adjunto enviado</a>
                      ) : null}
                      {estatusInfo.finalizado ? (
                        item.documento_respuesta_url ? (
                          <a
                            className="btn-primary"
                            href={resolveBackendFileUrl(item.documento_respuesta_url)}
                            target="_blank"
                            rel="noreferrer"
                            download
                          >
                            📥 Descargar Documento
                          </a>
                        ) : (
                          <p className="alumno-empty">Documento pendiente de carga.</p>
                        )
                      ) : null}
                      <small>{formatDate(item.fecha_resolucion || item.fecha_solicitud, true)}</small>
                    </article>
                  );
                })}
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
