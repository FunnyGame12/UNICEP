import { useEffect, useMemo, useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import 'react-day-picker/style.css';
import api from '../services/api';

const financieroSchema = z.object({
  id_alumno: z.string().min(1, 'Selecciona un alumno.'),
  id_pago: z.string().min(1, 'Selecciona un pago.'),
  estatus: z.enum(['pendiente', 'pagado', 'condonado', 'cancelado']),
  motivo: z.string().trim().optional(),
});

const extraordinariaSchema = z.object({
  id_docente: z.string().min(1, 'Selecciona un docente.'),
  id_materia: z.string().min(1, 'Selecciona una materia.'),
  fecha_limite_autorizacion: z.string().min(1, 'Selecciona la fecha límite.'),
  motivo: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres.'),
});

const folioUsuarioSchema = z.object({
  nombre_destinatario: z.string().trim().min(3, 'Escribe el nombre del destinatario.'),
  rol: z.enum(['control_escolar', 'coordinacion', 'docente', 'alumno']),
  folio_matricula: z.string().optional(),
});

const folioPagoSchema = z.object({
  clasificacion: z.enum(['base', 'subrama']),
  nombre: z.string().trim().min(3, 'El nombre del concepto debe tener al menos 3 caracteres.'),
  precio_base_inicial: z.preprocess(
    (value) => {
      if (value === '' || value === undefined || value === null) return undefined;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    },
    z.number().min(0, 'El precio base debe ser mayor o igual a 0.').optional(),
  ),
  id_concepto_padre: z.string().optional(),
  naturaleza_ajuste: z.enum(['descuento', 'penalizacion']).optional(),
  modo_aplicacion: z.enum(['monto_fijo', 'porcentaje']).optional(),
  valor_ajuste: z.preprocess(
    (value) => {
      if (value === '' || value === undefined || value === null) return undefined;
      const parsed = Number(value);
      return Number.isNaN(parsed) ? value : parsed;
    },
    z.number().positive('El valor del ajuste debe ser positivo.').optional(),
  ),
  folio_interno: z.string().trim().min(10, 'El folio debe tener al menos 10 caracteres.'),
}).superRefine((value, ctx) => {
  if (value.clasificacion === 'base') {
    if (value.precio_base_inicial === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['precio_base_inicial'],
        message: 'El precio base inicial es obligatorio para conceptos base.',
      });
    }
  }

  if (value.clasificacion === 'subrama') {
    if (!value.id_concepto_padre) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['id_concepto_padre'],
        message: 'Debes seleccionar un concepto base activo.',
      });
    }
    if (!value.naturaleza_ajuste) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['naturaleza_ajuste'],
        message: 'Selecciona la naturaleza del ajuste.',
      });
    }
    if (!value.modo_aplicacion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modo_aplicacion'],
        message: 'Selecciona el modo de aplicación.',
      });
    }
    if (value.valor_ajuste === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['valor_ajuste'],
        message: 'El valor del ajuste es obligatorio para subramas.',
      });
    }
  }
});

const aulaSchema = z.object({
  id_horario: z.string().min(1, 'Selecciona un horario.'),
  aula: z.string().trim().min(2, 'La aula es obligatoria.'),
  motivo: z.string().optional(),
});

const financieroDefaults = { id_alumno: '', id_pago: '', estatus: 'pendiente', motivo: '' };
const extraordinariaDefaults = { id_docente: '', id_materia: '', fecha_limite_autorizacion: '', motivo: '' };
const folioUsuarioDefaults = { nombre_destinatario: '', rol: '', folio_matricula: '' };
const folioPagoDefaults = {
  clasificacion: 'base',
  nombre: '',
  precio_base_inicial: '',
  id_concepto_padre: '',
  naturaleza_ajuste: 'descuento',
  modo_aplicacion: 'monto_fijo',
  valor_ajuste: '',
  folio_interno: '',
};
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

function classifyEmailDomain(correo = '') {
  const normalized = String(correo || '').trim().toLowerCase();
  if (normalized.endsWith('@unicepmerida.edu.mx')) return 'institucional';
  if (normalized.endsWith('@gmail.com')) return 'gmail';
  return 'otro';
}

const FOLIO_ROLE_OPTIONS = [
  { value: 'control_escolar', label: 'Control Escolar' },
  { value: 'coordinacion', label: 'Coordinación Académica' },
  { value: 'docente', label: 'Maestro / Docente' },
  { value: 'alumno', label: 'Alumno' },
];

