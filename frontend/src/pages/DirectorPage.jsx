import { useEffect, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import api from '../services/api';

const initialMessage = { type: '', text: '' };

function ActionMessage({ message }) {
  if (!message.text) return null;
  return <p className={message.type === 'error' ? 'error-box' : 'ok-box'} role="status">{message.text}</p>;
}

function SearchableSelect({ id, label, placeholder, value, onChange, items, onSearch, renderItem, renderValue }) {
  const [open, setOpen] = useState(false);
  const selectedItem = items.find((item) => String(item.id) === String(value));
  const [searchText, setSearchText] = useState('');

  return (
    <div className="director-combobox">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        value={searchText || (selectedItem ? renderValue(selectedItem) : '')}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setSearchText(event.target.value);
          onChange('');
          onSearch(event.target.value);
          setOpen(true);
        }}
      />
      {open && items.length > 0 ? (
        <div className="director-combobox-menu" role="listbox">
          {items.map((item) => (
            <button key={item.id} type="button" onClick={() => { setSearchText(''); onChange(String(item.id)); setOpen(false); }}>
              {renderItem(item)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toDateTimeLocal(date) {
  if (!date) return '';
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function DirectorPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [folioUsuario, setFolioUsuario] = useState({ id_usuario: '', folio_matricula: '' });
  const [folioPago, setFolioPago] = useState({ id_pago: '', folio_interno: '' });
  const [financiero, setFinanciero] = useState({ id_pago: '', estatus: 'pendiente', monto: '', motivo: '' });
  const [extraordinaria, setExtraordinaria] = useState({ id_docente: '', id_materia: '', fecha_limite_autorizacion: '', motivo: '' });
  const [aula, setAula] = useState({ id_horario: '', aula: '', motivo: '' });
  const [usuarios, setUsuarios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [usuarioSearch, setUsuarioSearch] = useState('');
  const [pagoSearch, setPagoSearch] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  async function cargarDashboard() {
    setLoading(true);
    try {
      const response = await api.get('/admin/director/dashboard');
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

  useEffect(() => {
    api.get('/admin/director/usuarios', { params: { q: usuarioSearch } }).then((response) => setUsuarios(response.data.items || [])).catch(() => setUsuarios([]));
  }, [usuarioSearch]);

  useEffect(() => {
    api.get('/admin/director/pagos', { params: { q: pagoSearch } }).then((response) => setPagos(response.data.items || [])).catch(() => setPagos([]));
  }, [pagoSearch]);

  async function ejecutar(request, success) {
    setMessage(initialMessage);
    setActionLoading(true);
    try {
      await request();
      setMessage({ type: 'ok', text: success });
      await cargarDashboard();
    } catch (requestError) {
      setMessage({ type: 'error', text: requestError?.response?.data?.message || 'No se pudo completar la operación.' });
    } finally {
      setActionLoading(false);
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

      <section id="director-supervision" className="director-section">
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
        <section id="director-folios" className="director-section director-action-card">
          <h3>Gestión de folios de usuario</h3>
          <p>Asigna o reasigna el folio de una cuenta.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.patch(`/admin/usuarios/${folioUsuario.id_usuario}/folio`, { folio_matricula: folioUsuario.folio_matricula }), 'Folio de usuario actualizado.'); }}>
            <SearchableSelect id="director-folio-usuario-id" label="Usuario" placeholder="Busca por nombre, correo o matrícula" value={folioUsuario.id_usuario} onChange={(id_usuario) => setFolioUsuario({ ...folioUsuario, id_usuario })} onSearch={setUsuarioSearch} items={usuarios} renderValue={(item) => `${item.nombre_completo} · ${item.folio_matricula}`} renderItem={(item) => <><strong>{item.nombre_completo}</strong><small>ID: {item.id_usuario} · {item.folio_matricula}</small></>} />
            <input id="director-folio-usuario" name="folio_matricula" placeholder="Folio nuevo (opcional)" value={folioUsuario.folio_matricula} onChange={(event) => setFolioUsuario({ ...folioUsuario, folio_matricula: event.target.value })} />
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar folio'}</button>
          </form>
        </section>

        <section className="director-section director-action-card">
          <h3>Folio de pago</h3>
          <p>Actualiza la referencia interna de un pago.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.patch(`/admin/pagos/${folioPago.id_pago}/folio`, { folio_interno: folioPago.folio_interno }), 'Folio de pago actualizado.'); }}>
            <SearchableSelect id="director-folio-pago-id" label="Pago" placeholder="Busca por concepto o folio" value={folioPago.id_pago} onChange={(id_pago) => setFolioPago({ ...folioPago, id_pago })} onSearch={setPagoSearch} items={pagos} renderValue={(item) => `${item.concepto} · ${item.estatus}`} renderItem={(item) => <><strong>{item.concepto}</strong><small>ID: {item.id_pago} · {item.estatus}</small></>} />
            <input id="director-folio-pago" name="folio_interno" placeholder="Folio interno" value={folioPago.folio_interno} onChange={(event) => setFolioPago({ ...folioPago, folio_interno: event.target.value })} required />
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Actualizando...' : 'Actualizar referencia'}</button>
          </form>
        </section>

        <section id="director-finanzas" className="director-section director-action-card director-critical-card">
          <h3>Override financiero</h3>
          <p>Todo cambio exige un motivo y genera auditoría.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.patch(`/admin/pagos/${financiero.id_pago}/estatus-director`, { estatus: financiero.estatus, monto: financiero.monto || undefined, motivo: financiero.motivo }), 'Cambio financiero autorizado y auditado.'); }}>
            <SearchableSelect id="director-financial-id" label="Pago a modificar" placeholder="Busca el pago por concepto o folio" value={financiero.id_pago} onChange={(id_pago) => setFinanciero({ ...financiero, id_pago })} onSearch={setPagoSearch} items={pagos} renderValue={(item) => `${item.concepto} · ${item.estatus}`} renderItem={(item) => <><strong>{item.concepto}</strong><small>ID: {item.id_pago} · {item.estatus}</small></>} />
            <select id="director-financial-status" name="estatus" value={financiero.estatus} onChange={(event) => setFinanciero({ ...financiero, estatus: event.target.value })}><option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="vencido">Vencido</option></select>
            <input id="director-financial-amount" name="monto" type="number" min="0" step="0.01" placeholder="Monto opcional" value={financiero.monto} onChange={(event) => setFinanciero({ ...financiero, monto: event.target.value })} />
            <textarea id="director-financial-reason" name="motivo" placeholder="Motivo obligatorio" value={financiero.motivo} onChange={(event) => setFinanciero({ ...financiero, motivo: event.target.value })} required />
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Autorizando...' : 'Autorizar cambio'}</button>
          </form>
        </section>

        <section id="director-academico" className="director-section director-action-card">
          <h3>Calificación extemporánea</h3>
          <p>Autoriza una excepción docente con fecha límite y motivo.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.post('/admin/director/calificaciones-extemporaneas/autorizaciones', extraordinaria), 'Excepción académica autorizada.'); }}>
            <input id="director-extra-docente" name="id_docente" type="number" min="1" placeholder="ID docente" value={extraordinaria.id_docente} onChange={(event) => setExtraordinaria({ ...extraordinaria, id_docente: event.target.value })} required />
            <input id="director-extra-materia" name="id_materia" type="number" min="1" placeholder="ID materia" value={extraordinaria.id_materia} onChange={(event) => setExtraordinaria({ ...extraordinaria, id_materia: event.target.value })} required />
            <div className="director-date-field"><label htmlFor="director-extra-date">Fecha límite</label><button type="button" id="director-extra-date" className="director-date-trigger" onClick={() => setCalendarOpen((open) => !open)}>{extraordinaria.fecha_limite_autorizacion ? new Date(extraordinaria.fecha_limite_autorizacion).toLocaleString('es-MX') : 'Seleccionar fecha y hora'}</button>{calendarOpen ? <div className="director-calendar"><DayPicker mode="single" selected={extraordinaria.fecha_limite_autorizacion ? new Date(extraordinaria.fecha_limite_autorizacion) : undefined} onSelect={(date) => { setExtraordinaria({ ...extraordinaria, fecha_limite_autorizacion: toDateTimeLocal(date) }); setCalendarOpen(false); }} /></div> : null}</div>
            <textarea id="director-extra-reason" name="motivo" placeholder="Motivo de la excepción" value={extraordinaria.motivo} onChange={(event) => setExtraordinaria({ ...extraordinaria, motivo: event.target.value })} required />
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Autorizando...' : 'Autorizar excepción'}</button>
          </form>
        </section>

        <section id="director-infraestructura" className="director-section director-action-card">
          <h3>Asignación de aulas</h3>
          <p>Asigna o reasigna un aula con trazabilidad.</p>
          <form className="form-grid" onSubmit={(event) => { event.preventDefault(); ejecutar(() => api.patch(`/admin/director/horarios/${aula.id_horario}/aula`, { aula: aula.aula, motivo: aula.motivo }), 'Aula asignada correctamente.'); }}>
            <input id="director-room-schedule" name="id_horario" type="number" min="1" placeholder="ID de horario" value={aula.id_horario} onChange={(event) => setAula({ ...aula, id_horario: event.target.value })} required />
            <input id="director-room" name="aula" placeholder="Aula" value={aula.aula} onChange={(event) => setAula({ ...aula, aula: event.target.value })} required />
            <input id="director-room-reason" name="motivo" placeholder="Motivo opcional" value={aula.motivo} onChange={(event) => setAula({ ...aula, motivo: event.target.value })} />
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar aula'}</button>
          </form>
        </section>

        <section id="director-auditoria" className="director-section director-action-card director-audit-card">
          <h3>Auditoría institucional</h3>
          <p>Las operaciones críticas de este panel registran actor, módulo, entidad, motivo y cambios realizados en `auditoria_eventos`.</p>
          <span className="director-audit-badge">Trazabilidad activa</span>
        </section>
      </div>
    </section>
  );
}
