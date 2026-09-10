import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import api from '../services/api';
import './PortafolioRecursosPage.css';

const ESTADO_BADGE = {
  validado: { label: 'Validado para Boleta', className: 'badge-success' },
  entregado: { label: 'Entregado, en revisión', className: 'badge-warn' },
  pendiente: { label: 'Pendiente de entrega', className: 'badge-neutral' },
};

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

function filenameFromContentDisposition(headerValue, fallback = 'material_unicep') {
  const header = String(headerValue || '');
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch (_error) {
      return utfMatch[1];
    }
  }

  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) return plainMatch[1];
  return fallback;
}

export default function PortafolioRecursosPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [misEvidencias, setMisEvidencias] = useState([]);
  const [recursosInstitucionales, setRecursosInstitucionales] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingMateriaId, setSavingMateriaId] = useState(null);
  const [descargandoRecursoId, setDescargandoRecursoId] = useState(null);

  async function cargarPortafolio() {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/alumnos/${user.id_usuario}/portafolio-recursos`);
      const evidencias = response.data?.misEvidencias || [];
      setMisEvidencias(evidencias);
      setRecursosInstitucionales(response.data?.recursosInstitucionales || []);
      setDrafts((prev) => {
        const next = { ...prev };
        evidencias.forEach((item) => {
          if (next[item.materia_id] === undefined) {
            next[item.materia_id] = item.drive_url || '';
          }
        });
        return next;
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el portafolio y recursos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user?.id_usuario) {
      cargarPortafolio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id_usuario]);

  function handleDriveInputChange(materiaId, value) {
    setDrafts((prev) => ({ ...prev, [materiaId]: value }));
  }

  async function handleGuardarEnlace(materiaId) {
    const driveUrl = String(drafts[materiaId] || '').trim();

    if (!driveUrl || !esUrlValida(driveUrl)) {
      setError('Ingresa un enlace de Drive válido antes de guardar.');
      return;
    }

    setSavingMateriaId(materiaId);
    setError('');
    setMessage('');

    try {
      await api.post('/alumnos/portafolio', { materia_id: materiaId, drive_url: driveUrl });
      setMessage('Enlace de Drive guardado correctamente.');
      await cargarPortafolio();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar el enlace de Drive.');
    } finally {
      setSavingMateriaId(null);
    }
  }

  async function handleDescargarRecurso(item) {
    const idRecurso = Number(item?.id_recurso || 0);
    if (!Number.isInteger(idRecurso) || idRecurso <= 0) {
      setError('No se pudo identificar el recurso a descargar.');
      return;
    }

    setError('');
    setMessage('');
    setDescargandoRecursoId(idRecurso);

    try {
      const response = await api.get(`/alumno/recursos/${idRecurso}/descargar`, {
        responseType: 'blob',
      });

      const headerName = response?.headers?.['content-disposition'];
      const fallbackName = `${String(item?.titulo || 'material').replace(/\s+/g, '_')}.bin`;
      const filename = filenameFromContentDisposition(headerName, fallbackName);

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (requestError) {
      const status = requestError?.response?.status;
      if (status === 401) {
        setError('Tu sesión expiró. Inicia sesión nuevamente para descargar el archivo.');
      } else if (status === 404) {
        setError('El archivo ya no se encuentra disponible en servidor.');
      } else {
        setError('No se pudo descargar el recurso. Intenta nuevamente.');
      }
    } finally {
      setDescargandoRecursoId(null);
    }
  }

  const recursosOrdenados = useMemo(
    () => [...recursosInstitucionales],
    [recursosInstitucionales],
  );

  return (
    <section className="portafolio-page">
      <header className="portafolio-header portafolio-card">
        <p className="portafolio-eyebrow">Portal Estudiantil UNICEP</p>
        <h2>Portafolio y Recursos</h2>
        <p>Entrega tus evidencias por materia y consulta el material compartido por tus maestros y Coordinación Académica.</p>
      </header>

      {error ? <p className="error-box">{error}</p> : null}
      {message ? <p className="ok-box">{message}</p> : null}
      {loading ? <p className="portafolio-loading">Cargando portafolio...</p> : null}

      <article className="portafolio-card full-width">
        <h3>Mi Portafolio de Evidencias</h3>
        {misEvidencias.length === 0 ? (
          <p className="portafolio-empty">Aún no tienes materias con evidencias por entregar.</p>
        ) : (
          <div className="portafolio-grid">
            {misEvidencias.map((item) => {
              const badge = ESTADO_BADGE[item.estado] || ESTADO_BADGE.pendiente;
              const isSaving = savingMateriaId === item.materia_id;

              return (
                <article key={item.materia_id} className="evidencia-card">
                  <div className="evidencia-card-head">
                    <div>
                      <strong>{item.materia_nombre}</strong>
                      <p className="evidencia-docente">Docente: {item.docente_nombre}</p>
                    </div>
                    <span className={`badge ${badge.className}`}>{badge.label}</span>
                  </div>

                  <label htmlFor={`drive-url-${item.materia_id}`}>Enlace de Google Drive</label>
                  <div className="evidencia-form-row">
                    <input
                      id={`drive-url-${item.materia_id}`}
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={drafts[item.materia_id] ?? ''}
                      onChange={(event) => handleDriveInputChange(item.materia_id, event.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={isSaving}
                      onClick={() => handleGuardarEnlace(item.materia_id)}
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

      <article className="portafolio-card full-width">
        <h3>Recursos y Material Didáctico</h3>
        {recursosOrdenados.length === 0 ? (
          <p className="portafolio-empty">Coordinación Académica y tus maestros aún no han compartido recursos.</p>
        ) : (
          <div className="portafolio-grid">
            {recursosOrdenados.map((item, index) => {
              const esCoordinacion = item.remitente_tipo === 'coordinacion';
              const esEnlaceDrive = item.tipo_recurso === 'enlace_drive';
              const archivoAbsoluto = resolveBackendFileUrl(item.url_recurso);

              return (
                <article key={`${item.titulo}-${index}`} className="recurso-card">
                  <div className="recurso-icon">{esCoordinacion ? '🏛️' : '👨‍🏫'}</div>
                  <strong>{item.titulo}</strong>
                  <p className="recurso-remitente">
                    {esCoordinacion
                      ? 'Proporcionado por: Coordinación Académica'
                      : `Proporcionado por: ${item.remitente_nombre}${item.materia_nombre ? ` | Materia: ${item.materia_nombre}` : ''}`}
                  </p>

                  {esEnlaceDrive ? (
                    <a
                      className="btn-primary recurso-btn"
                      href={item.url_recurso}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir en Drive 🔗
                    </a>
                  ) : (
                    <button
                      className="btn-primary recurso-btn"
                      type="button"
                      onClick={() => handleDescargarRecurso(item)}
                      disabled={descargandoRecursoId === Number(item.id_recurso)}
                    >
                      {descargandoRecursoId === Number(item.id_recurso) ? 'Descargando...' : 'Descargar Archivo 📥'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