const ROLE_PREFIX = {
  control_escolar: 'CTL',
  coordinacion: 'COO',
  docente: 'DOC',
  alumno: 'ALU',
};

function randomFolioToken(length = 6) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function buildRoleFolio(rol) {
  const prefix = ROLE_PREFIX[String(rol || '').trim().toLowerCase()];
  if (!prefix) return '';
  const yy = String(new Date().getFullYear()).slice(-2);
  return `${prefix}-${yy}-${randomFolioToken(6)}`;
}

function safeConceptLetters(nombre = '') {
  const cleaned = String(nombre || '').toUpperCase().replace(/[^A-Z]/g, '');
  const padded = `${cleaned}XXX`;
  return padded.slice(0, 3);
}

function randomSecureToken(length = 4) {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = new Uint32Array(length);
  window.crypto.getRandomValues(bytes);
  let token = '';
  for (let index = 0; index < length; index += 1) {
    token += alphabet[bytes[index] % alphabet.length];
  }
  return token;
}

function buildConceptoFolio({ nombre, clasificacion, naturalezaAjuste }) {
  const yy = String(new Date().getFullYear()).slice(-2);
  const nameCode = safeConceptLetters(nombre);
  const suffix = randomSecureToken(4);
  if (clasificacion === 'subrama') {
    const branchTag = naturalezaAjuste === 'descuento' ? 'DESC' : 'PEN';
    return `${yy}-${nameCode}-${branchTag}-${suffix}`;
  }
  return `${yy}-${nameCode}-${suffix}`;
}

function roleLabel(rol = '') {
  const normalized = String(rol || '').trim().toLowerCase();
  if (normalized === 'director') return 'Director';
  if (normalized === 'control_escolar') return 'Control Escolar';
  if (normalized === 'coordinacion') return 'Coordinación';
  if (normalized === 'docente') return 'Docente';
  if (normalized === 'alumno') return 'Alumno';
  if (normalized === 'administrativo') return 'Administrativo';
  return normalized || 'Sin rol';
}

