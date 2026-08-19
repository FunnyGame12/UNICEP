import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
import './ControlEscolarPage.css';

const cobroCajaSchema = z.object({
  alumno_id: z.string().min(1, 'Selecciona un alumno.'),
  concepto_folio_id: z.string().min(1, 'Selecciona un concepto de cobro.'),
  referencia_caja: z.string().trim().min(1, 'La referencia de caja es obligatoria.'),
  monto_recibido: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? NaN : Number(value)),
    z.number().positive('El monto debe ser mayor a $0.'),
  ),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'tarjeta']),
});

const rechazoComprobanteSchema = z.object({
  motivo: z.string().trim().min(8, 'La justificación debe tener al menos 8 caracteres.'),
});

const actualizarTramiteSchema = z.object({
  estatus: z.enum(['en_proceso', 'listo_para_entrega', 'entregado', 'cancelado']),
  notas_entrega: z.string().optional(),
});

const tabs = [
  { id: 'tesoreria', label: 'Tesorería y Comprobantes' },
  { id: 'accesos', label: 'Control de Accesos Financieros' },
  { id: 'tramites', label: 'Trámites Institucionales' },
];

function buildCajaReference() {
  const yearSuffix = String(new Date().getFullYear()).slice(-2);
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const randomValues = new Uint8Array(6);

  if (window && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(randomValues);
  } else {
    for (let index = 0; index < randomValues.length; index += 1) {
      randomValues[index] = Math.floor(Math.random() * alphabet.length);
    }
  }

  const token = Array.from(randomValues, (value) => alphabet[value % alphabet.length]).join('');
  return `CAJA-${yearSuffix}-${token}`;
}

const estatusLabels = {
  al_dia: 'Al día',
  deudor: 'Deudor',
  suspendido: 'Suspendido',
};

const tramiteLabels = {
  constancia: 'Constancia',
  credencial: 'Credencial',
  uniforme: 'Uniforme',
  papeleria_oficial: 'Papelería oficial',
};

function formatCurrency(value) {
  const parsed = Number(value || 0);
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number.isNaN(parsed) ? 0 : parsed);
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Date(value).toLocaleString('es-MX');
}

