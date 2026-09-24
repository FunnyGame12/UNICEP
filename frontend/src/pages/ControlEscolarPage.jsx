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
  comentarios: z.string().optional(),
  enlace_classroom: z.string().optional(),
  materia_id: z.string().optional(),
  docente_id: z.string().optional(),
}).superRefine((data, ctx) => {
  const enlace = data.enlace_classroom?.trim();
  if (!enlace) return;
  try {
    // eslint-disable-next-line no-new
    new URL(enlace);
  } catch (_error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['enlace_classroom'],
      message: 'Ingresa una URL valida.',
    });
  }
});

const driveFolderSchema = z.object({
  drive_folder_url: z.string().trim().url('Ingresa una URL valida.').or(z.literal('')),
});

const rechazoComprobanteSchema = z.object({
  motivo: z.string().trim().min(8, 'La justificación debe tener al menos 8 caracteres.'),
});

const actualizarTramiteSchema = z.object({
  estatus: z.enum(['en_proceso', 'listo_para_entrega', 'entregado', 'rechazado', 'cancelado']),
  notas_entrega: z.string().optional(),
});

const tabs = [
  { id: 'tesoreria', label: 'Tesorería y Comprobantes' },
  { id: 'accesos', label: 'Control de Accesos Financieros' },
  { id: 'tramites', label: 'Trámites Institucionales' },
  { id: 'portafolio', label: 'Portafolio de Alumnos' },
  { id: 'institucional', label: 'Recursos Institucionales' },
];

