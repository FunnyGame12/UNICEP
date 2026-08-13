import { useEffect, useState } from 'react';
import api from '../services/api';

const initialMessage = { type: '', text: '' };

function ActionMessage({ message }) {
  if (!message.text) return null;
  return <p className={message.type === 'error' ? 'error-box' : 'ok-box'} role="status">{message.text}</p>;
}

export default function DirectorPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(initialMessage);
  const [folioUsuario, setFolioUsuario] = useState({ id_usuario: '', folio_matricula: '' });
  const [folioPago, setFolioPago] = useState({ id_pago: '', folio_interno: '' });
  const [financiero, setFinanciero] = useState({ id_pago: '', estatus: 'pendiente', monto: '', motivo: '' });
  const [extraordinaria, setExtraordinaria] = useState({ id_docente: '', id_materia: '', fecha_limite_autorizacion: '', motivo: '' });
  const [aula, setAula] = useState({ id_horario: '', aula: '', motivo: '' });

  async function cargarDashboard() {
    setLoading(true);
    try {
      const response = await api.get('/admin/dashboard');
      setDashboard(response.data);
    } catch (requestError) {
      setMessage({ type: 'error', text: requestError?.response?.data?.message || 'No se pudo cargar el resumen ejecutivo.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDashboard();
  }, []);

  async function ejecutar(request, success) {
    setMessage(initialMessage);
    try {
      await request();
      setMessage({ type: 'ok', text: success });
      await cargarDashboard();
    } catch (requestError) {
      setMessage({ type: 'error', text: requestError?.response?.data?.message || 'No se pudo completar la operación.' });
    }
  }

  return (
    <section className="director-page">
      <header className="director-hero">
        <div>
          <p className="auth-eyebrow">Dirección ejecutiva</p>
          <h2>Panel del Director</h2>
          <p>Supervisión institucional, autorizaciones críticas y trazabilidad de decisiones.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={cargarDashboard} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar resumen'}
        </button>
      </header>

      <ActionMessage message={message} />

      <section className="director-section">
        <div className="section-heading">
          <h3>Supervisión integral</h3>
          <p>Indicadores académicos, financieros y de operación global.</p>
        </div>
        <div className="director-metric-grid">
          <article className="director-metric"><span>Alumnos</span><strong>{dashboard?.academico?.alumnos_total ?? '—'}</strong></article>
          <article className="director-metric"><span>Materias activas</span><strong>{dashboard?.academico?.materias_activas ?? '—'}</strong></article>
          <article className="director-metric"><span>Pagos vencidos</span><strong>{dashboard?.financiero?.pagos_vencidos ?? '—'}</strong></article>
          <article className="director-metric"><span>Entregas pendientes</span><strong>{dashboard?.academico?.entregas_pendientes_validacion ?? '—'}</strong></article>
        </div>
      </section>

      <div className="director-action-grid">
        <section className="director-section director-action-card">
          <h3>Gestión de folios de usuario</h3>
          <p>Asigna o reasigna el folio de una cuenta.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.patch(`/admin/usuarios/${folioUsuario.id_usuario}/folio`, { folio_matricula: folioUsuario.folio_matricula }), 'Folio de usuario actualizado.'); }}>
            <input id="director-folio-usuario-id" name="id_usuario" type="number" min="1" placeholder="ID de usuario" value={folioUsuario.id_usuario} onChange={(event) => setFolioUsuario({ ...folioUsuario, id_usuario: event.target.value })} required />
            <input id="director-folio-usuario" name="folio_matricula" placeholder="Folio nuevo (opcional)" value={folioUsuario.folio_matricula} onChange={(event) => setFolioUsuario({ ...folioUsuario, folio_matricula: event.target.value })} />
            <button className="btn-primary" type="submit">Guardar folio</button>
          </form>
        </section>

        <section className="director-section director-action-card">
          <h3>Folio de pago</h3>
          <p>Actualiza la referencia interna de un pago.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.patch(`/admin/pagos/${folioPago.id_pago}/folio`, { folio_interno: folioPago.folio_interno }), 'Folio de pago actualizado.'); }}>
            <input id="director-folio-pago-id" name="id_pago" type="number" min="1" placeholder="ID de pago" value={folioPago.id_pago} onChange={(event) => setFolioPago({ ...folioPago, id_pago: event.target.value })} required />
            <input id="director-folio-pago" name="folio_interno" placeholder="Folio interno" value={folioPago.folio_interno} onChange={(event) => setFolioPago({ ...folioPago, folio_interno: event.target.value })} required />
            <button className="btn-primary" type="submit">Actualizar referencia</button>
          </form>
        </section>

        <section className="director-section director-action-card director-critical-card">
          <h3>Override financiero</h3>
          <p>Todo cambio exige un motivo y genera auditoría.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.patch(`/admin/pagos/${financiero.id_pago}/estatus-director`, { estatus: financiero.estatus, monto: financiero.monto || undefined, motivo: financiero.motivo }), 'Cambio financiero autorizado y auditado.'); }}>
            <input id="director-financial-id" name="id_pago" type="number" min="1" placeholder="ID de pago" value={financiero.id_pago} onChange={(event) => setFinanciero({ ...financiero, id_pago: event.target.value })} required />
            <select id="director-financial-status" name="estatus" value={financiero.estatus} onChange={(event) => setFinanciero({ ...financiero, estatus: event.target.value })}><option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="vencido">Vencido</option></select>
            <input id="director-financial-amount" name="monto" type="number" min="0" step="0.01" placeholder="Monto opcional" value={financiero.monto} onChange={(event) => setFinanciero({ ...financiero, monto: event.target.value })} />
            <textarea id="director-financial-reason" name="motivo" placeholder="Motivo obligatorio" value={financiero.motivo} onChange={(event) => setFinanciero({ ...financiero, motivo: event.target.value })} required />
            <button className="btn-primary" type="submit">Autorizar cambio</button>
          </form>
        </section>

        <section className="director-section director-action-card">
          <h3>Calificación extemporánea</h3>
          <p>Autoriza una excepción docente con fecha límite y motivo.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.post('/admin/director/calificaciones-extemporaneas/autorizaciones', extraordinaria), 'Excepción académica autorizada.'); }}>
            <input id="director-extra-docente" name="id_docente" type="number" min="1" placeholder="ID docente" value={extraordinaria.id_docente} onChange={(event) => setExtraordinaria({ ...extraordinaria, id_docente: event.target.value })} required />
            <input id="director-extra-materia" name="id_materia" type="number" min="1" placeholder="ID materia" value={extraordinaria.id_materia} onChange={(event) => setExtraordinaria({ ...extraordinaria, id_materia: event.target.value })} required />
            <input id="director-extra-date" name="fecha_limite_autorizacion" type="datetime-local" value={extraordinaria.fecha_limite_autorizacion} onChange={(event) => setExtraordinaria({ ...extraordinaria, fecha_limite_autorizacion: event.target.value })} required />
            <textarea id="director-extra-reason" name="motivo" placeholder="Motivo de la excepción" value={extraordinaria.motivo} onChange={(event) => setExtraordinaria({ ...extraordinaria, motivo: event.target.value })} required />
            <button className="btn-primary" type="submit">Autorizar excepción</button>
          </form>
        </section>

        <section className="director-section director-action-card">
          <h3>Asignación de aulas</h3>
          <p>Asigna o reasigna un aula con trazabilidad.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.patch(`/admin/director/horarios/${aula.id_horario}/aula`, { aula: aula.aula, motivo: aula.motivo }), 'Aula asignada correctamente.'); }}>
            <input id="director-room-schedule" name="id_horario" type="number" min="1" placeholder="ID de horario" value={aula.id_horario} onChange={(event) => setAula({ ...aula, id_horario: event.target.value })} required />
            <input id="director-room" name="aula" placeholder="Aula" value={aula.aula} onChange={(event) => setAula({ ...aula, aula: event.target.value })} required />
            <input id="director-room-reason" name="motivo" placeholder="Motivo opcional" value={aula.motivo} onChange={(event) => setAula({ ...aula, motivo: event.target.value })} />
            <button className="btn-primary" type="submit">Guardar aula</button>
          </form>
        </section>

        <section className="director-section director-action-card director-audit-card">
          <h3>Auditoría institucional</h3>
          <p>Las operaciones críticas de este panel registran actor, módulo, entidad, motivo y cambios realizados en `auditoria_eventos`.</p>
          <span className="director-audit-badge">Trazabilidad activa</span>
        </section>
      </div>
    </section>
  );
}
