import { useEffect, useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import 'react-day-picker/style.css';
import api from '../services/api';

const financieroSchema = z.object({
  id_pago: z.string().min(1, 'Selecciona un pago.'),
  estatus: z.enum(['pendiente', 'pagado', 'vencido']),
  monto: z.preprocess(
    (value) => {
      if (value === '' || value === undefined || value === null) return undefined;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    },
    z.number().min(0, 'El monto no puede ser negativo.').optional(),
  ),
  motivo: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres.'),
});

const extraordinariaSchema = z.object({
  id_docente: z.string().min(1, 'Selecciona un docente.'),
  id_materia: z.string().min(1, 'Selecciona una materia.'),
  fecha_limite_autorizacion: z.string().min(1, 'Selecciona la fecha límite.'),
  motivo: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres.'),
});

const folioUsuarioSchema = z.object({
  id_usuario: z.string().min(1, 'Selecciona un usuario.'),
  folio_matricula: z.string().optional(),
});

const folioPagoSchema = z.object({
  id_pago: z.string().min(1, 'Selecciona un pago.'),
  folio_interno: z.string().trim().min(1, 'El folio interno es obligatorio.'),
});

const aulaSchema = z.object({
  id_horario: z.string().min(1, 'Selecciona un horario.'),
  aula: z.string().trim().min(2, 'La aula es obligatoria.'),
  motivo: z.string().optional(),
});

const financieroDefaults = { id_pago: '', estatus: 'pendiente', monto: '', motivo: '' };
const extraordinariaDefaults = { id_docente: '', id_materia: '', fecha_limite_autorizacion: '', motivo: '' };
const folioUsuarioDefaults = { id_usuario: '', folio_matricula: '' };
const folioPagoDefaults = { id_pago: '', folio_interno: '' };
const aulaDefaults = { id_horario: '', aula: '', motivo: '' };

function SearchableSelect({ id, label, placeholder, value, onChange, items, onSearch, loading, renderItem, renderValue }) {
  const [open, setOpen] = useState(false);
  const selectedItem = items.find((item) => String(item.id) === String(value));
  const [searchText, setSearchText] = useState('');
  const [hasInteracted, setHasInteracted] = useState(false);

  const shouldShowMenu = open && hasInteracted;

  return (
    <div className="director-combobox" onBlur={() => setTimeout(() => setOpen(false), 100)}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        value={searchText || (selectedItem ? renderValue(selectedItem) : '')}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={() => {
          setHasInteracted(true);
          setOpen(true);
        }}
        onChange={(event) => {
          setSearchText(event.target.value);
          onChange('');
          onSearch(event.target.value);
          setHasInteracted(true);
          setOpen(true);
        }}
      />
      {shouldShowMenu ? (
        <div className="director-combobox-menu" role="listbox">
          {loading ? <p className="director-combobox-empty">Buscando...</p> : null}
          {!loading && items.length === 0 ? <p className="director-combobox-empty">Sin resultados</p> : null}
          {!loading ? items.map((item) => (
            <button key={item.id} type="button" onClick={() => { setSearchText(''); onChange(String(item.id)); setOpen(false); }}>
              {renderItem(item)}
            </button>
          )) : null}
        </div>
      ) : null}
    </div>
  );
}

function toDateTimeLocal(date, time = '12:00') {
  if (!date) return '';
  const [hours, minutes] = String(time || '12:00').split(':');
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(Number(hours) || 0)}:${pad(Number(minutes) || 0)}`;
}

function ConfirmModal({ data, onClose, onConfirm, loading }) {
  if (!data) return null;

  return (
    <div className="director-modal-overlay" role="presentation" onClick={onClose}>
      <div className="director-modal" role="dialog" aria-modal="true" aria-labelledby="director-modal-title" onClick={(event) => event.stopPropagation()}>
        <h4 id="director-modal-title">{data.title}</h4>
        <p>{data.description}</p>
        <div className="director-modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={loading}>{loading ? 'Procesando...' : data.confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ToastStack({ toasts }) {
  return (
    <div className="director-toast-stack" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <p key={toast.id} className={toast.type === 'error' ? 'error-box director-feedback' : 'ok-box director-feedback'}>{toast.text}</p>
      ))}
    </div>
  );
}

function normalizeAction(accion = '') {
  return accion
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMoney(value) {
  const parsed = Number(value || 0);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number.isNaN(parsed) ? 0 : parsed);
}

export default function DirectorPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmData, setConfirmData] = useState(null);
  const [activeKpi, setActiveKpi] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');

  const [usuarios, setUsuarios] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [auditFeed, setAuditFeed] = useState([]);

  const [usuarioSearch, setUsuarioSearch] = useState('');
  const [pagoSearch, setPagoSearch] = useState('');
  const [docenteSearch, setDocenteSearch] = useState('');
  const [materiaSearch, setMateriaSearch] = useState('');
  const [horarioSearch, setHorarioSearch] = useState('');

  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [pagosLoading, setPagosLoading] = useState(false);
  const [docentesLoading, setDocentesLoading] = useState(false);
  const [materiasLoading, setMateriasLoading] = useState(false);
  const [horariosLoading, setHorariosLoading] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState();
  const [selectedTime, setSelectedTime] = useState('12:00');

  const financieroForm = useForm({
    resolver: zodResolver(financieroSchema),
    defaultValues: financieroDefaults,
  });
  const extraordinariaForm = useForm({
    resolver: zodResolver(extraordinariaSchema),
    defaultValues: extraordinariaDefaults,
  });
  const folioUsuarioForm = useForm({
    resolver: zodResolver(folioUsuarioSchema),
    defaultValues: folioUsuarioDefaults,
  });
  const folioPagoForm = useForm({
    resolver: zodResolver(folioPagoSchema),
    defaultValues: folioPagoDefaults,
  });
  const aulaForm = useForm({
    resolver: zodResolver(aulaSchema),
    defaultValues: aulaDefaults,
  });
  const financieroValues = financieroForm.watch();
  const extraordinariaValues = extraordinariaForm.watch();
  const folioUsuarioValues = folioUsuarioForm.watch();
  const folioPagoValues = folioPagoForm.watch();
  const aulaValues = aulaForm.watch();

  function pushToast(type, text) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setToasts((current) => [...current, { id, type, text }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4200);
  }

  async function cargarDashboard() {
    setLoading(true);
    try {
      const [dashboardResponse, auditResponse] = await Promise.all([
        api.get('/admin/director/dashboard'),
        api.get('/admin/director/auditoria-eventos'),
      ]);
      setDashboard(dashboardResponse.data);
      setAuditFeed(auditResponse?.data?.items || []);
      setLastSyncAt(new Date().toISOString());
    } catch (requestError) {
      pushToast('error', requestError?.response?.data?.message || 'No se pudo cargar el resumen ejecutivo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    cargarDashboard();
  }, []);

  useEffect(() => {
    let active = true;
    setUsuariosLoading(true);
    api.get('/admin/director/usuarios', { params: { q: usuarioSearch } })
      .then((response) => {
        if (!active) return;
        setUsuarios(response.data.items || []);
      })
      .catch(() => {
        if (!active) return;
        setUsuarios([]);
      })
      .finally(() => {
        if (active) setUsuariosLoading(false);
      });
    return () => {
      active = false;
    };
  }, [usuarioSearch]);

  useEffect(() => {
    let active = true;
    setPagosLoading(true);
    api.get('/admin/director/pagos', { params: { q: pagoSearch } })
      .then((response) => {
        if (!active) return;
        setPagos(response.data.items || []);
      })
      .catch(() => {
        if (!active) return;
        setPagos([]);
      })
      .finally(() => {
        if (active) setPagosLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pagoSearch]);

  useEffect(() => {
    let active = true;
    setDocentesLoading(true);
    api.get('/admin/director/docentes', { params: { q: docenteSearch } })
      .then((response) => {
        if (!active) return;
        setDocentes(response.data.items || []);
      })
      .catch(() => {
        if (!active) return;
        setDocentes([]);
      })
      .finally(() => {
        if (active) setDocentesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [docenteSearch]);

  useEffect(() => {
    let active = true;
    setMateriasLoading(true);
    api.get('/admin/director/materias', { params: { q: materiaSearch } })
      .then((response) => {
        if (!active) return;
        setMaterias(response.data.items || []);
      })
      .catch(() => {
        if (!active) return;
        setMaterias([]);
      })
      .finally(() => {
        if (active) setMateriasLoading(false);
      });
    return () => {
      active = false;
    };
  }, [materiaSearch]);

  useEffect(() => {
    let active = true;
    setHorariosLoading(true);
    api.get('/admin/director/horarios', { params: { q: horarioSearch } })
      .then((response) => {
        if (!active) return;
        setHorarios(response.data.items || []);
      })
      .catch(() => {
        if (!active) return;
        setHorarios([]);
      })
      .finally(() => {
        if (active) setHorariosLoading(false);
      });
    return () => {
      active = false;
    };
  }, [horarioSearch]);

  const pagosVencidos = Number(dashboard?.financiero?.pagos_vencidos || 0);

  const metricCards = useMemo(() => {
    const cards = [
      {
        key: 'alumnos',
        title: 'Alumnos',
        value: dashboard?.academico?.alumnos_total ?? '—',
        trend: 'Matrícula activa en operación',
        status: 'ok',
        target: 'director-folios',
        onSelect: () => setUsuarioSearch(''),
      },
      {
        key: 'materias',
        title: 'Materias activas',
        value: dashboard?.academico?.materias_activas ?? '—',
        trend: 'Oferta académica vigente',
        status: 'ok',
        target: 'director-academico',
        onSelect: () => setMateriaSearch(''),
      },
      {
        key: 'pagos',
        title: 'Pagos vencidos',
        value: dashboard?.financiero?.pagos_vencidos ?? '—',
        trend: pagosVencidos > 0 ? `Riesgo alto: ${pagosVencidos} casos por atender` : 'Sin alertas críticas',
        status: pagosVencidos > 0 ? 'alert' : 'ok',
        target: 'director-finanzas',
        onSelect: () => setPagoSearch(pagosVencidos > 0 ? 'vencido' : ''),
      },
      {
        key: 'entregas',
        title: 'Entregas pendientes',
        value: dashboard?.academico?.entregas_pendientes_validacion ?? '—',
        trend: 'Pendientes de validación institucional',
        status: Number(dashboard?.academico?.entregas_pendientes_validacion || 0) > 0 ? 'warn' : 'ok',
        target: 'director-auditoria',
      },
    ];
    return cards;
  }, [dashboard, pagosVencidos]);

  function goToSection(card) {
    setActiveKpi(card.key);
    card.onSelect?.();
    const section = document.getElementById(card.target);
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function ejecutar(request, success, onSuccess) {
    setActionLoading(true);
    try {
      await request();
      pushToast('ok', success);
      onSuccess?.();
      await cargarDashboard();
    } catch (requestError) {
      pushToast('error', requestError?.response?.data?.message || 'No se pudo completar la operación.');
    } finally {
      setActionLoading(false);
    }
  }

  function solicitarConfirmacion(data, onConfirm) {
    setConfirmData({ ...data, run: onConfirm });
  }

  async function ejecutarConfirmacion() {
    if (!confirmData?.run) return;
    const operation = confirmData.run;
    setConfirmData(null);
    await operation();
  }

  const selectedPagoFinanciero = pagos.find((item) => String(item.id) === String(financieroValues.id_pago));

  const syncLabel = lastSyncAt
    ? `Última sync: ${new Date(lastSyncAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
    : 'Sin sincronización';

  return (
    <section className="director-page">
      <ToastStack toasts={toasts} />
      <ConfirmModal data={confirmData} onClose={() => setConfirmData(null)} onConfirm={ejecutarConfirmacion} loading={actionLoading} />

      <header className="director-hero">
        <div>
          <p className="auth-eyebrow">Dirección ejecutiva</p>
          <h2>Panel del Director</h2>
          <p>Supervisión institucional, autorizaciones críticas y trazabilidad de decisiones.</p>
        </div>
        <div className="director-hero-actions">
          <span className="director-sync-text">{syncLabel}</span>
          <button type="button" className="btn-secondary" onClick={cargarDashboard} disabled={loading}>
            {loading ? 'Actualizando...' : 'Actualizar resumen'}
          </button>
        </div>
      </header>

      <nav className="director-quick-nav" aria-label="Navegación rápida director">
        <a href="#director-supervision">Resumen</a>
        <a href="#director-folios">Folios</a>
        <a href="#director-finanzas">Finanzas</a>
        <a href="#director-academico">Académico</a>
        <a href="#director-infraestructura">Aulas</a>
        <a href="#director-auditoria">Auditoría</a>
      </nav>

      <section id="director-supervision" className="director-section">
        <div className="section-heading">
          <h3>Supervisión integral</h3>
          <p>Indicadores académicos, financieros y de operación global.</p>
        </div>
        <div className="director-metric-grid">
          {metricCards.map((card) => (
            <button
              key={card.key}
              type="button"
              className={`director-metric ${card.status === 'alert' ? 'is-alert' : ''} ${card.status === 'warn' ? 'is-warn' : ''} ${activeKpi === card.key ? 'is-active' : ''}`}
              onClick={() => goToSection(card)}
            >
              <span>{card.title}</span>
              <strong>{card.value}</strong>
              <small>{card.trend}</small>
              <em className={`director-metric-badge ${card.status === 'alert' ? 'is-alert' : card.status === 'warn' ? 'is-warn' : 'is-ok'}`}>
                {card.status === 'alert' ? 'Atención' : card.status === 'warn' ? 'Seguimiento' : 'OK'}
              </em>
            </button>
          ))}
        </div>
      </section>

      <div className="director-action-grid">
        <section id="director-folios" className="director-section director-action-card">
          <h3>Gestión de folios de usuario</h3>
          <p>Asigna o reasigna el folio de una cuenta.</p>
          <form className="form-grid" onSubmit={folioUsuarioForm.handleSubmit((values) => ejecutar(() => api.patch(`/admin/usuarios/${values.id_usuario}/folio`, { folio_matricula: values.folio_matricula || undefined }), 'Folio de usuario actualizado.', () => folioUsuarioForm.reset(folioUsuarioDefaults)))}>
            <SearchableSelect id="director-folio-usuario-id" label="Usuario" placeholder="Escribe nombre, correo o matrícula" value={folioUsuarioValues.id_usuario} onChange={(id_usuario) => folioUsuarioForm.setValue('id_usuario', id_usuario, { shouldDirty: true, shouldValidate: true })} onSearch={setUsuarioSearch} loading={usuariosLoading} items={usuarios.map((item) => ({ ...item, id: item.id_usuario }))} renderValue={(item) => `${item.nombre_completo} (ID: ${item.id_usuario} / Matrícula: ${item.folio_matricula || 'N/A'})`} renderItem={(item) => <><strong>{item.nombre_completo}</strong><small>ID: {item.id_usuario} / Matrícula: {item.folio_matricula || 'N/A'}</small></>} />
            {folioUsuarioForm.formState.errors.id_usuario ? <small className="director-field-error">{folioUsuarioForm.formState.errors.id_usuario.message}</small> : null}
            <input id="director-folio-usuario" placeholder="Folio nuevo (opcional)" {...folioUsuarioForm.register('folio_matricula')} />
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar folio'}</button>
          </form>
        </section>

        <section className="director-section director-action-card">
          <h3>Folio de pago</h3>
          <p>Actualiza la referencia interna de un pago.</p>
          <form className="form-grid" onSubmit={folioPagoForm.handleSubmit((values) => ejecutar(() => api.patch(`/admin/pagos/${values.id_pago}/folio`, { folio_interno: values.folio_interno }), 'Folio de pago actualizado.', () => folioPagoForm.reset(folioPagoDefaults)))}>
            <SearchableSelect id="director-folio-pago-id" label="Pago" placeholder="Escribe concepto, alumno o folio" value={folioPagoValues.id_pago} onChange={(id_pago) => folioPagoForm.setValue('id_pago', id_pago, { shouldDirty: true, shouldValidate: true })} onSearch={setPagoSearch} loading={pagosLoading} items={pagos.map((item) => ({ ...item, id: item.id_pago }))} renderValue={(item) => `${item.concepto} (ID: ${item.id_pago} / Alumno: ${item.id_alumno})`} renderItem={(item) => <><strong>{item.concepto}</strong><small>ID: {item.id_pago} / Alumno: {item.id_alumno} / {item.estatus}</small></>} />
            {folioPagoForm.formState.errors.id_pago ? <small className="director-field-error">{folioPagoForm.formState.errors.id_pago.message}</small> : null}
            <input id="director-folio-pago" placeholder="Folio interno" {...folioPagoForm.register('folio_interno')} />
            {folioPagoForm.formState.errors.folio_interno ? <small className="director-field-error">{folioPagoForm.formState.errors.folio_interno.message}</small> : null}
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Actualizando...' : 'Actualizar referencia'}</button>
          </form>
        </section>

          <section id="director-finanzas" className="director-section director-action-card director-critical-card">
          <h3>Override financiero</h3>
          <p>Todo cambio exige un motivo y genera auditoría.</p>
            <form className="form-grid" onSubmit={financieroForm.handleSubmit((values) => {
            solicitarConfirmacion({
              title: 'Confirmar override financiero',
                description: `¿Estás seguro de cambiar el pago #${values.id_pago || 'N/A'} a ${values.estatus.toUpperCase()} por ${formatMoney(values.monto ?? selectedPagoFinanciero?.monto ?? 0)}? Esta acción registrará auditoría e informará al área financiera.`,
              confirmLabel: 'Confirmar override',
              }, () => ejecutar(() => api.patch(`/admin/pagos/${values.id_pago}/estatus-director`, { estatus: values.estatus, monto: values.monto ?? undefined, motivo: values.motivo }), 'Cambio financiero autorizado y auditado.', () => financieroForm.reset(financieroDefaults)));
            })}>
              <SearchableSelect id="director-financial-id" label="Pago a modificar" placeholder="Escribe concepto, estado, alumno o folio" value={financieroValues.id_pago} onChange={(id_pago) => financieroForm.setValue('id_pago', id_pago, { shouldDirty: true, shouldValidate: true })} onSearch={setPagoSearch} loading={pagosLoading} items={pagos.map((item) => ({ ...item, id: item.id_pago }))} renderValue={(item) => `${item.concepto} (ID: ${item.id_pago} / Alumno: ${item.id_alumno})`} renderItem={(item) => <><strong>{item.concepto}</strong><small>ID: {item.id_pago} / {item.estatus} / {formatMoney(item.monto)}</small></>} />
              {financieroForm.formState.errors.id_pago ? <small className="director-field-error">{financieroForm.formState.errors.id_pago.message}</small> : null}
              <select id="director-financial-status" {...financieroForm.register('estatus')}><option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="vencido">Vencido</option></select>
              <input id="director-financial-amount" type="number" min="0" step="0.01" placeholder="Monto opcional" {...financieroForm.register('monto')} />
              {financieroForm.formState.errors.monto ? <small className="director-field-error">{financieroForm.formState.errors.monto.message}</small> : null}
              <textarea id="director-financial-reason" placeholder="Motivo obligatorio" {...financieroForm.register('motivo')} />
              {financieroForm.formState.errors.motivo ? <small className="director-field-error">{financieroForm.formState.errors.motivo.message}</small> : null}
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Autorizando...' : 'Autorizar cambio'}</button>
          </form>
        </section>

        <section id="director-academico" className="director-section director-action-card">
          <h3>Calificación extemporánea</h3>
          <p>Autoriza una excepción docente con fecha límite y motivo.</p>
            <form className="form-grid" onSubmit={extraordinariaForm.handleSubmit((values) => {
            solicitarConfirmacion({
              title: 'Confirmar excepción docente',
                description: `¿Autorizar excepción para el docente #${values.id_docente || 'N/A'} en la materia #${values.id_materia || 'N/A'} con fecha límite ${values.fecha_limite_autorizacion ? new Date(values.fecha_limite_autorizacion).toLocaleString('es-MX') : 'sin fecha'}? Esta acción quedará registrada en auditoría.`,
              confirmLabel: 'Autorizar excepción',
              }, () => ejecutar(() => api.post('/admin/director/calificaciones-extemporaneas/autorizaciones', values), 'Excepción académica autorizada.', () => {
                extraordinariaForm.reset(extraordinariaDefaults);
              setSelectedDate(undefined);
              setSelectedTime('12:00');
            }));
            })}>
              <SearchableSelect id="director-extra-docente" label="Docente" placeholder="Escribe nombre, correo o matrícula" value={extraordinariaValues.id_docente} onChange={(id_docente) => extraordinariaForm.setValue('id_docente', id_docente, { shouldDirty: true, shouldValidate: true })} onSearch={setDocenteSearch} loading={docentesLoading} items={docentes} renderValue={(item) => `${item.nombre_completo} (ID: ${item.id_docente})`} renderItem={(item) => <><strong>{item.nombre_completo}</strong><small>ID: {item.id_docente} / {item.correo || 'Sin correo'} / {item.folio_matricula || 'Sin matrícula'}</small></>} />
              {extraordinariaForm.formState.errors.id_docente ? <small className="director-field-error">{extraordinariaForm.formState.errors.id_docente.message}</small> : null}
              <SearchableSelect id="director-extra-materia" label="Materia" placeholder="Escribe nombre o código de materia" value={extraordinariaValues.id_materia} onChange={(id_materia) => extraordinariaForm.setValue('id_materia', id_materia, { shouldDirty: true, shouldValidate: true })} onSearch={setMateriaSearch} loading={materiasLoading} items={materias} renderValue={(item) => `${item.nombre_materia} (${item.codigo_materia})`} renderItem={(item) => <><strong>{item.nombre_materia}</strong><small>ID: {item.id_materia} / Código: {item.codigo_materia} / Bimestre: {item.bimestre_pertenece}</small></>} />
              {extraordinariaForm.formState.errors.id_materia ? <small className="director-field-error">{extraordinariaForm.formState.errors.id_materia.message}</small> : null}
            <div className="director-date-field">
              <label htmlFor="director-extra-date">Fecha límite</label>
              <button type="button" id="director-extra-date" className="director-date-trigger" onClick={() => setCalendarOpen((open) => !open)}>
                  {extraordinariaValues.fecha_limite_autorizacion ? new Date(extraordinariaValues.fecha_limite_autorizacion).toLocaleString('es-MX') : 'Seleccionar fecha y hora'}
              </button>
              {calendarOpen ? (
                <div className="director-calendar">
                  <DayPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                        extraordinariaForm.setValue('fecha_limite_autorizacion', toDateTimeLocal(date, selectedTime), { shouldDirty: true, shouldValidate: true });
                    }}
                  />
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(event) => {
                      const nextTime = event.target.value;
                      setSelectedTime(nextTime);
                      if (selectedDate) {
                          extraordinariaForm.setValue('fecha_limite_autorizacion', toDateTimeLocal(selectedDate, nextTime), { shouldDirty: true, shouldValidate: true });
                      }
                    }}
                  />
                </div>
              ) : null}
            </div>
              {extraordinariaForm.formState.errors.fecha_limite_autorizacion ? <small className="director-field-error">{extraordinariaForm.formState.errors.fecha_limite_autorizacion.message}</small> : null}
              <textarea id="director-extra-reason" placeholder="Motivo de la excepción" {...extraordinariaForm.register('motivo')} />
              {extraordinariaForm.formState.errors.motivo ? <small className="director-field-error">{extraordinariaForm.formState.errors.motivo.message}</small> : null}
              <button className="btn-primary" type="submit" disabled={actionLoading || !extraordinariaValues.fecha_limite_autorizacion}>{actionLoading ? 'Autorizando...' : 'Autorizar excepción'}</button>
          </form>
        </section>

        <section id="director-infraestructura" className="director-section director-action-card">
          <h3>Asignación de aulas</h3>
          <p>Asigna o reasigna un aula con trazabilidad.</p>
          <form className="form-grid" onSubmit={aulaForm.handleSubmit((values) => ejecutar(() => api.patch(`/admin/director/horarios/${values.id_horario}/aula`, { aula: values.aula, motivo: values.motivo || undefined }), 'Aula asignada correctamente.', () => aulaForm.reset(aulaDefaults)))}>
            <SearchableSelect id="director-room-schedule" label="Horario" placeholder="Escribe ID, periodo, turno o aula" value={aulaValues.id_horario} onChange={(id_horario) => aulaForm.setValue('id_horario', id_horario, { shouldDirty: true, shouldValidate: true })} onSearch={setHorarioSearch} loading={horariosLoading} items={horarios} renderValue={(item) => `Horario ${item.id_horario} (${item.periodo} · ${item.turno})`} renderItem={(item) => <><strong>Horario {item.id_horario} · {item.periodo}</strong><small>{item.modalidad} / {item.turno} / {item.hora_inicio}-{item.hora_fin} / Aula actual: {item.aula || 'Sin asignar'}</small></>} />
            {aulaForm.formState.errors.id_horario ? <small className="director-field-error">{aulaForm.formState.errors.id_horario.message}</small> : null}
            <input id="director-room" placeholder="Aula" {...aulaForm.register('aula')} />
            {aulaForm.formState.errors.aula ? <small className="director-field-error">{aulaForm.formState.errors.aula.message}</small> : null}
            <input id="director-room-reason" placeholder="Motivo opcional" {...aulaForm.register('motivo')} />
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar aula'}</button>
          </form>
        </section>

        <section id="director-auditoria" className="director-section director-action-card director-audit-card">
          <h3>Auditoría institucional</h3>
          <p>Feed en tiempo real de los últimos 5 eventos registrados en auditoría.</p>
          <span className="director-audit-badge">Trazabilidad activa</span>
          <div className="director-audit-feed">
            {auditFeed.length === 0 ? <p className="director-audit-empty">Sin eventos recientes.</p> : auditFeed.map((item) => (
              <article key={item.id_evento} className="director-audit-item">
                <header>
                  <strong>{item.actor?.nombre_completo || 'Usuario del sistema'}</strong>
                  <span>{new Date(item.fecha_evento).toLocaleString('es-MX')}</span>
                </header>
                <p>{normalizeAction(item.accion)} sobre {item.entidad} #{item.id_entidad || 'N/A'}</p>
                <small>{item.detalle?.motivo ? `Motivo: ${item.detalle.motivo}` : 'Evento registrado sin motivo explícito.'}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