export default function ControlEscolarPage() {
  const [activeTab, setActiveTab] = useState('tesoreria');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [alumnos, setAlumnos] = useState([]);
  const [conceptos, setConceptos] = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [tramites, setTramites] = useState([]);

  const [selectedComprobante, setSelectedComprobante] = useState(null);
  const [selectedTramite, setSelectedTramite] = useState(null);

  const [searchAlumno, setSearchAlumno] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('');
  const [draftAccesos, setDraftAccesos] = useState({});

  const cobroForm = useForm({
    resolver: zodResolver(cobroCajaSchema),
    defaultValues: {
      alumno_id: '',
      concepto_folio_id: '',
      referencia_caja: buildCajaReference(),
      monto_recibido: '',
      metodo_pago: 'efectivo',
    },
  });

  const alumnoActualWatch = cobroForm.watch('alumno_id');
  const conceptoActualWatch = cobroForm.watch('concepto_folio_id');

  function regenerateCajaReference() {
    const newFolio = buildCajaReference();
    cobroForm.setValue('referencia_caja', newFolio, { shouldValidate: true });
    return newFolio;
  }

  useEffect(() => {
    if (!cobroForm.getValues('referencia_caja')) {
      regenerateCajaReference();
    }
  }, []);

  useEffect(() => {
    if (alumnoActualWatch || conceptoActualWatch) {
      regenerateCajaReference();
    }
  }, [alumnoActualWatch, conceptoActualWatch]);

  const rechazoForm = useForm({
    resolver: zodResolver(rechazoComprobanteSchema),
    defaultValues: { motivo: '' },
  });

  const tramiteForm = useForm({
    resolver: zodResolver(actualizarTramiteSchema),
    defaultValues: {
      estatus: 'en_proceso',
      notas_entrega: '',
    },
  });

  async function loadAll() {
    setLoading(true);
    setError('');

    try {
      const [alumnosResp, conceptosResp, comprobantesResp, tramitesResp] = await Promise.all([
        api.get('/control-escolar/alumnos-estatus'),
        api.get('/control-escolar/conceptos-activos'),
        api.get('/control-escolar/comprobantes-pendientes'),
        api.get('/control-escolar/tramites'),
      ]);

      const alumnosItems = alumnosResp?.data?.items || [];
      setAlumnos(alumnosItems);
      setConceptos(conceptosResp?.data?.items || []);
      setComprobantes(comprobantesResp?.data?.items || []);
      setTramites(tramitesResp?.data?.items || []);

      setDraftAccesos(
        alumnosItems.reduce((acc, item) => {
          acc[item.id_alumno] = {
            estatus_financiero: item.estatus_financiero,
            bloqueo_plataforma: Boolean(item.bloqueo_plataforma),
            bloqueo_calificaciones: Boolean(item.bloqueo_calificaciones),
          };
          return acc;
        }, {}),
      );

      if (!selectedComprobante && (comprobantesResp?.data?.items || []).length > 0) {
        setSelectedComprobante(comprobantesResp.data.items[0]);
      }
      if (!selectedTramite && (tramitesResp?.data?.items || []).length > 0) {
        setSelectedTramite(tramitesResp.data.items[0]);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el módulo de Control Escolar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedTramite) return;
    tramiteForm.reset({
      estatus: selectedTramite.estatus === 'recibido' || selectedTramite.estatus === 'en_revision'
        ? 'en_proceso'
        : selectedTramite.estatus,
      notas_entrega: selectedTramite.respuesta || '',
    });
  }, [selectedTramite, tramiteForm]);

  const alumnosFiltered = useMemo(() => {
    const q = searchAlumno.trim().toLowerCase();
    return alumnos.filter((item) => {
      const matchesQ = !q
        || String(item.nombre_completo || '').toLowerCase().includes(q)
        || String(item.folio_matricula || '').toLowerCase().includes(q)
        || String(item.correo || '').toLowerCase().includes(q);
      const matchesStatus = !filterEstatus || item.estatus_financiero === filterEstatus;
      return matchesQ && matchesStatus;
    });
  }, [alumnos, searchAlumno, filterEstatus]);

  async function submitCobro(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/control-escolar/registrar-cobro-caja', {
        alumno_id: Number(values.alumno_id),
        concepto_folio_id: Number(values.concepto_folio_id),
        referencia_caja: values.referencia_caja.trim(),
        monto_recibido: Number(values.monto_recibido),
        metodo_pago: values.metodo_pago,
      });

      setMessage('Cobro de caja registrado correctamente.');
      const siguienteFolio = regenerateCajaReference();
      cobroForm.reset({
        alumno_id: '',
        concepto_folio_id: '',
        referencia_caja: siguienteFolio,
        monto_recibido: '',
        metodo_pago: 'efectivo',
      });
      await loadAll();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar el cobro de caja.');
    } finally {
      setSending(false);
    }
  }

  async function aprobarComprobante(item) {
    const pagoId = item?.pago_relacionado?.id_pago;
    if (!pagoId) {
      setError('El comprobante no tiene un pago relacionado para aprobar.');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.put(`/control-escolar/validar-comprobante/${pagoId}`, {
        decision: 'aprobar',
        id_tramite: item.id_tramite,
      });
      setMessage('Comprobante aprobado correctamente.');
      rechazoForm.reset({ motivo: '' });
      await loadAll();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo aprobar el comprobante.');
    } finally {
      setSending(false);
    }
  }

  async function rechazarComprobante(values) {
    if (!selectedComprobante) {
      setError('Selecciona un comprobante para rechazar.');
      return;
    }

    const pagoId = selectedComprobante?.pago_relacionado?.id_pago;
    if (!pagoId) {
      setError('El comprobante no tiene un pago relacionado para rechazar.');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.put(`/control-escolar/validar-comprobante/${pagoId}`, {
        decision: 'rechazar',
        motivo: values.motivo.trim(),
        id_tramite: selectedComprobante.id_tramite,
      });
      setMessage('Comprobante rechazado y notificado al alumno.');
      rechazoForm.reset({ motivo: '' });
      await loadAll();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo rechazar el comprobante.');
    } finally {
      setSending(false);
    }
  }

  async function guardarAccesos(idAlumno) {
    const draft = draftAccesos[idAlumno];
    if (!draft) return;

    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.put(`/control-escolar/alumnos/${idAlumno}/accesos`, draft);
      setMessage(`Accesos financieros actualizados para el alumno #${idAlumno}.`);
      await loadAll();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudieron actualizar los accesos del alumno.');
    } finally {
      setSending(false);
    }
  }

  async function guardarTramite(values) {
    if (!selectedTramite) {
      setError('Selecciona un trámite para actualizar.');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.put(`/control-escolar/tramites/${selectedTramite.id_tramite}/estatus`, {
        estatus: values.estatus,
        notas_entrega: values.notas_entrega?.trim() || undefined,
      });
      setMessage('Estatus del trámite actualizado correctamente.');
      await loadAll();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo actualizar el trámite.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="control-escolar-page">
      <header className="ce-header">
        <p className="ce-eyebrow">Módulo separado de Coordinación</p>
        <h2>Control Escolar · Tesorería y Ventanilla</h2>
        <p>Valida pagos, administra bloqueos financieros y gestiona entrega de trámites institucionales.</p>
      </header>

      <div className="ce-tabs" role="tablist" aria-label="Secciones de Control Escolar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'is-active' : ''}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message ? <p className="ok-box ce-feedback">{message}</p> : null}
      {error ? <p className="error-box ce-feedback">{error}</p> : null}

      {activeTab === 'tesoreria' ? (
        <div className="ce-grid-2">
          <article className="ce-card">
            <h3>Cobro rápido en ventanilla</h3>
            <form className="form-grid" onSubmit={cobroForm.handleSubmit(submitCobro)}>
              <label htmlFor="ce-alumno">Alumno</label>
              <select id="ce-alumno" {...cobroForm.register('alumno_id')}>
                <option value="">Selecciona un alumno</option>
                {alumnos.map((alumno) => (
                  <option key={alumno.id_alumno} value={String(alumno.id_alumno)}>
                    {`${alumno.folio_matricula || 'SIN-FOLIO'} · ${alumno.nombre_completo}`}
                  </option>
                ))}
              </select>
              {cobroForm.formState.errors.alumno_id ? <small>{cobroForm.formState.errors.alumno_id.message}</small> : null}

              <label htmlFor="ce-concepto">Concepto de pago</label>
              <select id="ce-concepto" {...cobroForm.register('concepto_folio_id')}>
                <option value="">Selecciona un concepto</option>
                {conceptos.map((concepto) => (
                  <option key={concepto.id_concepto_pago} value={String(concepto.id_concepto_pago)}>
                    {`${concepto.nombre} (${concepto.folio_interno})`}
                  </option>
                ))}
              </select>
              {cobroForm.formState.errors.concepto_folio_id ? <small>{cobroForm.formState.errors.concepto_folio_id.message}</small> : null}

              <label htmlFor="ce-referencia">Referencia de caja</label>
              <div className="ce-reference-field">
                <input
                  id="ce-referencia"
                  readOnly
                  placeholder="CAJA-YY-XXXXXX"
                  {...cobroForm.register('referencia_caja')}
                />
                <button
                  type="button"
                  className="ce-reference-button"
                  aria-label="Regenerar referencia de caja"
                  onClick={regenerateCajaReference}
                >
                  🔄
                </button>
              </div>
              {cobroForm.formState.errors.referencia_caja ? <small>{cobroForm.formState.errors.referencia_caja.message}</small> : null}

              <label htmlFor="ce-monto">Monto recibido</label>
              <input id="ce-monto" type="number" min="0.01" step="0.01" placeholder="0.00" {...cobroForm.register('monto_recibido')} />
              {cobroForm.formState.errors.monto_recibido ? <small>{cobroForm.formState.errors.monto_recibido.message}</small> : null}

              <label htmlFor="ce-metodo">Método de pago</label>
              <select id="ce-metodo" {...cobroForm.register('metodo_pago')}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="tarjeta">Tarjeta</option>
              </select>

              <button type="submit" className="btn-primary" disabled={sending || loading}>
                {sending ? 'Registrando...' : 'Registrar cobro'}
              </button>
            </form>
          </article>

          <article className="ce-card">
            <h3>Comprobantes pendientes</h3>
            {loading ? <p>Cargando comprobantes...</p> : null}
            {!loading && comprobantes.length === 0 ? <p>Sin comprobantes pendientes.</p> : null}

            <div className="ce-list">
              {comprobantes.map((item) => (
                <button
                  key={item.id_tramite}
                  type="button"
                  className={selectedComprobante?.id_tramite === item.id_tramite ? 'ce-list-item is-selected' : 'ce-list-item'}
                  onClick={() => setSelectedComprobante(item)}
                >
                  <strong>{item.alumno_nombre || 'Alumno sin nombre'}</strong>
                  <span>{item.folio_matricula || 'SIN-FOLIO'}</span>
                  <span>{item.pago_relacionado?.concepto || 'Concepto por confirmar'}</span>
                </button>
              ))}
            </div>

            {selectedComprobante ? (
              <div className="ce-preview">
                <p><strong>Folio:</strong> {selectedComprobante.folio_matricula || 'SIN-FOLIO'}</p>
                <p><strong>Concepto:</strong> {selectedComprobante.pago_relacionado?.concepto || 'No asociado'}</p>
                <p><strong>Monto:</strong> {formatCurrency(selectedComprobante.pago_relacionado?.monto)}</p>
                <p><strong>Archivo:</strong> {selectedComprobante.comprobante_url ? <a href={selectedComprobante.comprobante_url} target="_blank" rel="noreferrer">Abrir comprobante</a> : 'Sin archivo adjunto'}</p>

                <div className="ce-actions-row">
                  <button type="button" className="btn-secondary" onClick={() => aprobarComprobante(selectedComprobante)} disabled={sending}>Aprobar</button>
                </div>

                <form className="form-grid ce-reject-form" onSubmit={rechazoForm.handleSubmit(rechazarComprobante)}>
                  <label htmlFor="ce-rechazo-motivo">Motivo de rechazo</label>
                  <textarea className="ce-textarea" id="ce-rechazo-motivo" rows="3" placeholder="Describe por qué se rechaza el comprobante." {...rechazoForm.register('motivo')} />
                  {rechazoForm.formState.errors.motivo ? <small>{rechazoForm.formState.errors.motivo.message}</small> : null}
                  <button type="submit" className="btn-danger" disabled={sending}>Rechazar y notificar</button>
                </form>
              </div>
            ) : null}
          </article>
        </div>
      ) : null}

      {activeTab === 'accesos' ? (
        <article className="ce-card">
          <header className="ce-subheader">
            <h3>Bloqueos administrativos por adeudo</h3>
            <div className="ce-filters">
              <input
                value={searchAlumno}
                onChange={(event) => setSearchAlumno(event.target.value)}
                placeholder="Buscar por folio, nombre o correo"
              />
              <select value={filterEstatus} onChange={(event) => setFilterEstatus(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="al_dia">Al día</option>
                <option value="deudor">Deudor</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </div>
          </header>

          <div className="table-wrap ce-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Alumno</th>
                  <th>Estatus financiero</th>
                  <th>Bloqueo plataforma</th>
                  <th>Bloqueo calificaciones</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5">Cargando alumnos...</td>
                  </tr>
                ) : null}
                {!loading && alumnosFiltered.length === 0 ? (
                  <tr>
                    <td colSpan="5">Sin resultados para los filtros seleccionados.</td>
                  </tr>
                ) : null}

                {!loading ? alumnosFiltered.map((item) => {
                  const draft = draftAccesos[item.id_alumno] || {
                    estatus_financiero: item.estatus_financiero,
                    bloqueo_plataforma: Boolean(item.bloqueo_plataforma),
                    bloqueo_calificaciones: Boolean(item.bloqueo_calificaciones),
                  };
                  return (
                    <tr key={item.id_alumno}>
                      <td>
                        <strong>{item.nombre_completo}</strong>
                        <p>{item.folio_matricula || 'SIN-FOLIO'}</p>
                      </td>
                      <td>
                        <select
                          value={draft.estatus_financiero}
                          onChange={(event) => setDraftAccesos((prev) => ({
                            ...prev,
                            [item.id_alumno]: {
                              ...draft,
                              estatus_financiero: event.target.value,
                            },
                          }))}
                        >
                          {Object.entries(estatusLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="ce-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.bloqueo_plataforma)}
                            onChange={(event) => setDraftAccesos((prev) => ({
                              ...prev,
                              [item.id_alumno]: {
                                ...draft,
                                bloqueo_plataforma: event.target.checked,
                              },
                            }))}
                          />
                          <span>{draft.bloqueo_plataforma ? 'Suspendido' : 'Habilitado'}</span>
                        </label>
                      </td>
                      <td>
                        <label className="ce-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(draft.bloqueo_calificaciones)}
                            onChange={(event) => setDraftAccesos((prev) => ({
                              ...prev,
                              [item.id_alumno]: {
                                ...draft,
                                bloqueo_calificaciones: event.target.checked,
                              },
                            }))}
                          />
                          <span>{draft.bloqueo_calificaciones ? 'Ocultas' : 'Visibles'}</span>
                        </label>
                      </td>
                      <td>
                        <button type="button" className="btn-secondary" onClick={() => guardarAccesos(item.id_alumno)} disabled={sending}>
                          Guardar
                        </button>
                      </td>
                    </tr>
                  );
                }) : null}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      {activeTab === 'tramites' ? (
        <div className="ce-grid-2">
          <article className="ce-card">
            <h3>Bandeja de solicitudes</h3>
            {loading ? <p>Cargando trámites...</p> : null}
            {!loading && tramites.length === 0 ? <p>Sin solicitudes de trámites institucionales.</p> : null}

            <div className="ce-list">
              {tramites.map((item) => (
                <button
                  key={item.id_tramite}
                  type="button"
                  className={selectedTramite?.id_tramite === item.id_tramite ? 'ce-list-item is-selected' : 'ce-list-item'}
                  onClick={() => setSelectedTramite(item)}
                >
                  <strong>{item.alumno?.usuario?.nombre_completo || 'Alumno'}</strong>
                  <span>{tramiteLabels[item.tipo] || item.tipo}</span>
                  <span>{item.estatus}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="ce-card">
            <h3>Actualización de estatus</h3>
            {!selectedTramite ? <p>Selecciona un trámite para continuar.</p> : null}
            {selectedTramite ? (
              <>
                <p><strong>Alumno:</strong> {selectedTramite.alumno?.usuario?.nombre_completo || 'No disponible'}</p>
                <p><strong>Folio:</strong> {selectedTramite.alumno?.usuario?.folio_matricula || 'SIN-FOLIO'}</p>
                <p><strong>Tipo:</strong> {tramiteLabels[selectedTramite.tipo] || selectedTramite.tipo}</p>
                <p><strong>Descripción:</strong> {selectedTramite.descripcion}</p>

                <form className="form-grid" onSubmit={tramiteForm.handleSubmit(guardarTramite)}>
                  <label htmlFor="ce-tramite-estatus">Estatus</label>
                  <select id="ce-tramite-estatus" {...tramiteForm.register('estatus')}>
                    <option value="en_proceso">En proceso</option>
                    <option value="listo_para_entrega">Listo para entrega</option>
                    <option value="entregado">Entregado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  {tramiteForm.formState.errors.estatus ? <small>{tramiteForm.formState.errors.estatus.message}</small> : null}

                  <label htmlFor="ce-tramite-notas">Notas de entrega (opcional)</label>
                  <textarea className="ce-textarea" id="ce-tramite-notas" rows="4" placeholder="Observaciones de ventanilla o entrega física." {...tramiteForm.register('notas_entrega')} />

                  <button type="submit" className="btn-primary" disabled={sending}>Actualizar trámite</button>
                </form>
              </>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}