const DASHBOARD_LABEL_CLASS = 'block text-sm font-medium text-gray-400 mb-2';
const DASHBOARD_FIELD_CLASS = 'w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors';

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
  const [materiasCatalogo, setMateriasCatalogo] = useState([]);
  const [docentesCatalogo, setDocentesCatalogo] = useState([]);
  const [comprobantes, setComprobantes] = useState([]);
  const [tramites, setTramites] = useState([]);

  const [selectedComprobante, setSelectedComprobante] = useState(null);
  const [selectedTramite, setSelectedTramite] = useState(null);

  const [searchAlumno, setSearchAlumno] = useState('');
  const [filterEstatus, setFilterEstatus] = useState('');
  const [draftAccesos, setDraftAccesos] = useState({});
  const [descargandoBoletaId, setDescargandoBoletaId] = useState(null);

  const [portafolioSearch, setPortafolioSearch] = useState('');
  const [selectedPortafolioAlumnoId, setSelectedPortafolioAlumnoId] = useState(null);
  const [portafolioData, setPortafolioData] = useState(null);
  const [portafolioLoading, setPortafolioLoading] = useState(false);
  const [portafolioArchivo, setPortafolioArchivo] = useState(null);
  const [documentoRespuestaTramite, setDocumentoRespuestaTramite] = useState(null);

  const [tipoAsignacion, setTipoAsignacion] = useState('masivo');
  const [recursoTitulo, setRecursoTitulo] = useState('');
  const [recursoArchivo, setRecursoArchivo] = useState(null);
  const [recursoUrl, setRecursoUrl] = useState('');
  const [busquedaAlumno, setBusquedaAlumno] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const [mostrarResultadosBusqueda, setMostrarResultadosBusqueda] = useState(false);
  const [busquedaAlumnoLoading, setBusquedaAlumnoLoading] = useState(false);
  const [carreraId, setCarreraId] = useState('');
  const [semestreId, setSemestreId] = useState('');
  const [grupoId, setGrupoId] = useState('');
  const [listaCarreras, setListaCarreras] = useState([]);
  const [listaSemestres, setListaSemestres] = useState([]);
  const [listaGrupos, setListaGrupos] = useState([]);
  const [urlBiblioteca, setUrlBiblioteca] = useState('');

  const cobroForm = useForm({
    resolver: zodResolver(cobroCajaSchema),
    defaultValues: {
      alumno_id: '',
      concepto_folio_id: '',
      referencia_caja: buildCajaReference(),
      monto_recibido: '',
      metodo_pago: 'efectivo',
      comentarios: '',
      enlace_classroom: '',
      materia_id: '',
      docente_id: '',
    },
  });

  const driveFolderForm = useForm({
    resolver: zodResolver(driveFolderSchema),
    defaultValues: { drive_folder_url: '' },
  });

  const alumnoActualWatch = cobroForm.watch('alumno_id');
  const conceptoActualWatch = cobroForm.watch('concepto_folio_id');

  const alumnoSeleccionadoCobro = useMemo(
    () => alumnos.find((item) => String(item.id_alumno) === String(alumnoActualWatch)) || null,
    [alumnos, alumnoActualWatch],
  );

  const conceptoSeleccionadoCobro = useMemo(
    () => conceptos.find((item) => String(item.id_concepto_pago) === String(conceptoActualWatch)) || null,
    [conceptos, conceptoActualWatch],
  );

  const esExtraordinarioCobro = Boolean(
    conceptoSeleccionadoCobro && /extraordinario/i.test(conceptoSeleccionadoCobro.nombre || ''),
  );

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
      const [alumnosResp, conceptosResp, catalogosExtraResp, comprobantesResp, tramitesResp] = await Promise.all([
        api.get('/control-escolar/alumnos-estatus'),
        api.get('/control-escolar/conceptos-activos'),
        api.get('/control-escolar/catalogos-extraordinario'),
        api.get('/control-escolar/comprobantes-pendientes'),
        api.get('/control-escolar/tramites'),
      ]);

      const alumnosItems = alumnosResp?.data?.items || [];
      setAlumnos(alumnosItems);
      setConceptos(conceptosResp?.data?.items || []);
      setMateriasCatalogo(catalogosExtraResp?.data?.materias || []);
      setDocentesCatalogo(catalogosExtraResp?.data?.docentes || []);
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

  useEffect(() => {
    driveFolderForm.reset({ drive_folder_url: portafolioData?.alumno?.drive_folder_url || '' });
  }, [portafolioData, driveFolderForm]);

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

  const alumnosPortafolioFiltered = useMemo(() => {
    const q = portafolioSearch.trim().toLowerCase();
    if (!q) return alumnos;
    return alumnos.filter((item) => String(item.nombre_completo || '').toLowerCase().includes(q)
      || String(item.folio_matricula || '').toLowerCase().includes(q)
      || String(item.correo || '').toLowerCase().includes(q));
  }, [alumnos, portafolioSearch]);

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
        ...(esExtraordinarioCobro ? {
          materia_id: values.materia_id ? Number(values.materia_id) : undefined,
          docente_id: values.docente_id ? Number(values.docente_id) : undefined,
          comentarios: values.comentarios?.trim() || undefined,
          enlace_classroom: values.enlace_classroom?.trim() || undefined,
        } : {}),
      });

      setMessage('Cobro de caja registrado correctamente.');
      const siguienteFolio = regenerateCajaReference();
      cobroForm.reset({
        alumno_id: '',
        concepto_folio_id: '',
        referencia_caja: siguienteFolio,
        monto_recibido: '',
        metodo_pago: 'efectivo',
        comentarios: '',
        enlace_classroom: '',
        materia_id: '',
        docente_id: '',
      });
      await loadAll();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar el cobro de caja.');
    } finally {
      setSending(false);
    }
  }

  async function abrirPortafolioAlumno(idAlumno) {
    setSelectedPortafolioAlumnoId(idAlumno);
    setPortafolioLoading(true);
    setError('');

    try {
      const response = await api.get(`/control-escolar/alumnos/${idAlumno}/portafolio`);
      setPortafolioData(response?.data || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el portafolio del alumno.');
    } finally {
      setPortafolioLoading(false);
    }
  }

  async function guardarDriveFolder(values) {
    if (!selectedPortafolioAlumnoId) return;

    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.put(`/control-escolar/alumnos/${selectedPortafolioAlumnoId}/drive-folder`, {
        drive_folder_url: values.drive_folder_url.trim(),
      });
      setMessage('Carpeta de Google Drive actualizada correctamente.');
      await abrirPortafolioAlumno(selectedPortafolioAlumnoId);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo actualizar la carpeta de Drive.');
    } finally {
      setSending(false);
    }
  }

  async function subirArchivoPortafolio() {
    if (!selectedPortafolioAlumnoId) return;
    if (!portafolioArchivo) {
      setError('Selecciona un archivo para subir al portafolio.');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('archivo', portafolioArchivo);
      await api.post(`/control-escolar/alumnos/${selectedPortafolioAlumnoId}/portafolio`, formData);
      setMessage('Archivo agregado al portafolio del alumno.');
      setPortafolioArchivo(null);
      await abrirPortafolioAlumno(selectedPortafolioAlumnoId);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo subir el archivo.');
    } finally {
      setSending(false);
    }
  }

  async function cargarCatalogosRecursos({ carreraParam = '', semestreParam = '' } = {}) {
    try {
      const params = new URLSearchParams();
      if (carreraParam) params.append('carrera_id', carreraParam);
      if (semestreParam) params.append('semestre', semestreParam);
      const suffix = params.toString();
      const response = await api.get(`/control-escolar/recursos/catalogos${suffix ? `?${suffix}` : ''}`);
      return {
        carreras: response?.data?.carreras || [],
        semestres: response?.data?.semestres || [],
        grupos: response?.data?.grupos || [],
      };
    } catch (_error) {
      return { carreras: [], semestres: [], grupos: [] };
    }
  }

  async function cargarConfiguracionBiblioteca() {
    try {
      const response = await api.get('/control-escolar/configuracion/biblioteca');
      setUrlBiblioteca(response?.data?.valor || '');
    } catch (_error) {
      setUrlBiblioteca('');
    }
  }

  function limpiarFormularioRecursos() {
    setRecursoTitulo('');
    setRecursoArchivo(null);
    setRecursoUrl('');
    setBusquedaAlumno('');
    setResultadosBusqueda([]);
    setMostrarResultadosBusqueda(false);
    setAlumnoSeleccionado(null);
    setCarreraId('');
    setSemestreId('');
    setGrupoId('');
    setListaSemestres([]);
    setListaGrupos([]);
  }

  async function cargarAlumnosInscritosRecientes() {
    setBusquedaAlumnoLoading(true);
    try {
      const response = await api.get('/control-escolar/alumnos/buscar');
      const items = Array.isArray(response?.data) ? response.data : (response?.data?.items || []);
      setResultadosBusqueda(items);
      setMostrarResultadosBusqueda(true);
    } catch (_error) {
      setResultadosBusqueda([]);
      setMostrarResultadosBusqueda(false);
    } finally {
      setBusquedaAlumnoLoading(false);
    }
  }

  async function handleChangeCarrera(id) {
    setCarreraId(id);
    setSemestreId('');
    setGrupoId('');
    setListaGrupos([]);

    if (!id) {
      setListaSemestres([]);
      return;
    }

    const data = await cargarCatalogosRecursos({ carreraParam: id });
    setListaSemestres(data.semestres || []);
  }

  async function handleChangeSemestre(id) {
    setSemestreId(id);
    setGrupoId('');

    if (!id || !carreraId) {
      setListaGrupos([]);
      return;
    }

    const data = await cargarCatalogosRecursos({ carreraParam: carreraId, semestreParam: id });
    setListaGrupos(data.grupos || []);
  }

  async function enviarRecursoInstitucional() {
    setSending(true);
    setError('');
    setMessage('');

    try {
      const titulo = recursoTitulo.trim();
      const url = recursoUrl.trim();

      if (!titulo) {
        setError('El titulo del recurso es obligatorio.');
        return;
      }

      if (!recursoArchivo && !url) {
        setError('Debes seleccionar un archivo o capturar una URL.');
        return;
      }

      if (tipoAsignacion === 'individual' && !alumnoSeleccionado?.id) {
        setError('Selecciona un alumno para la asignacion individual.');
        return;
      }

      if (tipoAsignacion === 'masivo') {
        if (!carreraId || !semestreId || !grupoId) {
          setError('Para asignacion masiva debes seleccionar carrera, semestre y grupo.');
          return;
        }
      }

      const formData = new FormData();
      formData.append('titulo', titulo);
      formData.append('tipo_asignacion', tipoAsignacion);

      if (tipoAsignacion === 'masivo') {
        formData.append('carrera_id', carreraId);
        formData.append('semestre', semestreId);
        formData.append('grupo_id', grupoId);
      } else {
        formData.append('alumno_id', String(alumnoSeleccionado.id));
      }

      if (recursoArchivo) {
        formData.append('archivo', recursoArchivo);
      } else {
        formData.append('archivo_url', url);
      }

      await api.post('/control-escolar/recursos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessage('Recurso institucional enviado correctamente.');
      limpiarFormularioRecursos();
      if (tipoAsignacion === 'masivo') {
        const data = await cargarCatalogosRecursos();
        setListaCarreras(data.carreras || []);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar el recurso institucional.');
    } finally {
      setSending(false);
    }
  }

  async function guardarEnlaceBiblioteca() {
    setSending(true);
    setError('');
    setMessage('');

    try {
      const valor = urlBiblioteca.trim();
      if (!valor) {
        setError('La URL de Biblioteca Virtual es obligatoria.');
        return;
      }

      await api.put('/control-escolar/configuracion/biblioteca', { valor });
      setMessage('Enlace de Biblioteca Virtual guardado correctamente.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar el enlace de Biblioteca Virtual.');
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    cargarConfiguracionBiblioteca();
  }, []);

  useEffect(() => {
    if (activeTab !== 'institucional') return;
    if (tipoAsignacion !== 'masivo') return;

    (async () => {
      const data = await cargarCatalogosRecursos();
      setListaCarreras(data.carreras || []);
    })();
  }, [activeTab, tipoAsignacion]);

  useEffect(() => {
    if (activeTab !== 'institucional') return;
    if (tipoAsignacion !== 'individual') return;

    const term = busquedaAlumno.trim();
    if (term.length < 2) {
      if (!term) {
        setMostrarResultadosBusqueda(false);
      }
      setBusquedaAlumnoLoading(false);
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      setBusquedaAlumnoLoading(true);
      try {
        const response = await api.get(`/control-escolar/alumnos/buscar?q=${encodeURIComponent(term)}`);
        const items = Array.isArray(response?.data) ? response.data : (response?.data?.items || []);
        setResultadosBusqueda(items);
        setMostrarResultadosBusqueda(true);
      } catch (_error) {
        setResultadosBusqueda([]);
        setMostrarResultadosBusqueda(false);
      } finally {
        setBusquedaAlumnoLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [activeTab, tipoAsignacion, busquedaAlumno]);

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

  async function handleDescargarBoleta(alumnoId, matricula) {
    setError('');
    setMessage('');
    setDescargandoBoletaId(alumnoId);

    try {
      const response = await api.get(`/control-escolar/alumnos/${alumnoId}/boleta`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Boleta_${matricula || alumnoId}.xlsx`);

      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessage('Boleta descargada correctamente.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo generar la boleta.');
    } finally {
      setDescargandoBoletaId(null);
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
      if (documentoRespuestaTramite) {
        const formData = new FormData();
        formData.append('estatus', values.estatus);
        if (values.notas_entrega?.trim()) formData.append('notas_entrega', values.notas_entrega.trim());
        formData.append('documento_respuesta', documentoRespuestaTramite);
        await api.put(`/control-escolar/tramites/${selectedTramite.id_tramite}/estatus`, formData);
      } else {
        await api.put(`/control-escolar/tramites/${selectedTramite.id_tramite}/estatus`, {
          estatus: values.estatus,
          notas_entrega: values.notas_entrega?.trim() || undefined,
        });
      }
      setDocumentoRespuestaTramite(null);
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
                <option value="" disabled hidden>Selecciona un alumno</option>
                {alumnos.map((alumno) => (
                  <option key={alumno.id_alumno} value={String(alumno.id_alumno)}>
                    {`${alumno.folio_matricula || 'SIN-FOLIO'} · ${alumno.nombre_completo}`}
                  </option>
                ))}
              </select>
              {cobroForm.formState.errors.alumno_id ? <small>{cobroForm.formState.errors.alumno_id.message}</small> : null}

              {alumnoSeleccionadoCobro?.estatus_financiero === 'deudor' ? (
                <p className="ce-warning-box" role="alert">
                  ⚠️ Atención: El alumno presenta adeudos pendientes.
                </p>
              ) : null}

              <label htmlFor="ce-concepto">Concepto de pago</label>
              <select id="ce-concepto" {...cobroForm.register('concepto_folio_id')}>
                <option value="" disabled hidden>Selecciona un concepto</option>
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

              {esExtraordinarioCobro ? (
                <div className="ce-extra-config">
                  <h4>Configuración de Extraordinario</h4>

                  <div className="ce-extra-grid">
                    <div className="field-group">
                      <label htmlFor="ce-extra-materia">Materia a presentar</label>
                      <select id="ce-extra-materia" {...cobroForm.register('materia_id')}>
                        <option value="" disabled hidden>Selecciona materia...</option>
                        {materiasCatalogo.map((materia) => (
                          <option key={materia.id_materia} value={String(materia.id_materia)}>
                            {materia.nombre_materia}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="field-group">
                      <label htmlFor="ce-extra-docente">Docente asignado</label>
                      <select id="ce-extra-docente" {...cobroForm.register('docente_id')}>
                        <option value="" disabled hidden>Selecciona docente...</option>
                        {docentesCatalogo.map((docente) => (
                          <option key={docente.id_docente} value={String(docente.id_docente)}>
                            {docente.nombre_completo}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <label htmlFor="ce-extra-comentarios">Comentarios/Observaciones</label>
                  <textarea
                    className="ce-textarea"
                    id="ce-extra-comentarios"
                    rows="3"
                    placeholder="Detalles del examen extraordinario."
                    {...cobroForm.register('comentarios')}
                  />

                  <label htmlFor="ce-extra-classroom">Enlace de Google Classroom</label>
                  <input
                    id="ce-extra-classroom"
                    type="url"
                    placeholder="https://classroom.google.com/..."
                    {...cobroForm.register('enlace_classroom')}
                  />
                  {cobroForm.formState.errors.enlace_classroom ? <small>{cobroForm.formState.errors.enlace_classroom.message}</small> : null}
                </div>
              ) : null}

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
                  <th>Boleta</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6">Cargando alumnos...</td>
                  </tr>
                ) : null}
                {!loading && alumnosFiltered.length === 0 ? (
                  <tr>
                    <td colSpan="6">Sin resultados para los filtros seleccionados.</td>
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
                      <td>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleDescargarBoleta(item.id_alumno, item.folio_matricula)}
                          disabled={descargandoBoletaId === item.id_alumno}
                        >
                          {descargandoBoletaId === item.id_alumno ? 'Generando...' : '📄 Descargar Boleta'}
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
                    <option value="rechazado">Rechazado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                  {tramiteForm.formState.errors.estatus ? <small>{tramiteForm.formState.errors.estatus.message}</small> : null}

                  <label htmlFor="ce-tramite-notas">Notas de entrega (opcional)</label>
                  <textarea className="ce-textarea" id="ce-tramite-notas" rows="4" placeholder="Observaciones de ventanilla o entrega física." {...tramiteForm.register('notas_entrega')} />

                  <label htmlFor="ce-tramite-documento">Documento de respuesta (opcional, PDF)</label>
                  <input
                    id="ce-tramite-documento"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(event) => setDocumentoRespuestaTramite(event.target.files?.[0] || null)}
                  />

                  <button type="submit" className="btn-primary" disabled={sending}>Actualizar trámite</button>
                </form>
              </>
            ) : null}
          </article>
        </div>
      ) : null}

      {activeTab === 'portafolio' ? (
        <div className="ce-grid-2">
          <article className="ce-card">
            <h3>Alumnos</h3>
            <div className="ce-filters">
              <input
                value={portafolioSearch}
                onChange={(event) => setPortafolioSearch(event.target.value)}
                placeholder="Buscar por folio, nombre o correo"
              />
            </div>

            <div className="table-wrap ce-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Alumno</th>
                    <th>Folio</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="2">Cargando alumnos...</td></tr>
                  ) : null}
                  {!loading && alumnosPortafolioFiltered.length === 0 ? (
                    <tr><td colSpan="2">Sin resultados.</td></tr>
                  ) : null}
                  {!loading ? alumnosPortafolioFiltered.map((item) => (
                    <tr
                      key={item.id_alumno}
                      className={String(selectedPortafolioAlumnoId) === String(item.id_alumno) ? 'ce-row-selected' : ''}
                      onClick={() => abrirPortafolioAlumno(item.id_alumno)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong>{item.nombre_completo}</strong></td>
                      <td>{item.folio_matricula || 'SIN-FOLIO'}</td>
                    </tr>
                  )) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="ce-card">
            <h3>Expediente digital</h3>
            {!selectedPortafolioAlumnoId ? <p>Selecciona un alumno para ver su portafolio.</p> : null}
            {portafolioLoading ? <p>Cargando portafolio...</p> : null}

            {!portafolioLoading && portafolioData ? (
              <>
                <p><strong>Alumno:</strong> {portafolioData.alumno?.nombre_completo || 'No disponible'}</p>
                <p><strong>Folio:</strong> {portafolioData.alumno?.folio_matricula || 'SIN-FOLIO'}</p>

                <form className="form-grid" onSubmit={driveFolderForm.handleSubmit(guardarDriveFolder)}>
                  <label htmlFor="ce-drive-folder">URL de carpeta de Google Drive</label>
                  <input
                    id="ce-drive-folder"
                    type="url"
                    placeholder="https://drive.google.com/drive/folders/..."
                    {...driveFolderForm.register('drive_folder_url')}
                  />
                  {driveFolderForm.formState.errors.drive_folder_url ? <small>{driveFolderForm.formState.errors.drive_folder_url.message}</small> : null}
                  <button type="submit" className="btn-secondary" disabled={sending}>Guardar carpeta de Drive</button>
                </form>

                <div className="ce-preview">
                  <label htmlFor="ce-portafolio-archivo">Subir archivo al portafolio</label>
                  <input
                    id="ce-portafolio-archivo"
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                    onChange={(event) => setPortafolioArchivo(event.target.files?.[0] || null)}
                  />
                  <button type="button" className="btn-primary" disabled={sending} onClick={subirArchivoPortafolio}>
                    Subir archivo
                  </button>
                </div>

                <h4>Archivos del portafolio</h4>
                {(portafolioData.items || []).length === 0 ? <p>Sin archivos registrados.</p> : null}
                <div className="ce-list">
                  {(portafolioData.items || []).map((item) => (
                    <a
                      key={item.id_evidencia}
                      className="ce-list-item"
                      href={item.archivo_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <strong>{item.nombre_archivo || item.archivo_url}</strong>
                      <span>{item.materia || (item.origen === 'control_escolar' ? 'Control Escolar' : 'Docente')}</span>
                      <span>{formatDate(item.fecha_creacion)}</span>
                    </a>
                  ))}
                </div>
              </>
            ) : null}
          </article>
        </div>
      ) : null}

      {activeTab === 'institucional' ? (
        <div className="ce-recursos-stack">
          <article className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 ce-recursos-panel">
            <h3 className="text-white text-lg font-semibold mb-4">Gestor Documental Institucional</h3>

            <div className="flex gap-6 mb-6 pb-4 border-b border-gray-800" role="radiogroup" aria-label="Tipo de asignación">
              <label className="inline-flex items-center gap-2 text-gray-300 font-medium">
                <input
                  type="radio"
                  name="tipo-asignacion"
                  value="masivo"
                  checked={tipoAsignacion === 'masivo'}
                  onChange={() => {
                    setTipoAsignacion('masivo');
                    setAlumnoSeleccionado(null);
                    setBusquedaAlumno('');
                    setResultadosBusqueda([]);
                    setMostrarResultadosBusqueda(false);
                  }}
                />
                Asignación por Grupo
              </label>
              <label className="inline-flex items-center gap-2 text-gray-300 font-medium">
                <input
                  type="radio"
                  name="tipo-asignacion"
                  value="individual"
                  checked={tipoAsignacion === 'individual'}
                  onChange={() => {
                    setTipoAsignacion('individual');
                    setCarreraId('');
                    setSemestreId('');
                    setGrupoId('');
                    setListaSemestres([]);
                    setListaGrupos([]);
                  }}
                />
                Asignación a Alumno Específico
              </label>
            </div>

            {tipoAsignacion === 'masivo' ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div>
                  <label className={DASHBOARD_LABEL_CLASS} htmlFor="ce-recursos-carrera">Licenciatura / Carrera</label>
                  <select
                    className={`${DASHBOARD_FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                    id="ce-recursos-carrera"
                    value={carreraId}
                    onChange={(event) => handleChangeCarrera(event.target.value)}
                  >
                    <option value="" disabled hidden>Selecciona carrera</option>
                    {listaCarreras.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={DASHBOARD_LABEL_CLASS} htmlFor="ce-recursos-semestre">Semestre / Periodo</label>
                  <select
                    className={`${DASHBOARD_FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                    id="ce-recursos-semestre"
                    value={semestreId}
                    onChange={(event) => handleChangeSemestre(event.target.value)}
                    disabled={!carreraId}
                  >
                    <option value="" disabled hidden>Selecciona semestre</option>
                    {listaSemestres.map((item) => (
                      <option key={String(item.value)} value={String(item.value)}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={DASHBOARD_LABEL_CLASS} htmlFor="ce-recursos-grupo">Grupo</label>
                  <select
                    className={`${DASHBOARD_FIELD_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                    id="ce-recursos-grupo"
                    value={grupoId}
                    onChange={(event) => setGrupoId(event.target.value)}
                    disabled={!semestreId}
                  >
                    <option value="" disabled hidden>Selecciona grupo</option>
                    {listaGrupos.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="mb-6 ce-buscador-wrap">
                <label className={DASHBOARD_LABEL_CLASS} htmlFor="ce-buscar-alumno">Buscar alumno por nombre o matrícula</label>
                <input
                  className={DASHBOARD_FIELD_CLASS}
                  id="ce-buscar-alumno"
                  type="text"
                  placeholder="Ej. Jafet o ALU-26-001"
                  value={busquedaAlumno}
                  onChange={(event) => {
                    setBusquedaAlumno(event.target.value);
                    setAlumnoSeleccionado(null);
                  }}
                  onFocus={() => {
                    if (!busquedaAlumno.trim()) {
                      cargarAlumnosInscritosRecientes();
                    } else {
                      setMostrarResultadosBusqueda(true);
                    }
                  }}
                />
                {busquedaAlumnoLoading ? <small className="text-gray-400">Buscando alumnos...</small> : null}

                {mostrarResultadosBusqueda && resultadosBusqueda.length > 0 ? (
                  <ul className="absolute z-10 w-full bg-gray-800 border border-gray-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {resultadosBusqueda.map((item) => (
                      <li
                        key={item.id}
                        className="hover:bg-blue-600 cursor-pointer p-2 text-sm text-white"
                        onMouseDown={() => {
                          setAlumnoSeleccionado(item);
                          setBusquedaAlumno('');
                          setResultadosBusqueda([]);
                          setMostrarResultadosBusqueda(false);
                        }}
                      >
                        {`${item.nombre || 'Alumno sin nombre'} (${item.matricula || 'SIN-MATRICULA'})`}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {alumnoSeleccionado ? (
                  <div className="ce-selected-badge-row">
                    <p className="ce-selected-badge">
                      Seleccionado: {alumnoSeleccionado.nombre} - {alumnoSeleccionado.matricula || 'SIN-MATRICULA'}
                    </p>
                    <button
                      type="button"
                      className="ce-selected-badge-remove"
                      onClick={() => setAlumnoSeleccionado(null)}
                      aria-label="Quitar alumno seleccionado"
                    >
                      X
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={DASHBOARD_LABEL_CLASS} htmlFor="ce-recurso-titulo">Título del recurso</label>
                <input
                  className={DASHBOARD_FIELD_CLASS}
                  id="ce-recurso-titulo"
                  type="text"
                  placeholder="Manual de reglamento, formato de trámite, etc."
                  value={recursoTitulo}
                  onChange={(event) => setRecursoTitulo(event.target.value)}
                />
              </div>

              <div>
                <label className={DASHBOARD_LABEL_CLASS} htmlFor="ce-recurso-archivo">Archivo</label>
                <input
                  className={DASHBOARD_FIELD_CLASS}
                  id="ce-recurso-archivo"
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => setRecursoArchivo(event.target.files?.[0] || null)}
                />
              </div>

              <div>
                <label className={DASHBOARD_LABEL_CLASS} htmlFor="ce-recurso-url">O URL de Drive</label>
                <input
                  className={DASHBOARD_FIELD_CLASS}
                  id="ce-recurso-url"
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={recursoUrl}
                  onChange={(event) => setRecursoUrl(event.target.value)}
                />
              </div>
            </div>

            <div className="ce-actions-row mt-6">
              <button type="button" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 transition-colors" disabled={sending} onClick={enviarRecursoInstitucional}>
                {sending ? 'Enviando...' : 'Guardar / Enviar Recurso'}
              </button>
            </div>
          </article>

          <article className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="text-white text-lg font-semibold mb-2">📚 Enlace de Biblioteca Virtual</h3>
            <p className="text-sm text-gray-400 mb-4">Este enlace será visible para todos los alumnos en su panel institucional.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="md:col-span-2">
                <label className={DASHBOARD_LABEL_CLASS} htmlFor="ce-url-biblioteca">URL de Biblioteca Virtual</label>
                <input
                  className={DASHBOARD_FIELD_CLASS}
                  id="ce-url-biblioteca"
                  type="url"
                  placeholder="https://www.unicepmerida.com/biblioteca-virtual"
                  value={urlBiblioteca}
                  onChange={(event) => setUrlBiblioteca(event.target.value)}
                />
              </div>
              <div>
                <button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-2 transition-colors"
                  disabled={sending}
                  onClick={guardarEnlaceBiblioteca}
                >
                  Guardar Enlace
                </button>
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