export default function DirectorPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [folioAutoLoading, setFolioAutoLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmData, setConfirmData] = useState(null);
  const [activeKpi, setActiveKpi] = useState('');
  const [lastSyncAt, setLastSyncAt] = useState('');
  const [folioRows, setFolioRows] = useState([]);
  const [folioRowsLoading, setFolioRowsLoading] = useState(false);
  const [folioRoleFilter, setFolioRoleFilter] = useState('');
  const [folioNameFilter, setFolioNameFilter] = useState('');
  const [conceptosPagoCatalogo, setConceptosPagoCatalogo] = useState([]);
  const [conceptosPagoHierarchy, setConceptosPagoHierarchy] = useState([]);
  const [conceptosPagoLoading, setConceptosPagoLoading] = useState(false);
  const [conceptoSearch, setConceptoSearch] = useState('');
  const [conceptoSort, setConceptoSort] = useState('az');
  const [editingConceptoId, setEditingConceptoId] = useState(null);

  const [pagos, setPagos] = useState([]);
  const [pagosAlumnoOverride, setPagosAlumnoOverride] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [auditFeed, setAuditFeed] = useState([]);

  const [pagoSearch, setPagoSearch] = useState('');
  const [alumnoOverrideSearch, setAlumnoOverrideSearch] = useState('');
  const [docenteSearch, setDocenteSearch] = useState('');
  const [materiaSearch, setMateriaSearch] = useState('');
  const [horarioSearch, setHorarioSearch] = useState('');

  const [pagosLoading, setPagosLoading] = useState(false);
  const [alumnosOverrideLoading, setAlumnosOverrideLoading] = useState(false);
  const [docentesLoading, setDocentesLoading] = useState(false);
  const [materiasLoading, setMateriasLoading] = useState(false);
  const [horariosLoading, setHorariosLoading] = useState(false);

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState();
  const [selectedTime, setSelectedTime] = useState('12:00');
  const [alumnosOverride, setAlumnosOverride] = useState([]);
  const [selectedAlumnoOverrideName, setSelectedAlumnoOverrideName] = useState('');

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
    setFolioRowsLoading(true);
    api.get('/admin/director/folios', { params: { rol: folioRoleFilter || undefined, q: folioNameFilter || undefined } })
      .then((response) => {
        if (!active) return;
        setFolioRows(response?.data?.items || []);
      })
      .catch(() => {
        if (!active) return;
        setFolioRows([]);
      })
      .finally(() => {
        if (active) setFolioRowsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lastSyncAt, folioRoleFilter, folioNameFilter]);

  useEffect(() => {
    let active = true;
    setConceptosPagoLoading(true);
    api.get('/admin/director/conceptos-pago', { params: { q: conceptoSearch || undefined, sort: conceptoSort } })
      .then((response) => {
        if (!active) return;
        setConceptosPagoCatalogo(response?.data?.items || []);
        setConceptosPagoHierarchy(response?.data?.hierarchy || []);
      })
      .catch(() => {
        if (!active) return;
        setConceptosPagoCatalogo([]);
        setConceptosPagoHierarchy([]);
      })
      .finally(() => {
        if (active) setConceptosPagoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lastSyncAt, conceptoSearch, conceptoSort]);

  useEffect(() => {
    let active = true;
    setAlumnosOverrideLoading(true);
    api.get('/admin/director/alumnos-override', { params: { q: alumnoOverrideSearch } })
      .then((response) => {
        if (!active) return;
        setAlumnosOverride(response.data.items || []);
      })
      .catch(() => {
        if (!active) return;
        setAlumnosOverride([]);
      })
      .finally(() => {
        if (active) setAlumnosOverrideLoading(false);
      });
    return () => {
      active = false;
    };
  }, [alumnoOverrideSearch]);

  useEffect(() => {
    const idAlumno = Number(financieroValues.id_alumno || 0);
    if (!idAlumno) {
      setPagosAlumnoOverride([]);
      setPagosLoading(false);
      return;
    }

    let active = true;
    setPagosLoading(true);
    api.get('/admin/director/pagos', { params: { id_alumno: idAlumno } })
      .then((response) => {
        if (!active) return;
        setPagosAlumnoOverride(response.data.items || []);
      })
      .catch(() => {
        if (!active) return;
        setPagosAlumnoOverride([]);
      })
      .finally(() => {
        if (active) setPagosLoading(false);
      });

    return () => {
      active = false;
    };
  }, [financieroValues.id_alumno]);

  useEffect(() => {
    if (!financieroValues.id_alumno) {
      setSelectedAlumnoOverrideName('');
    }
  }, [financieroValues.id_alumno]);

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

  const selectedPagoFinanciero = pagosAlumnoOverride.find((item) => String(item.id_pago) === String(financieroValues.id_pago));
  const alumnoSeleccionadoValido = Boolean(financieroValues.id_alumno);
  const folioSelectorDisabled = !alumnoSeleccionadoValido || pagosLoading || pagosAlumnoOverride.length === 0;
  const folioPlaceholder = !alumnoSeleccionadoValido
    ? 'Primero selecciona un alumno'
    : pagosLoading
      ? 'Cargando folios del alumno...'
      : pagosAlumnoOverride.length === 0
        ? 'Este alumno no tiene folios o adeudos pendientes'
        : `Selecciona un folio/adeudo de ${selectedAlumnoOverrideName || 'este alumno'}`;
  const selectedFolioRole = String(folioUsuarioValues.rol || '').trim().toLowerCase();
  const conceptYearPrefix = String(new Date().getFullYear()).slice(-2);

  async function generarFolioAleatorioUsuario() {
    if (!selectedFolioRole) {
      pushToast('error', 'Selecciona un rol para generar el folio.');
      return;
    }

    setFolioAutoLoading(true);
    try {
      const folioGenerado = buildRoleFolio(selectedFolioRole);
      if (!folioGenerado) {
        pushToast('error', 'No se pudo generar un folio válido.');
        return;
      }

      folioUsuarioForm.setValue('folio_matricula', folioGenerado, { shouldDirty: true, shouldValidate: true });
      pushToast('ok', `Folio sugerido generado: ${folioGenerado}`);
    } catch (requestError) {
      pushToast('error', requestError?.response?.data?.message || 'No se pudo generar el folio aleatorio.');
    } finally {
      setFolioAutoLoading(false);
    }
  }

  function generarFolioAleatorioConcepto() {
    const folioGenerado = buildConceptoFolio({
      nombre: folioPagoValues.nombre,
      clasificacion: folioPagoValues.clasificacion,
      naturalezaAjuste: folioPagoValues.naturaleza_ajuste,
    });

    if (!folioGenerado || folioGenerado.length < 10) {
      pushToast('error', 'No se pudo generar un folio interno válido para este concepto.');
      return;
    }

    folioPagoForm.setValue('folio_interno', folioGenerado, { shouldDirty: true, shouldValidate: true });
    pushToast('ok', `Folio interno generado: ${folioGenerado}`);
  }

  function iniciarEdicionConcepto(concepto) {
    setEditingConceptoId(concepto.id_concepto_pago);
    folioPagoForm.reset({
      clasificacion: concepto.clasificacion || 'base',
      nombre: concepto.nombre || '',
      precio_base_inicial: concepto.precio_base_inicial ?? '',
      id_concepto_padre: concepto.id_concepto_padre ? String(concepto.id_concepto_padre) : '',
      naturaleza_ajuste: concepto.naturaleza_ajuste || 'descuento',
      modo_aplicacion: concepto.modo_aplicacion || 'monto_fijo',
      valor_ajuste: concepto.valor_ajuste ?? '',
      folio_interno: concepto.folio_interno || '',
    });
  }

  function cancelarEdicionConcepto() {
    setEditingConceptoId(null);
    folioPagoForm.reset(folioPagoDefaults);
  }

  async function eliminarConceptoCatalogo(concepto) {
    await ejecutar(
      () => api.delete(`/admin/director/conceptos-pago/${concepto.id_concepto_pago}`),
      'Concepto eliminado del catálogo.',
      () => {
        if (editingConceptoId === concepto.id_concepto_pago) {
          cancelarEdicionConcepto();
        }
      },
    );
  }

  const conceptosBaseActivos = useMemo(
    () => conceptosPagoCatalogo.filter((item) => item.clasificacion === 'base'),
    [conceptosPagoCatalogo],
  );

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
          <h3>Gestión de folios por tipos de usuario</h3>
          <p>Registra folios preasignados por tipo de usuario y consulta su estado de registro.</p>
          <form className="form-grid" onSubmit={folioUsuarioForm.handleSubmit((values) => ejecutar(() => api.post('/admin/folios/preasignacion', {
            nombre_destinatario: values.nombre_destinatario,
            rol: values.rol,
            folio: values.folio_matricula || undefined,
          }), 'Folio preasignado registrado.', () => {
            folioUsuarioForm.reset(folioUsuarioDefaults);
            setLastSyncAt(new Date().toISOString());
          }))}>
            <input id="director-folio-nombre-destinatario" placeholder="Nombre del destinatario" {...folioUsuarioForm.register('nombre_destinatario')} />
            {folioUsuarioForm.formState.errors.nombre_destinatario ? <small className="director-field-error">{folioUsuarioForm.formState.errors.nombre_destinatario.message}</small> : null}
            <select id="director-folio-rol" {...folioUsuarioForm.register('rol')}>
              <option value="">Rol asignado</option>
              {FOLIO_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {folioUsuarioForm.formState.errors.rol ? <small className="director-field-error">Selecciona el rol asignado.</small> : null}
            <div className="director-folio-input-row">
              <input id="director-folio-usuario" placeholder="Folio nuevo (opcional)" {...folioUsuarioForm.register('folio_matricula')} />
              <button className="btn-secondary" type="button" onClick={generarFolioAleatorioUsuario} disabled={folioAutoLoading || actionLoading || !selectedFolioRole}>
                {folioAutoLoading ? 'Generando...' : '⚡ Generar Aleatorio'}
              </button>
            </div>
            <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Guardando...' : 'Guardar folio'}</button>
          </form>
          <div className="director-folio-table-wrap dark-table">
            <h4>Tabla de folios (solo vista)</h4>
            <p className="director-folio-table-caption">Clasificada por rol y ordenada por fecha de creación.</p>
            <div className="director-folio-filter-row">
              <select value={folioRoleFilter} onChange={(event) => setFolioRoleFilter(event.target.value)}>
                <option value="">Todos los roles</option>
                {FOLIO_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <input
                value={folioNameFilter}
                onChange={(event) => setFolioNameFilter(event.target.value)}
                placeholder="Buscar por nombre"
              />
            </div>
            {folioRowsLoading ? <p className="director-audit-empty">Cargando folios...</p> : null}
            {!folioRowsLoading && folioRows.length === 0 ? <p className="director-audit-empty">No hay folios registrados.</p> : null}
            {!folioRowsLoading && folioRows.length > 0 ? (
              <div className="director-folio-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Rol</th>
                      <th>Folio</th>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Estado</th>
                      <th>Creado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {folioRows.map((row) => (
                      <tr key={`${row.id_folio_preasignado}-${row.folio_matricula}`}>
                        <td><span className="director-folio-role-chip">{roleLabel(row.rol)}</span></td>
                        <td>{row.folio_matricula || 'N/A'}</td>
                        <td>{row.nombre_destinatario || 'N/A'}</td>
                        <td>{row.correo || 'Pendiente de registro'}</td>
                        <td>{row.correo ? 'Registrado' : 'Pendiente de registro'}</td>
                        <td>{row.fecha_creacion ? new Date(row.fecha_creacion).toLocaleString('es-MX') : 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>

        <section className="director-section director-action-card">
          <h3>Catálogo jerárquico de folios de pago</h3>
          <p>Administra conceptos base y subramas con reglas de descuento/penalización y trazabilidad de folio inmutable.</p>
          <div className="director-conceptos-layout">
            <form className="form-grid" onSubmit={folioPagoForm.handleSubmit((values) => ejecutar(
              () => (editingConceptoId
                ? api.put(`/admin/director/conceptos-pago/${editingConceptoId}`, {
                  ...values,
                  id_concepto_padre: values.id_concepto_padre ? Number(values.id_concepto_padre) : null,
                })
                : api.post('/admin/director/conceptos-pago', {
                  ...values,
                  id_concepto_padre: values.id_concepto_padre ? Number(values.id_concepto_padre) : null,
                })),
              editingConceptoId ? 'Concepto actualizado.' : 'Concepto creado en catálogo.',
              () => {
                cancelarEdicionConcepto();
                setLastSyncAt(new Date().toISOString());
              },
            ))}>
              <div className="director-segmented">
                <button
                  type="button"
                  className={folioPagoValues.clasificacion === 'base' ? 'is-active' : ''}
                  onClick={() => folioPagoForm.setValue('clasificacion', 'base', { shouldDirty: true, shouldValidate: true })}
                >Concepto Base</button>
                <button
                  type="button"
                  className={folioPagoValues.clasificacion === 'subrama' ? 'is-active' : ''}
                  onClick={() => folioPagoForm.setValue('clasificacion', 'subrama', { shouldDirty: true, shouldValidate: true })}
                >Subrama (Ajuste)</button>
              </div>

              <label htmlFor="director-concepto-nombre">Nombre del concepto</label>
              <input id="director-concepto-nombre" placeholder="Nombre del concepto" {...folioPagoForm.register('nombre')} />
              {folioPagoForm.formState.errors.nombre ? <small className="director-field-error">{folioPagoForm.formState.errors.nombre.message}</small> : null}

              {folioPagoValues.clasificacion === 'base' ? (
                <>
                  <label htmlFor="director-concepto-precio-base">Precio Base ($ MXN)</label>
                  <input id="director-concepto-precio-base" type="number" min="0" step="0.01" placeholder="Precio base inicial" {...folioPagoForm.register('precio_base_inicial')} />
                  {folioPagoForm.formState.errors.precio_base_inicial ? <small className="director-field-error">{folioPagoForm.formState.errors.precio_base_inicial.message}</small> : null}
                </>
              ) : (
                <>
                  <label htmlFor="director-concepto-padre">Concepto origen (base)</label>
                  <select id="director-concepto-padre" {...folioPagoForm.register('id_concepto_padre')}>
                    <option value="">Concepto padre (base)</option>
                    {conceptosBaseActivos.map((base) => (
                      <option key={base.id_concepto_pago} value={String(base.id_concepto_pago)}>{base.nombre}</option>
                    ))}
                  </select>
                  {folioPagoForm.formState.errors.id_concepto_padre ? <small className="director-field-error">{folioPagoForm.formState.errors.id_concepto_padre.message}</small> : null}

                  <label htmlFor="director-concepto-naturaleza">Naturaleza del ajuste</label>
                  <select id="director-concepto-naturaleza" {...folioPagoForm.register('naturaleza_ajuste')}>
                    <option value="descuento">Descuento</option>
                    <option value="penalizacion">Penalización / Recargo</option>
                  </select>
                  {folioPagoForm.formState.errors.naturaleza_ajuste ? <small className="director-field-error">{folioPagoForm.formState.errors.naturaleza_ajuste.message}</small> : null}

                  <label htmlFor="director-concepto-modo">Modo de aplicación</label>
                  <select id="director-concepto-modo" {...folioPagoForm.register('modo_aplicacion')}>
                    <option value="monto_fijo">Monto fijo</option>
                    <option value="porcentaje">Porcentaje</option>
                  </select>
                  {folioPagoForm.formState.errors.modo_aplicacion ? <small className="director-field-error">{folioPagoForm.formState.errors.modo_aplicacion.message}</small> : null}

                  <label htmlFor="director-concepto-valor-ajuste">{folioPagoValues.modo_aplicacion === 'porcentaje' ? 'Porcentaje de Ajuste (%)' : 'Monto de Ajuste ($ MXN)'}</label>
                  <input id="director-concepto-valor-ajuste" type="number" min="0.01" step="0.01" placeholder={folioPagoValues.modo_aplicacion === 'porcentaje' ? '15' : '250.00'} {...folioPagoForm.register('valor_ajuste')} />
                  {folioPagoForm.formState.errors.valor_ajuste ? <small className="director-field-error">{folioPagoForm.formState.errors.valor_ajuste.message}</small> : null}
                </>
              )}

              <label htmlFor="director-concepto-year-prefix">Año / Prefijo</label>
              <input id="director-concepto-year-prefix" value={conceptYearPrefix} readOnly />

              <div className="director-folio-input-row">
                <input id="director-folio-interno-concepto" placeholder="Folio interno (único e inmutable)" {...folioPagoForm.register('folio_interno')} disabled={Boolean(editingConceptoId)} />
                {!editingConceptoId ? (
                  <button className="btn-secondary" type="button" onClick={generarFolioAleatorioConcepto}>⚡ Generar Aleatorio</button>
                ) : null}
              </div>
              {folioPagoForm.formState.errors.folio_interno ? <small className="director-field-error">{folioPagoForm.formState.errors.folio_interno.message}</small> : null}

              <div className="director-conceptos-actions">
                <button className="btn-primary" type="submit" disabled={actionLoading}>{actionLoading ? 'Guardando...' : editingConceptoId ? 'Guardar cambios' : 'Crear concepto'}</button>
                {editingConceptoId ? (
                  <button className="btn-secondary" type="button" onClick={cancelarEdicionConcepto}>Cancelar edición</button>
                ) : null}
              </div>
            </form>

            <div className="director-folio-table-wrap dark-table">
              <h4>Catálogo de conceptos</h4>
              <div className="director-folio-filter-row">
                <input value={conceptoSearch} onChange={(event) => setConceptoSearch(event.target.value)} placeholder="Buscar por nombre" />
                <select value={conceptoSort} onChange={(event) => setConceptoSort(event.target.value)}>
                  <option value="az">Orden A-Z</option>
                  <option value="za">Orden Z-A</option>
                </select>
              </div>
              {conceptosPagoLoading ? <p className="director-audit-empty">Cargando conceptos...</p> : null}
              {!conceptosPagoLoading && conceptosPagoHierarchy.length === 0 ? <p className="director-audit-empty">Sin conceptos registrados.</p> : null}
              {!conceptosPagoLoading && conceptosPagoHierarchy.length > 0 ? (
                <div className="director-folio-table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Folio</th>
                        <th>Impacto</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conceptosPagoHierarchy.flatMap((base) => {
                        const baseRow = (
                          <tr key={`base-${base.id_concepto_pago}`}>
                            <td>{base.nombre}</td>
                            <td>{base.folio_interno}</td>
                            <td>{formatMoney(base.precio_base_inicial || 0)}</td>
                            <td className="director-concepto-actions-cell">
                              <button type="button" className="btn-secondary" onClick={() => iniciarEdicionConcepto(base)}>Editar</button>
                              <button type="button" className="btn-secondary" onClick={() => eliminarConceptoCatalogo(base)}>Eliminar</button>
                            </td>
                          </tr>
                        );

                        const subRows = (base.subramas || []).map((subrama) => (
                          <tr key={`sub-${subrama.id_concepto_pago}`}>
                            <td>
                              <span className="director-subrama-indent">↳ {subrama.nombre}</span>
                            </td>
                            <td>{subrama.folio_interno}</td>
                            <td>
                              <span className={`director-ajuste-chip ${subrama.naturaleza_ajuste === 'descuento' ? 'is-descuento' : 'is-penalizacion'}`}>
                                {subrama.naturaleza_ajuste === 'descuento' ? 'Descuento' : 'Recargo'}
                              </span>{' '}
                              {subrama.modo_aplicacion === 'porcentaje' ? `${Number(subrama.valor_ajuste || 0)}%` : formatMoney(subrama.valor_ajuste || 0)}
                            </td>
                            <td className="director-concepto-actions-cell">
                              <button type="button" className="btn-secondary" onClick={() => iniciarEdicionConcepto(subrama)}>Editar</button>
                              <button type="button" className="btn-secondary" onClick={() => eliminarConceptoCatalogo(subrama)}>Eliminar</button>
                            </td>
                          </tr>
                        ));

                        return [baseRow, ...subRows];
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          </div>
        </section>

          <section id="director-finanzas" className="director-section director-action-card director-critical-card">
          <h3>Override financiero</h3>
            <p>Actualiza estatus de pago por alumno con trazabilidad de auditoría.</p>
            <form className="form-grid" onSubmit={financieroForm.handleSubmit((values) => {
            solicitarConfirmacion({
              title: 'Confirmar override financiero',
                  description: `¿Confirmas cambiar el pago #${values.id_pago || 'N/A'} a ${values.estatus.toUpperCase()} por ${formatMoney(selectedPagoFinanciero?.monto ?? 0)}? Esta acción registrará auditoría.`,
              confirmLabel: 'Confirmar override',
                }, () => ejecutar(() => api.patch(`/admin/pagos/${values.id_pago}/estatus-director`, { estatus: values.estatus, motivo: values.motivo || undefined }), 'Cambio financiero autorizado y auditado.', () => financieroForm.reset(financieroDefaults)));
            })}>
                <SearchableSelect id="director-financial-alumno" label="Nombre completo del alumno" placeholder="Escribe nombre completo del alumno" value={financieroValues.id_alumno} onChange={(id_alumno) => {
                  const alumnoSeleccionado = alumnosOverride.find((item) => String(item.id_usuario) === String(id_alumno));
                  financieroForm.setValue('id_alumno', id_alumno, { shouldDirty: true, shouldValidate: true });
                  financieroForm.setValue('id_pago', '', { shouldDirty: true, shouldValidate: true });
                  setSelectedAlumnoOverrideName(alumnoSeleccionado?.nombre_completo || '');
                }} onSearch={setAlumnoOverrideSearch} loading={alumnosOverrideLoading} items={alumnosOverride.map((item) => ({ ...item, id: item.id_usuario }))} renderValue={(item) => `${item.nombre_completo} (ID: ${item.id_usuario})`} renderItem={(item) => <><strong>{item.nombre_completo}</strong><small>ID: {item.id_usuario} / {item.folio_matricula || 'Sin matrícula'}</small></>} />
                {financieroForm.formState.errors.id_alumno ? <small className="director-field-error">{financieroForm.formState.errors.id_alumno.message}</small> : null}
                <label htmlFor="director-financial-id">Folio de pago</label>
                <select id="director-financial-id" value={financieroValues.id_pago} disabled={folioSelectorDisabled} onChange={(event) => financieroForm.setValue('id_pago', event.target.value, { shouldDirty: true, shouldValidate: true })}>
                  <option value="">{folioPlaceholder}</option>
                  {pagosAlumnoOverride.map((item) => (
                    <option key={item.id_pago} value={String(item.id_pago)}>{`${item.concepto} - ${item.folio_interno || `PAGO-${item.id_pago}`}`}</option>
                  ))}
                </select>
              {financieroForm.formState.errors.id_pago ? <small className="director-field-error">{financieroForm.formState.errors.id_pago.message}</small> : null}
                <label htmlFor="director-financial-status">Estado de pago</label>
                <select id="director-financial-status" {...financieroForm.register('estatus')}><option value="pagado">Pagado</option><option value="pendiente">Pendiente</option><option value="condonado">Condonado / Becado</option><option value="cancelado">Cancelado</option></select>
                <label htmlFor="director-financial-reason">Motivo (Opcional)</label>
                <textarea id="director-financial-reason" placeholder="Justificación administrativa opcional" {...financieroForm.register('motivo')} />
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
                      className="director-time-input ui-time-input"
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
                    <small className="director-time-hint ui-hint">Pulsa el icono del reloj para abrir el selector de hora.</small>
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
