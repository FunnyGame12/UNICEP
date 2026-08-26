import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
import './CoordinacionAcademicaPage.css';

const tabs = [
  { id: 'carga', label: 'Carga Horaria y Grupos' },
  { id: 'calificaciones', label: 'Calificaciones y Extraordinarios' },
  { id: 'oferta', label: 'Planes de Estudio y Materias' },
  { id: 'servicio', label: 'Servicio Social y Practicas' },
  { id: 'progreso', label: 'Progreso y Reconocimientos' },
];

const programaStatusOptions = [
  { value: 'en_revision', label: 'En revision' },
  { value: 'horas_cubiertas', label: 'Horas cubiertas' },
  { value: 'liberado', label: 'Liberado' },
  { value: 'rechazado', label: 'Rechazado' },
];

function toUiProgramaStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'registrado' || raw === 'en_proceso') return 'en_revision';
  if (raw === 'validado') return 'horas_cubiertas';
  if (raw === 'liberado') return 'liberado';
  if (raw === 'rechazado') return 'rechazado';
  return 'en_revision';
}

const asignacionSchema = z.object({
  docente_id: z.string().min(1, 'Selecciona un docente.'),
  materia_id: z.string().min(1, 'Selecciona una materia.'),
  grupo_id: z.string().min(1, 'Selecciona un grupo.'),
  horas_semanales: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? NaN : Number(value)),
    z.number().positive('Las horas semanales deben ser mayores a 0.'),
  ),
});

const horarioSchema = z.object({
  grupo_id: z.string().min(1, 'Selecciona un grupo.'),
  materia_id: z.string().min(1, 'Selecciona una materia.'),
  docente_id: z.string().min(1, 'Selecciona un docente.'),
  aula: z.string().trim().min(1, 'Selecciona o captura un aula.'),
  dias_semana: z.array(z.string()).min(1, 'Selecciona al menos un dia.'),
  hora_inicio: z.string().min(1, 'Ingresa hora de inicio.'),
  hora_fin: z.string().min(1, 'Ingresa hora de fin.'),
  modalidad: z.string().min(1),
  periodo: z.string().min(1),
  turno: z.string().min(1),
});

const extraordinarioSchema = z.object({
  alumno_id: z.string().min(1, 'Selecciona un alumno.'),
  materia_id: z.string().min(1, 'Selecciona una materia.'),
  docente_sinodal_id: z.string().min(1, 'Selecciona un docente sinodal.'),
  fecha_examen: z.string().min(1, 'Selecciona fecha de examen.'),
  costo_folio_ref: z.string().trim().min(1, 'Ingresa la referencia de costo/folio.'),
}).superRefine((data, ctx) => {
  const date = new Date(data.fecha_examen);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (Number.isNaN(date.getTime()) || date <= now) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['fecha_examen'],
      message: 'La fecha del extraordinario debe ser posterior a hoy.',
    });
  }
});

const programaSchema = z.object({
  expediente_id: z.string().min(1, 'Selecciona un expediente.'),
  tipo_programa: z.enum(['servicio_social', 'practicas_profesionales']),
  estatus: z.enum(['en_revision', 'horas_cubiertas', 'liberado', 'rechazado']),
  oficio_liberacion: z.string().optional(),
  horas_concluidas: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? NaN : Number(value)),
    z.number().nonnegative('Las horas no pueden ser negativas.'),
  ),
  observaciones: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.estatus !== 'liberado') return;

  const minimo = data.tipo_programa === 'servicio_social' ? 480 : 1;
  if (!data.oficio_liberacion || data.oficio_liberacion.trim().length < 4) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['oficio_liberacion'],
      message: 'El numero de oficio/documento es obligatorio para liberar.',
    });
  }

  if (!Number.isFinite(data.horas_concluidas) || data.horas_concluidas < minimo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['horas_concluidas'],
      message: `Horas insuficientes para liberar. Minimo requerido: ${minimo}.`,
    });
  }
});

const meritoSchema = z.object({
  alumno_id: z.string().min(1, 'Selecciona un alumno.'),
  tipo_merito: z.enum(['mencion_honorifica', 'insignia', 'cuadro_honor']),
  nombre: z.string().trim().min(3, 'Describe el merito.'),
  archivo_url: z.string().trim().optional(),
});

const alumnoGrupoSchema = z.object({
  id_alumno: z.string().min(1, 'Selecciona un alumno.'),
  id_materia: z.string().min(1, 'Selecciona una materia.'),
  grupo: z.string().trim().min(1, 'Selecciona un grupo.'),
});

const programaAcademicoSchema = z.object({
  tipo_nivel: z.enum(['preparatoria', 'licenciatura', 'ingenieria', 'maestria']),
  nombre: z.string().trim().min(3, 'Ingresa el nombre del programa.'),
  modalidad_periodo: z.enum(['semestral', 'cuatrimestral']),
  total_periodos: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? NaN : Number(value)),
    z.number().int().min(1, 'Minimo 1 periodo.').max(20, 'Maximo 20 periodos.'),
  ),
});

const materiaPlanSchema = z.object({
  programa_academico_id: z.string().min(1, 'Selecciona un programa academico.'),
  periodo_numero: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? NaN : Number(value)),
    z.number().int().min(1, 'Selecciona un periodo valido.'),
  ),
  codigo_materia: z.string().trim().min(2, 'Ingresa el codigo de la materia.'),
  nombre_materia: z.string().trim().min(3, 'Ingresa el nombre de la materia.'),
  creditos: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().min(0, 'No puede ser negativo.').optional(),
  ),
  horas_semanales: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().min(0, 'No puede ser negativo.').optional(),
  ),
});

export default function CoordinacionAcademicaPage() {
  const [activeTab, setActiveTab] = useState('carga');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [docentes, setDocentes] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [aulas, setAulas] = useState([]);
  const [actas, setActas] = useState([]);
  const [programas, setProgramas] = useState([]);
  const [programasAcademicos, setProgramasAcademicos] = useState([]);
  const [programaCurricular, setProgramaCurricular] = useState(null);
  const [programaPeriodos, setProgramaPeriodos] = useState([]);
  const [editingProgramaAcademicoId, setEditingProgramaAcademicoId] = useState(null);
  const [editingMateriaPlanId, setEditingMateriaPlanId] = useState(null);
  const [selectedProgramaOfertaId, setSelectedProgramaOfertaId] = useState('');
  const [selectedProgramaCargaId, setSelectedProgramaCargaId] = useState('');
  const [selectedPeriodoCarga, setSelectedPeriodoCarga] = useState('');
  const [selectedProgramaCalifId, setSelectedProgramaCalifId] = useState('');
  const [selectedPeriodoCalif, setSelectedPeriodoCalif] = useState('');
  const [alumnosProgreso, setAlumnosProgreso] = useState([]);
  const [meritosRecientes, setMeritosRecientes] = useState([]);
  const [selectedPrograma, setSelectedPrograma] = useState(null);

  const [alumnoGrupoItems, setAlumnoGrupoItems] = useState([]);
  const [alumnoGrupoSearch, setAlumnoGrupoSearch] = useState('');
  const [alumnoGrupoTableLoading, setAlumnoGrupoTableLoading] = useState(false);
  const [alumnoGrupoCatalogLoading, setAlumnoGrupoCatalogLoading] = useState(false);
  const [alumnoGrupoSearchLoading, setAlumnoGrupoSearchLoading] = useState(false);
  const [alumnoGrupoSending, setAlumnoGrupoSending] = useState(false);
  const [alumnoGrupoAlumnoQuery, setAlumnoGrupoAlumnoQuery] = useState('');
  const [alumnoGrupoAlumnoSuggestions, setAlumnoGrupoAlumnoSuggestions] = useState([]);
  const [alumnoGrupoAlumnoSelected, setAlumnoGrupoAlumnoSelected] = useState(null);
  const [alumnoGrupoMaterias, setAlumnoGrupoMaterias] = useState([]);
  const [alumnoGrupoGrupos, setAlumnoGrupoGrupos] = useState([]);
  const [alumnoGrupoGruposPorMateria, setAlumnoGrupoGruposPorMateria] = useState({});

  const [kpis, setKpis] = useState({
    grupos_sin_docente: 0,
    actas_pendientes: 0,
    alumnos_en_extraordinario: 0,
    expedientes_por_liberar: 0,
  });

  const asignacionForm = useForm({
    resolver: zodResolver(asignacionSchema),
    defaultValues: {
      docente_id: '',
      materia_id: '',
      grupo_id: '',
      horas_semanales: '',
    },
  });

  const horarioForm = useForm({
    resolver: zodResolver(horarioSchema),
    defaultValues: {
      grupo_id: '',
      materia_id: '',
      docente_id: '',
      aula: '',
      dias_semana: [],
      hora_inicio: '07:00',
      hora_fin: '08:30',
      modalidad: 'presencial',
      periodo: 'vigente',
      turno: 'matutino',
    },
  });

  const extraordinarioForm = useForm({
    resolver: zodResolver(extraordinarioSchema),
    defaultValues: {
      alumno_id: '',
      materia_id: '',
      docente_sinodal_id: '',
      fecha_examen: '',
      costo_folio_ref: '',
    },
  });

  const programaForm = useForm({
    resolver: zodResolver(programaSchema),
    defaultValues: {
      expediente_id: '',
      tipo_programa: 'servicio_social',
      estatus: 'en_revision',
      oficio_liberacion: '',
      horas_concluidas: '',
      observaciones: '',
    },
  });

  const meritoForm = useForm({
    resolver: zodResolver(meritoSchema),
    defaultValues: {
      alumno_id: '',
      tipo_merito: 'mencion_honorifica',
      nombre: '',
      archivo_url: '',
    },
  });

  const alumnoGrupoForm = useForm({
    resolver: zodResolver(alumnoGrupoSchema),
    defaultValues: {
      id_alumno: '',
      id_materia: '',
      grupo: '',
    },
  });

  const programaAcademicoForm = useForm({
    resolver: zodResolver(programaAcademicoSchema),
    defaultValues: {
      tipo_nivel: 'licenciatura',
      nombre: '',
      modalidad_periodo: 'semestral',
      total_periodos: 9,
    },
  });

  const materiaPlanForm = useForm({
    resolver: zodResolver(materiaPlanSchema),
    defaultValues: {
      programa_academico_id: '',
      periodo_numero: 1,
      codigo_materia: '',
      nombre_materia: '',
      creditos: 0,
      horas_semanales: 0,
    },
  });

  const alumnos = useMemo(() => alumnosProgreso.map((item) => ({
    id_alumno: item.id_alumno,
    nombre_completo: item.nombre_completo,
    folio_matricula: item.folio_matricula,
  })), [alumnosProgreso]);

  const alumnoGrupoSelectedMateria = alumnoGrupoForm.watch('id_materia');
  const alumnoGrupoGruposDisponibles = useMemo(() => {
    if (alumnoGrupoSelectedMateria && alumnoGrupoGruposPorMateria[alumnoGrupoSelectedMateria]) {
      return alumnoGrupoGruposPorMateria[alumnoGrupoSelectedMateria];
    }
    return alumnoGrupoGrupos;
  }, [alumnoGrupoSelectedMateria, alumnoGrupoGruposPorMateria, alumnoGrupoGrupos]);

  async function loadData() {
    setLoading(true);
    setError('');

    try {
      const [docentesResp, aulasResp, actasResp, programasResp, progresoResp, meritosResp, programasAcademicosResp] = await Promise.all([
        api.get('/coordinacion/docentes-asignaciones'),
        api.get('/coordinacion/aulas-disponibilidad'),
        api.get('/coordinacion/actas-pendientes'),
        api.get('/coordinacion/programas-externos'),
        api.get('/coordinacion/alumnos-progreso'),
        api.get('/coordinacion/meritos-recientes'),
        api.get('/coordinacion/programas'),
      ]);

      const docentesData = docentesResp?.data?.items || [];
      const materiasData = docentesResp?.data?.catalogos?.materias || [];
      const gruposData = docentesResp?.data?.catalogos?.grupos || [];
      const aulasData = aulasResp?.data?.items || [];
      const actasData = actasResp?.data?.items || [];
      const programasData = programasResp?.data?.items || [];
      const progresoData = progresoResp?.data?.items || [];
      const meritosData = meritosResp?.data?.items || [];
      const programasAcademicosData = programasAcademicosResp?.data?.items || [];

      setDocentes(docentesData);
      setMaterias(materiasData);
      setGrupos(gruposData);
      setAulas(aulasData);
      setActas(actasData);
      setProgramas(programasData);
      setProgramasAcademicos(programasAcademicosData);
      setAlumnosProgreso(progresoData);
      setMeritosRecientes(meritosData);

      const firstProgramaAcademico = programasAcademicosData[0] || null;
      if (firstProgramaAcademico) {
        const firstId = String(firstProgramaAcademico.id);
        setSelectedProgramaOfertaId((current) => current || firstId);
        setSelectedProgramaCargaId((current) => current || firstId);
        setSelectedProgramaCalifId((current) => current || firstId);
      }

      const firstPrograma = programasData[0] || null;
      setSelectedPrograma(firstPrograma);

      if (firstPrograma) {
        programaForm.reset({
          expediente_id: String(firstPrograma.id_programa),
          tipo_programa: firstPrograma.tipo_programa,
          estatus: toUiProgramaStatus(firstPrograma.estatus),
          oficio_liberacion: firstPrograma.oficio_liberacion || '',
          horas_concluidas: firstPrograma.horas_concluidas ?? '',
          observaciones: firstPrograma.observaciones || '',
        });
      }

      setKpis({
        grupos_sin_docente: docentesResp?.data?.kpis?.grupos_sin_docente || 0,
        actas_pendientes: actasResp?.data?.kpis?.actas_pendientes || actasData.length,
        alumnos_en_extraordinario: actasResp?.data?.kpis?.alumnos_en_extraordinario
          || docentesResp?.data?.kpis?.alumnos_en_extraordinario
          || 0,
        expedientes_por_liberar: programasData.filter((item) => item.estatus !== 'liberado').length,
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo cargar el modulo de Coordinacion Academica.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadAlumnoGrupoCatalogos() {
      setAlumnoGrupoCatalogLoading(true);
      try {
        const response = await api.get('/admin/alumno-grupos/catalogos');
        setAlumnoGrupoMaterias(response?.data?.materias || []);
        setAlumnoGrupoGrupos(response?.data?.grupos || []);
        setAlumnoGrupoGruposPorMateria(response?.data?.grupos_por_materia || {});
      } catch {
        setAlumnoGrupoMaterias([]);
        setAlumnoGrupoGrupos([]);
        setAlumnoGrupoGruposPorMateria({});
      } finally {
        setAlumnoGrupoCatalogLoading(false);
      }
    }

    loadAlumnoGrupoCatalogos();
  }, []);

  useEffect(() => {
    async function loadAlumnoGrupoItems() {
      setAlumnoGrupoTableLoading(true);
      try {
        const response = await api.get('/admin/alumno-grupos', {
          params: {
            q: alumnoGrupoSearch.trim(),
          },
        });
        setAlumnoGrupoItems(response?.data?.items || []);
      } catch {
        setAlumnoGrupoItems([]);
      } finally {
        setAlumnoGrupoTableLoading(false);
      }
    }

    const timeoutId = setTimeout(() => {
      loadAlumnoGrupoItems();
    }, 260);

    return () => clearTimeout(timeoutId);
  }, [alumnoGrupoSearch]);

  useEffect(() => {
    const trimmed = alumnoGrupoAlumnoQuery.trim();
    if (trimmed.length < 2) {
      setAlumnoGrupoAlumnoSuggestions([]);
      return;
    }

    async function buscarAlumnos() {
      setAlumnoGrupoSearchLoading(true);
      try {
        const response = await api.get('/admin/alumno-grupos/buscar-alumnos', {
          params: { q: trimmed },
        });
        setAlumnoGrupoAlumnoSuggestions(response?.data?.items || []);
      } catch {
        setAlumnoGrupoAlumnoSuggestions([]);
      } finally {
        setAlumnoGrupoSearchLoading(false);
      }
    }

    const timeoutId = setTimeout(() => {
      buscarAlumnos();
    }, 260);

    return () => clearTimeout(timeoutId);
  }, [alumnoGrupoAlumnoQuery]);

  useEffect(() => {
    if (!alumnoGrupoSelectedMateria) return;
    const selectedGrupo = alumnoGrupoForm.getValues('grupo');
    if (!selectedGrupo) return;

    const hasGroupInMateria = (alumnoGrupoGruposPorMateria[alumnoGrupoSelectedMateria] || [])
      .some((item) => item.grupo === selectedGrupo);

    if (!hasGroupInMateria) {
      alumnoGrupoForm.setValue('grupo', '');
    }
  }, [alumnoGrupoSelectedMateria, alumnoGrupoGruposPorMateria, alumnoGrupoForm]);

  async function submitAlumnoGrupo(values) {
    setAlumnoGrupoSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/admin/alumno-grupos', {
        id_alumno: Number(values.id_alumno),
        id_materia: Number(values.id_materia),
        grupo: values.grupo,
      });

      setMessage('Alumno inscrito/asignado correctamente al grupo.');
      alumnoGrupoForm.reset({ id_alumno: '', id_materia: '', grupo: '' });
      setAlumnoGrupoAlumnoQuery('');
      setAlumnoGrupoAlumnoSelected(null);
      setAlumnoGrupoAlumnoSuggestions([]);

      const response = await api.get('/admin/alumno-grupos', {
        params: { q: alumnoGrupoSearch.trim() },
      });
      setAlumnoGrupoItems(response?.data?.items || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar la asignacion alumno-grupo.');
    } finally {
      setAlumnoGrupoSending(false);
    }
  }

  async function eliminarAlumnoGrupo(idAlumno, idMateria) {
    setError('');
    setMessage('');

    try {
      await api.delete(`/admin/alumno-grupos/${idAlumno}/${idMateria}`);
      setMessage('Asignacion alumno-grupo eliminada.');
      const response = await api.get('/admin/alumno-grupos', {
        params: { q: alumnoGrupoSearch.trim() },
      });
      setAlumnoGrupoItems(response?.data?.items || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo eliminar la asignacion alumno-grupo.');
    }
  }

  async function submitAsignacion(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/coordinacion/asignar-materia-docente', {
        docente_id: Number(values.docente_id),
        materia_id: Number(values.materia_id),
        grupo_id: values.grupo_id,
        horas_semanales: Number(values.horas_semanales),
      });
      setMessage('Asignacion docente registrada correctamente.');
      asignacionForm.reset({ docente_id: '', materia_id: '', grupo_id: '', horas_semanales: '' });
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar la asignacion docente.');
    } finally {
      setSending(false);
    }
  }

  async function submitHorario(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/coordinacion/programar-horario-grupo', {
        grupo_id: values.grupo_id,
        materia_id: Number(values.materia_id),
        docente_id: Number(values.docente_id),
        aula: values.aula.trim(),
        dias_semana: values.dias_semana,
        hora_inicio: values.hora_inicio,
        hora_fin: values.hora_fin,
        modalidad: values.modalidad,
        periodo: values.periodo,
        turno: values.turno,
      });
      setMessage('Horario programado sin empalmes.');
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo programar el horario.');
    } finally {
      setSending(false);
    }
  }

  async function validarActa(actaId) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.put(`/coordinacion/actas/${actaId}/validar`, {});
      setMessage(`Acta #${actaId} validada y cerrada oficialmente.`);
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo validar el acta.');
    } finally {
      setSending(false);
    }
  }

  async function submitExtraordinario(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/coordinacion/programar-extraordinario', {
        alumno_id: Number(values.alumno_id),
        materia_id: Number(values.materia_id),
        docente_sinodal_id: Number(values.docente_sinodal_id),
        fecha_examen: values.fecha_examen,
        costo_folio_ref: values.costo_folio_ref.trim(),
      });
      setMessage('Examen extraordinario programado correctamente.');
      extraordinarioForm.reset({
        alumno_id: '',
        materia_id: '',
        docente_sinodal_id: '',
        fecha_examen: '',
        costo_folio_ref: '',
      });
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo programar el extraordinario.');
    } finally {
      setSending(false);
    }
  }

  async function submitPrograma(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.put(`/coordinacion/programas-externos/${Number(values.expediente_id)}/estatus`, {
        estatus: values.estatus,
        oficio_liberacion: values.oficio_liberacion?.trim() || undefined,
        horas_concluidas: Number(values.horas_concluidas),
        observaciones: values.observaciones?.trim() || undefined,
      });
      setMessage('Expediente externo actualizado correctamente.');
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo actualizar el expediente externo.');
    } finally {
      setSending(false);
    }
  }

  async function submitMerito(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/coordinacion/asignar-merito', {
        alumno_id: Number(values.alumno_id),
        tipo_merito: values.tipo_merito,
        nombre: values.nombre.trim(),
        archivo_url: values.archivo_url?.trim() || undefined,
      });
      setMessage('Merito academico registrado correctamente.');
      meritoForm.reset({ alumno_id: '', tipo_merito: 'mencion_honorifica', nombre: '', archivo_url: '' });
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo registrar el merito.');
    } finally {
      setSending(false);
    }
  }

  const periodoOptionsCarga = useMemo(() => {
    const programa = programasAcademicos.find((item) => String(item.id) === String(selectedProgramaCargaId));
    if (!programa) return [];
    return Array.from({ length: Number(programa.total_periodos || 0) }, (_, index) => {
      const numero = index + 1;
      const base = programa.modalidad_periodo === 'semestral' ? 'Semestre' : 'Cuatrimestre';
      return { value: String(numero), label: `${base} ${numero}` };
    });
  }, [programasAcademicos, selectedProgramaCargaId]);

  const periodoOptionsCalif = useMemo(() => {
    const programa = programasAcademicos.find((item) => String(item.id) === String(selectedProgramaCalifId));
    if (!programa) return [];
    return Array.from({ length: Number(programa.total_periodos || 0) }, (_, index) => {
      const numero = index + 1;
      const base = programa.modalidad_periodo === 'semestral' ? 'Semestre' : 'Cuatrimestre';
      return { value: String(numero), label: `${base} ${numero}` };
    });
  }, [programasAcademicos, selectedProgramaCalifId]);

  const materiasCargaFiltradas = useMemo(() => materias.filter((materia) => {
    if (!selectedProgramaCargaId) {
      return false;
    }
    if (selectedProgramaCargaId && String(materia.programa_academico_id || '') !== String(selectedProgramaCargaId)) {
      return false;
    }
    if (selectedPeriodoCarga && String(materia.periodo_numero || materia.bimestre_pertenece || '') !== String(selectedPeriodoCarga)) {
      return false;
    }
    return true;
  }), [materias, selectedProgramaCargaId, selectedPeriodoCarga]);

  const materiasCalifFiltradas = useMemo(() => materias.filter((materia) => {
    if (!selectedProgramaCalifId) {
      return false;
    }
    if (selectedProgramaCalifId && String(materia.programa_academico_id || '') !== String(selectedProgramaCalifId)) {
      return false;
    }
    if (selectedPeriodoCalif && String(materia.periodo_numero || materia.bimestre_pertenece || '') !== String(selectedPeriodoCalif)) {
      return false;
    }
    return true;
  }), [materias, selectedProgramaCalifId, selectedPeriodoCalif]);

  const materiaIdsCarga = useMemo(() => new Set(materiasCargaFiltradas.map((item) => Number(item.id_materia))), [materiasCargaFiltradas]);
  const gruposCargaFiltrados = useMemo(
    () => grupos.filter((grupo) => materiaIdsCarga.has(Number(grupo.materia_id))),
    [grupos, materiaIdsCarga],
  );

  useEffect(() => {
    const first = periodoOptionsCarga[0]?.value || '';
    setSelectedPeriodoCarga((current) => {
      if (!periodoOptionsCarga.length) return '';
      if (periodoOptionsCarga.some((item) => item.value === current)) return current;
      return first;
    });
  }, [periodoOptionsCarga]);

  useEffect(() => {
    const first = periodoOptionsCalif[0]?.value || '';
    setSelectedPeriodoCalif((current) => {
      if (!periodoOptionsCalif.length) return '';
      if (periodoOptionsCalif.some((item) => item.value === current)) return current;
      return first;
    });
  }, [periodoOptionsCalif]);

  useEffect(() => {
    async function loadMateriasPrograma() {
      if (!selectedProgramaOfertaId) {
        setProgramaCurricular(null);
        setProgramaPeriodos([]);
        return;
      }

      try {
        const response = await api.get(`/coordinacion/programas/${Number(selectedProgramaOfertaId)}/materias`);
        setProgramaCurricular(response?.data?.programa || null);
        setProgramaPeriodos(response?.data?.periodos || []);
        materiaPlanForm.setValue('programa_academico_id', String(selectedProgramaOfertaId), { shouldValidate: true });
      } catch {
        setProgramaCurricular(null);
        setProgramaPeriodos([]);
      }
    }

    loadMateriasPrograma();
  }, [selectedProgramaOfertaId, materiaPlanForm]);

  async function refreshProgramasAcademicos() {
    const response = await api.get('/coordinacion/programas');
    const items = response?.data?.items || [];
    setProgramasAcademicos(items);
    return items;
  }

  async function submitProgramaAcademico(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      if (editingProgramaAcademicoId) {
        await api.put(`/coordinacion/programas/${editingProgramaAcademicoId}`, {
          nombre: values.nombre,
          modalidad_periodo: values.modalidad_periodo,
          total_periodos: Number(values.total_periodos),
        });
        setMessage('Programa academico actualizado.');
      } else {
        await api.post('/coordinacion/programas', {
          tipo_nivel: values.tipo_nivel,
          nombre: values.nombre,
          modalidad_periodo: values.modalidad_periodo,
          total_periodos: Number(values.total_periodos),
        });
        setMessage('Programa academico creado.');
      }

      const programasActualizados = await refreshProgramasAcademicos();
      if (programasActualizados.length > 0 && !selectedProgramaOfertaId) {
        const firstId = String(programasActualizados[0].id);
        setSelectedProgramaOfertaId(firstId);
      }

      setEditingProgramaAcademicoId(null);
      programaAcademicoForm.reset({
        tipo_nivel: 'licenciatura',
        nombre: '',
        modalidad_periodo: 'semestral',
        total_periodos: 9,
      });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar el programa academico.');
    } finally {
      setSending(false);
    }
  }

  async function desactivarProgramaAcademico(id) {
    setSending(true);
    setError('');
    setMessage('');
    try {
      await api.delete(`/coordinacion/programas/${id}`);
      setMessage('Programa academico desactivado.');
      const programasActualizados = await refreshProgramasAcademicos();
      if (!programasActualizados.some((item) => String(item.id) === String(selectedProgramaOfertaId))) {
        const nextId = programasActualizados[0] ? String(programasActualizados[0].id) : '';
        setSelectedProgramaOfertaId(nextId);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo desactivar el programa academico.');
    } finally {
      setSending(false);
    }
  }

  async function submitMateriaPlan(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        programa_academico_id: Number(values.programa_academico_id),
        periodo_numero: Number(values.periodo_numero),
        codigo_materia: values.codigo_materia.trim(),
        nombre_materia: values.nombre_materia.trim(),
        creditos: values.creditos === undefined ? undefined : Number(values.creditos),
        horas_semanales: values.horas_semanales === undefined ? undefined : Number(values.horas_semanales),
      };

      if (editingMateriaPlanId) {
        await api.put(`/coordinacion/materias/${editingMateriaPlanId}`, payload);
        setMessage('Materia actualizada.');
      } else {
        await api.post('/coordinacion/materias', payload);
        setMessage('Materia agregada al plan de estudios.');
      }

      setEditingMateriaPlanId(null);
      materiaPlanForm.reset({
        programa_academico_id: String(selectedProgramaOfertaId || values.programa_academico_id),
        periodo_numero: Number(values.periodo_numero),
        codigo_materia: '',
        nombre_materia: '',
        creditos: 0,
        horas_semanales: 0,
      });

      await loadData();
      const response = await api.get(`/coordinacion/programas/${Number(selectedProgramaOfertaId)}/materias`);
      setProgramaCurricular(response?.data?.programa || null);
      setProgramaPeriodos(response?.data?.periodos || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar la materia del plan.');
    } finally {
      setSending(false);
    }
  }

  async function eliminarMateriaPlan(idMateria) {
    setSending(true);
    setError('');
    setMessage('');
    try {
      await api.delete(`/coordinacion/materias/${idMateria}`);
      setMessage('Materia eliminada del plan de estudios.');
      await loadData();
      const response = await api.get(`/coordinacion/programas/${Number(selectedProgramaOfertaId)}/materias`);
      setProgramaCurricular(response?.data?.programa || null);
      setProgramaPeriodos(response?.data?.periodos || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo eliminar la materia.');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="coord-page">
      <header className="coord-header">
        <p className="coord-eyebrow">Modulo Academico Operativo</p>
        <h2>Coordinacion Academica</h2>
        <p>Gestiona asignaciones docentes, horarios, actas, extraordinarios y expedientes academicos sin funciones de tesoreria.</p>
      </header>

      <div className="coord-kpis">
        <article className="coord-kpi">
          <p>Grupos sin docente</p>
          <strong>{kpis.grupos_sin_docente}</strong>
        </article>
        <article className="coord-kpi">
          <p>Actas pendientes</p>
          <strong>{kpis.actas_pendientes}</strong>
        </article>
        <article className="coord-kpi">
          <p>Alumnos en extraordinario</p>
          <strong>{kpis.alumnos_en_extraordinario}</strong>
        </article>
        <article className="coord-kpi">
          <p>Expedientes por liberar</p>
          <strong>{kpis.expedientes_por_liberar}</strong>
        </article>
      </div>

      <div className="coord-tabs" role="tablist" aria-label="Submodulos coordinacion academica">
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

      {message ? <p className="ok-box">{message}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      {activeTab === 'carga' ? (
        <div className="coord-grid-2">
          <article className="coord-card coord-span-2">
            <h3>Filtro curricular para carga horaria</h3>
            <div className="coord-curricular-grid">
              <div className="coord-form-group">
                <label htmlFor="coord-carga-programa">Programa / Carrera</label>
                <select
                  id="coord-carga-programa"
                  value={selectedProgramaCargaId}
                  onChange={(event) => setSelectedProgramaCargaId(event.target.value)}
                >
                  <option value="">Selecciona programa</option>
                  {programasAcademicos.map((item) => (
                    <option key={`pc-${item.id}`} value={String(item.id)}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="coord-form-group">
                <label htmlFor="coord-carga-periodo">Periodo / Semestre</label>
                <select
                  id="coord-carga-periodo"
                  value={selectedPeriodoCarga}
                  onChange={(event) => setSelectedPeriodoCarga(event.target.value)}
                  disabled={!selectedProgramaCargaId}
                >
                  <option value="">Selecciona periodo</option>
                  {periodoOptionsCarga.map((item) => (
                    <option key={`pc-per-${item.value}`} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </article>

          <article className="coord-card coord-span-2">
            <h3>Inscripcion y asignacion alumno a materia/grupo</h3>
            <form className="form-grid coord-form-4" onSubmit={alumnoGrupoForm.handleSubmit(submitAlumnoGrupo)}>
              <label htmlFor="coord-ag-alumno">Alumno</label>
              <div className="coord-combobox-wrap">
                <input
                  id="coord-ag-alumno"
                  name="coord_ag_alumno"
                  type="text"
                  value={alumnoGrupoAlumnoQuery}
                  onChange={(event) => {
                    setAlumnoGrupoAlumnoQuery(event.target.value);
                    if (alumnoGrupoAlumnoSelected) {
                      setAlumnoGrupoAlumnoSelected(null);
                      alumnoGrupoForm.setValue('id_alumno', '');
                    }
                  }}
                  placeholder="UNICEP-26-001 · Carlos Chan"
                  autoComplete="off"
                />
                {alumnoGrupoSearchLoading ? <small>Buscando alumnos...</small> : null}
                {!alumnoGrupoAlumnoSelected && alumnoGrupoAlumnoSuggestions.length > 0 ? (
                  <div className="coord-combobox-list" role="listbox" aria-label="Resultados de alumnos">
                    {alumnoGrupoAlumnoSuggestions.map((alumno) => (
                      <button
                        key={alumno.id_alumno}
                        type="button"
                        className="coord-combobox-option"
                        onClick={() => {
                          setAlumnoGrupoAlumnoSelected(alumno);
                          setAlumnoGrupoAlumnoQuery(alumno.label);
                          alumnoGrupoForm.setValue('id_alumno', String(alumno.id_alumno), { shouldValidate: true });
                          setAlumnoGrupoAlumnoSuggestions([]);
                        }}
                      >
                        {alumno.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                {alumnoGrupoAlumnoSelected ? <small>{`Seleccionado: ${alumnoGrupoAlumnoSelected.label}`}</small> : null}
                <input type="hidden" {...alumnoGrupoForm.register('id_alumno')} />
                {alumnoGrupoForm.formState.errors.id_alumno ? <small>{alumnoGrupoForm.formState.errors.id_alumno.message}</small> : null}
              </div>

              <label htmlFor="coord-ag-materia">Asignatura</label>
              <select id="coord-ag-materia" {...alumnoGrupoForm.register('id_materia')} disabled={alumnoGrupoCatalogLoading}>
                <option value="">Selecciona asignatura activa</option>
                {alumnoGrupoMaterias.map((materia) => (
                  <option key={materia.id_materia} value={String(materia.id_materia)}>
                    {`${materia.nombre_materia} (${materia.codigo_materia || 'SIN-CODIGO'})`}
                  </option>
                ))}
              </select>
              {alumnoGrupoForm.formState.errors.id_materia ? <small>{alumnoGrupoForm.formState.errors.id_materia.message}</small> : null}

              <label htmlFor="coord-ag-grupo">Grupo</label>
              <select id="coord-ag-grupo" {...alumnoGrupoForm.register('grupo')} disabled={alumnoGrupoCatalogLoading || alumnoGrupoGruposDisponibles.length === 0}>
                <option value="">Selecciona grupo</option>
                {alumnoGrupoGruposDisponibles.map((item) => (
                  <option key={`${item.id_materia || alumnoGrupoSelectedMateria}-${item.grupo}`} value={item.grupo}>
                    {item.grupo}
                  </option>
                ))}
              </select>
              {alumnoGrupoForm.formState.errors.grupo ? <small>{alumnoGrupoForm.formState.errors.grupo.message}</small> : null}

              <button type="submit" className="btn-primary" disabled={loading || alumnoGrupoSending || alumnoGrupoCatalogLoading}>
                {alumnoGrupoSending ? 'Guardando...' : 'Inscribir alumno'}
              </button>
            </form>

            <div className="form-grid coord-search-wrap">
              <label htmlFor="coord-ag-search">Busqueda en tiempo real</label>
              <input
                id="coord-ag-search"
                type="text"
                value={alumnoGrupoSearch}
                onChange={(event) => setAlumnoGrupoSearch(event.target.value)}
                placeholder="Nombre, matricula, materia, codigo o grupo"
              />
            </div>

            <div className="table-wrap coord-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Alumno</th>
                    <th>Asignatura</th>
                    <th>Grupo</th>
                    <th>Fecha alta</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnoGrupoTableLoading ? (
                    <tr>
                      <td colSpan="6">Cargando asignaciones...</td>
                    </tr>
                  ) : null}
                  {!alumnoGrupoTableLoading && alumnoGrupoItems.length === 0 ? (
                    <tr>
                      <td colSpan="6">Sin resultados.</td>
                    </tr>
                  ) : null}
                  {!alumnoGrupoTableLoading ? alumnoGrupoItems.map((item) => (
                    <tr key={`ag-${item.id_alumno_grupo}`}>
                      <td>{item.id_alumno_grupo}</td>
                      <td>{item.alumno?.usuario ? `${item.alumno.usuario.folio_matricula || 'SIN-FOLIO'} · ${item.alumno.usuario.nombre_completo}` : item.id_alumno}</td>
                      <td>{item.materia ? `${item.materia.nombre_materia} (${item.materia.codigo_materia || 'SIN-CODIGO'})` : item.id_materia}</td>
                      <td>{item.grupo}</td>
                      <td>{new Date(item.fecha_alta).toLocaleString()}</td>
                      <td>
                        <button type="button" className="btn-danger-sm" onClick={() => eliminarAlumnoGrupo(item.id_alumno, item.id_materia)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="coord-card">
            <h3>Asignador docente por materia y grupo</h3>
            <form className="form-grid" onSubmit={asignacionForm.handleSubmit(submitAsignacion)}>
              <label htmlFor="coord-docente">Docente</label>
              <select id="coord-docente" {...asignacionForm.register('docente_id')}>
                <option value="">Selecciona docente</option>
                {docentes.map((docente) => (
                  <option key={docente.id_docente} value={String(docente.id_docente)}>
                    {docente.nombre_completo}
                  </option>
                ))}
              </select>
              {asignacionForm.formState.errors.docente_id ? <small>{asignacionForm.formState.errors.docente_id.message}</small> : null}

              <label htmlFor="coord-materia">Materia</label>
              <select id="coord-materia" {...asignacionForm.register('materia_id')}>
                <option value="">Selecciona materia</option>
                {materiasCargaFiltradas.map((materia) => (
                  <option key={materia.id_materia} value={String(materia.id_materia)}>
                    {materia.nombre_materia}
                  </option>
                ))}
              </select>
              {asignacionForm.formState.errors.materia_id ? <small>{asignacionForm.formState.errors.materia_id.message}</small> : null}

              <label htmlFor="coord-grupo">Grupo</label>
              <select id="coord-grupo" {...asignacionForm.register('grupo_id')}>
                <option value="">Selecciona grupo</option>
                {gruposCargaFiltrados.map((grupo) => (
                  <option key={`${grupo.materia_id}-${grupo.grupo_id}`} value={grupo.grupo_id}>
                    {grupo.etiqueta}
                  </option>
                ))}
              </select>
              {asignacionForm.formState.errors.grupo_id ? <small>{asignacionForm.formState.errors.grupo_id.message}</small> : null}

              <label htmlFor="coord-horas">Horas semanales</label>
              <input id="coord-horas" type="number" min="1" step="1" {...asignacionForm.register('horas_semanales')} />
              {asignacionForm.formState.errors.horas_semanales ? <small>{asignacionForm.formState.errors.horas_semanales.message}</small> : null}

              <button type="submit" className="btn-primary" disabled={loading || sending}>
                {sending ? 'Guardando...' : 'Asignar docente'}
              </button>
            </form>
          </article>

          <article className="coord-card">
            <h3>Programacion de horario y aula</h3>
            <form className="form-grid" onSubmit={horarioForm.handleSubmit(submitHorario)}>
              <label htmlFor="coord-h-grupo">Grupo</label>
              <select id="coord-h-grupo" {...horarioForm.register('grupo_id')}>
                <option value="">Selecciona grupo</option>
                {gruposCargaFiltrados.map((grupo) => (
                  <option key={`h-${grupo.materia_id}-${grupo.grupo_id}`} value={grupo.grupo_id}>
                    {grupo.etiqueta}
                  </option>
                ))}
              </select>

              <label htmlFor="coord-h-materia">Materia</label>
              <select id="coord-h-materia" {...horarioForm.register('materia_id')}>
                <option value="">Selecciona materia</option>
                {materiasCargaFiltradas.map((materia) => (
                  <option key={`h-m-${materia.id_materia}`} value={String(materia.id_materia)}>
                    {materia.nombre_materia}
                  </option>
                ))}
              </select>

              <label htmlFor="coord-h-docente">Docente</label>
              <select id="coord-h-docente" {...horarioForm.register('docente_id')}>
                <option value="">Selecciona docente</option>
                {docentes.map((docente) => (
                  <option key={`h-d-${docente.id_docente}`} value={String(docente.id_docente)}>
                    {docente.nombre_completo}
                  </option>
                ))}
              </select>

              <label htmlFor="coord-h-aula">Aula fisica/virtual</label>
              <input id="coord-h-aula" placeholder="AULA-101 o SALA-VIRTUAL-1" {...horarioForm.register('aula')} />

              <label htmlFor="coord-hora-inicio">Hora inicio</label>
              <input id="coord-hora-inicio" type="time" {...horarioForm.register('hora_inicio')} />

              <label htmlFor="coord-hora-fin">Hora fin</label>
              <input id="coord-hora-fin" type="time" {...horarioForm.register('hora_fin')} />

              <label>Dias de la semana</label>
              <div className="coord-days">
                {['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map((day) => (
                  <label key={day} className="coord-checkbox">
                    <input type="checkbox" value={day} {...horarioForm.register('dias_semana')} />
                    <span>{day}</span>
                  </label>
                ))}
              </div>
              {horarioForm.formState.errors.dias_semana ? <small>{horarioForm.formState.errors.dias_semana.message}</small> : null}

              <button type="submit" className="btn-secondary" disabled={loading || sending}>
                {sending ? 'Programando...' : 'Programar horario'}
              </button>
            </form>
          </article>

          <article className="coord-card coord-span-2">
            <h3>Plantilla docente y carga semanal</h3>
            <div className="table-wrap coord-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Docente</th>
                    <th>Horas</th>
                    <th>Materias vinculadas</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3">Cargando plantilla...</td>
                    </tr>
                  ) : null}
                  {!loading && docentes.length === 0 ? (
                    <tr>
                      <td colSpan="3">Sin docentes activos.</td>
                    </tr>
                  ) : null}
                  {!loading ? docentes.map((docente) => (
                    <tr key={`t-doc-${docente.id_docente}`}>
                      <td>
                        <strong>{docente.nombre_completo}</strong>
                        <p>{docente.folio_matricula || 'SIN-FOLIO'}</p>
                      </td>
                      <td>{docente.horas_semanales}</td>
                      <td>
                        {(docente.materias || []).length === 0
                          ? 'Sin asignaciones'
                          : docente.materias.map((m) => `${m.materia} (${m.grupo})`).join(', ')}
                      </td>
                    </tr>
                  )) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="coord-card coord-span-2">
            <h3>Disponibilidad de aulas</h3>
            <div className="coord-aulas-grid">
              {aulas.map((aula) => (
                <div key={aula.aula} className="coord-aula-item">
                  <h4>{aula.aula}</h4>
                  {aula.ocupacion.length === 0 ? <p>Sin ocupacion.</p> : null}
                  {aula.ocupacion.map((slot) => (
                    <p key={slot.id_horario}>{`${slot.dias_semana.join('/')} · ${slot.hora_inicio}-${slot.hora_fin}`}</p>
                  ))}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'calificaciones' ? (
        <div className="coord-grid-2">
          <article className="coord-card coord-span-2">
            <h3>Filtro curricular para calificaciones</h3>
            <div className="coord-curricular-grid">
              <div className="coord-form-group">
                <label htmlFor="coord-calif-programa">Programa / Carrera</label>
                <select
                  id="coord-calif-programa"
                  value={selectedProgramaCalifId}
                  onChange={(event) => setSelectedProgramaCalifId(event.target.value)}
                >
                  <option value="">Selecciona programa</option>
                  {programasAcademicos.map((item) => (
                    <option key={`pcal-${item.id}`} value={String(item.id)}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="coord-form-group">
                <label htmlFor="coord-calif-periodo">Periodo / Semestre</label>
                <select
                  id="coord-calif-periodo"
                  value={selectedPeriodoCalif}
                  onChange={(event) => setSelectedPeriodoCalif(event.target.value)}
                  disabled={!selectedProgramaCalifId}
                >
                  <option value="">Selecciona periodo</option>
                  {periodoOptionsCalif.map((item) => (
                    <option key={`pcal-per-${item.value}`} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </article>

          <article className="coord-card coord-span-2">
            <h3>Actas pendientes de validacion</h3>
            <div className="table-wrap coord-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Carrera</th>
                    <th>Estatus</th>
                    <th>Reprobados</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5">Cargando actas...</td>
                    </tr>
                  ) : null}
                  {!loading && actas.length === 0 ? (
                    <tr>
                      <td colSpan="5">Sin actas pendientes.</td>
                    </tr>
                  ) : null}
                  {!loading ? actas.map((acta) => (
                    <tr key={acta.id_acta}>
                      <td>{acta.id_acta}</td>
                      <td>{acta.carrera}</td>
                      <td>{acta.estatus}</td>
                      <td>{acta.total_reprobados}</td>
                      <td>
                        <button type="button" className="btn-secondary" disabled={sending} onClick={() => validarActa(acta.id_acta)}>
                          Validar acta
                        </button>
                      </td>
                    </tr>
                  )) : null}
                </tbody>
              </table>
            </div>
          </article>

          <article className="coord-card coord-span-2">
            <h3>Programar examen extraordinario</h3>
            <form className="form-grid coord-form-4" onSubmit={extraordinarioForm.handleSubmit(submitExtraordinario)}>
              <label htmlFor="coord-ext-alumno">Alumno</label>
              <select id="coord-ext-alumno" {...extraordinarioForm.register('alumno_id')}>
                <option value="">Selecciona alumno</option>
                {alumnos.map((alumno) => (
                  <option key={alumno.id_alumno} value={String(alumno.id_alumno)}>
                    {`${alumno.folio_matricula || 'SIN-FOLIO'} · ${alumno.nombre_completo}`}
                  </option>
                ))}
              </select>
              {extraordinarioForm.formState.errors.alumno_id ? <small>{extraordinarioForm.formState.errors.alumno_id.message}</small> : null}

              <label htmlFor="coord-ext-materia">Materia</label>
              <select id="coord-ext-materia" {...extraordinarioForm.register('materia_id')}>
                <option value="">Selecciona materia</option>
                {materiasCalifFiltradas.map((materia) => (
                  <option key={`e-m-${materia.id_materia}`} value={String(materia.id_materia)}>
                    {materia.nombre_materia}
                  </option>
                ))}
              </select>
              {extraordinarioForm.formState.errors.materia_id ? <small>{extraordinarioForm.formState.errors.materia_id.message}</small> : null}

              <label htmlFor="coord-ext-docente">Docente sinodal</label>
              <select id="coord-ext-docente" {...extraordinarioForm.register('docente_sinodal_id')}>
                <option value="">Selecciona docente</option>
                {docentes.map((docente) => (
                  <option key={`e-d-${docente.id_docente}`} value={String(docente.id_docente)}>
                    {docente.nombre_completo}
                  </option>
                ))}
              </select>
              {extraordinarioForm.formState.errors.docente_sinodal_id ? <small>{extraordinarioForm.formState.errors.docente_sinodal_id.message}</small> : null}

              <label htmlFor="coord-ext-fecha">Fecha de examen</label>
              <input id="coord-ext-fecha" type="date" {...extraordinarioForm.register('fecha_examen')} />
              {extraordinarioForm.formState.errors.fecha_examen ? <small>{extraordinarioForm.formState.errors.fecha_examen.message}</small> : null}

              <label htmlFor="coord-ext-folio">Costo/Folio referencia</label>
              <input id="coord-ext-folio" placeholder="EXT-2026-001" {...extraordinarioForm.register('costo_folio_ref')} />
              {extraordinarioForm.formState.errors.costo_folio_ref ? <small>{extraordinarioForm.formState.errors.costo_folio_ref.message}</small> : null}

              <button type="submit" className="btn-primary" disabled={loading || sending}>
                {sending ? 'Agendando...' : 'Agendar extraordinario'}
              </button>
            </form>
          </article>
        </div>
      ) : null}

      {activeTab === 'oferta' ? (
        <div className="coord-grid-2">
          <article className="coord-card">
            <h3>{editingProgramaAcademicoId ? 'Editar programa academico' : 'Crear programa academico'}</h3>
            <form className="form-grid" onSubmit={programaAcademicoForm.handleSubmit(submitProgramaAcademico)}>
              <label htmlFor="coord-pa-nivel">Nivel</label>
              <select id="coord-pa-nivel" {...programaAcademicoForm.register('tipo_nivel')}>
                <option value="preparatoria">Preparatoria</option>
                <option value="licenciatura">Licenciatura</option>
                <option value="ingenieria">Ingenieria</option>
                <option value="maestria">Maestria</option>
              </select>

              <label htmlFor="coord-pa-nombre">Nombre del programa</label>
              <input id="coord-pa-nombre" placeholder="Ing. en Desarrollo de Software" {...programaAcademicoForm.register('nombre')} />
              {programaAcademicoForm.formState.errors.nombre ? <small>{programaAcademicoForm.formState.errors.nombre.message}</small> : null}

              <label>Modalidad de periodos</label>
              <div className="coord-days">
                <label className="coord-checkbox">
                  <input type="radio" value="semestral" {...programaAcademicoForm.register('modalidad_periodo')} />
                  <span>Semestral</span>
                </label>
                <label className="coord-checkbox">
                  <input type="radio" value="cuatrimestral" {...programaAcademicoForm.register('modalidad_periodo')} />
                  <span>Cuatrimestral</span>
                </label>
              </div>

              <label htmlFor="coord-pa-total">Total de periodos</label>
              <input id="coord-pa-total" type="number" min="1" max="20" {...programaAcademicoForm.register('total_periodos')} />
              {programaAcademicoForm.formState.errors.total_periodos ? <small>{programaAcademicoForm.formState.errors.total_periodos.message}</small> : null}

              <button type="submit" className="btn-primary" disabled={loading || sending}>
                {sending ? 'Guardando...' : 'Guardar Programa Academico'}
              </button>

              {editingProgramaAcademicoId ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingProgramaAcademicoId(null);
                    programaAcademicoForm.reset({
                      tipo_nivel: 'licenciatura',
                      nombre: '',
                      modalidad_periodo: 'semestral',
                      total_periodos: 9,
                    });
                  }}
                >
                  Cancelar edicion
                </button>
              ) : null}
            </form>

            <div className="coord-list">
              {programasAcademicos.map((programa) => (
                <div key={`pa-row-${programa.id}`} className="coord-list-item">
                  <strong>{programa.nombre}</strong>
                  <span>{`${programa.tipo_nivel} · ${programa.modalidad_periodo}`}</span>
                  <span>{`${programa.total_materias || 0} materias`}</span>
                  <div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setEditingProgramaAcademicoId(programa.id);
                        programaAcademicoForm.reset({
                          tipo_nivel: programa.tipo_nivel,
                          nombre: programa.nombre,
                          modalidad_periodo: programa.modalidad_periodo,
                          total_periodos: programa.total_periodos,
                        });
                        setSelectedProgramaOfertaId(String(programa.id));
                      }}
                    >
                      Editar
                    </button>
                    <button type="button" className="btn-danger-sm" onClick={() => desactivarProgramaAcademico(programa.id)}>
                      Desactivar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="coord-card">
            <h3>Organizador de materias por periodos</h3>

            <div className="form-grid">
              <label htmlFor="coord-oferta-programa">Programa a gestionar</label>
              <select
                id="coord-oferta-programa"
                value={selectedProgramaOfertaId}
                onChange={(event) => {
                  setSelectedProgramaOfertaId(event.target.value);
                  setEditingMateriaPlanId(null);
                }}
              >
                <option value="">Selecciona programa</option>
                {programasAcademicos.map((item) => (
                  <option key={`po-${item.id}`} value={String(item.id)}>{item.nombre}</option>
                ))}
              </select>
            </div>

            <form className="coord-materia-grid" onSubmit={materiaPlanForm.handleSubmit(submitMateriaPlan)}>
              <input type="hidden" {...materiaPlanForm.register('programa_academico_id')} />

              <div className="coord-form-group">
                <label htmlFor="coord-mat-periodo">Periodo</label>
                <select id="coord-mat-periodo" {...materiaPlanForm.register('periodo_numero')} disabled={!programaCurricular}>
                  {(programaPeriodos || []).map((periodo) => (
                    <option key={`periodo-${periodo.numero}`} value={String(periodo.numero)}>{periodo.label}</option>
                  ))}
                </select>
              </div>

              <div className="coord-form-group">
                <label htmlFor="coord-mat-codigo">Codigo de Materia</label>
                <input id="coord-mat-codigo" placeholder="ING-101" {...materiaPlanForm.register('codigo_materia')} />
              </div>

              <div className="coord-form-group coord-col-span-2">
                <label htmlFor="coord-mat-nombre">Nombre de la Asignatura</label>
                <input id="coord-mat-nombre" placeholder="Calculo Diferencial" {...materiaPlanForm.register('nombre_materia')} />
              </div>

              <div className="coord-form-group">
                <label htmlFor="coord-mat-creditos">Creditos</label>
                <input id="coord-mat-creditos" type="number" min="0" step="1" {...materiaPlanForm.register('creditos')} />
              </div>

              <div className="coord-form-group">
                <label htmlFor="coord-mat-horas">Horas semanales</label>
                <input id="coord-mat-horas" type="number" min="0" step="1" {...materiaPlanForm.register('horas_semanales')} />
              </div>

              <button type="submit" className="btn-primary" disabled={loading || sending || !selectedProgramaOfertaId}>
                {editingMateriaPlanId ? 'Actualizar materia' : 'Agregar Materia'}
              </button>

              {editingMateriaPlanId ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingMateriaPlanId(null);
                    materiaPlanForm.reset({
                      programa_academico_id: String(selectedProgramaOfertaId),
                      periodo_numero: 1,
                      codigo_materia: '',
                      nombre_materia: '',
                      creditos: 0,
                      horas_semanales: 0,
                    });
                  }}
                >
                  Cancelar edicion
                </button>
              ) : null}
            </form>

            <div className="coord-list coord-periodos-list">
              {(programaPeriodos || []).map((periodo) => (
                <div key={`bloque-${periodo.numero}`} className="coord-list-item">
                  <strong>{periodo.label}</strong>
                  {periodo.materias.length === 0 ? <p>Sin materias asignadas.</p> : null}
                  {periodo.materias.map((materia) => (
                    <div key={`materia-row-${materia.id_materia || materia.id}`} className="coord-materia-row">
                      <span>{`${materia.codigo_materia} · ${materia.nombre_materia} · ${materia.creditos ?? 0} cred. · ${materia.horas_semanales ?? 0} hrs/sem`}</span>
                      <div>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            const idMateria = materia.id_materia || materia.id;
                            setEditingMateriaPlanId(idMateria);
                            materiaPlanForm.reset({
                              programa_academico_id: String(selectedProgramaOfertaId),
                              periodo_numero: Number(materia.periodo_numero || periodo.numero),
                              codigo_materia: materia.codigo_materia || '',
                              nombre_materia: materia.nombre_materia || '',
                              creditos: materia.creditos ?? 0,
                              horas_semanales: materia.horas_semanales ?? 0,
                            });
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-danger-sm"
                          onClick={() => eliminarMateriaPlan(materia.id_materia || materia.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </article>
        </div>
      ) : null}

      {activeTab === 'servicio' ? (
        <div className="coord-grid-2">
          <article className="coord-card">
            <h3>Bandeja de programas externos</h3>
            {programas.length === 0 ? (
              <div className="coord-empty-state">
                Sin expedientes de Servicio Social o Practicas pendientes de revision.
              </div>
            ) : (
              <div className="coord-list">
                {programas.map((programa) => (
                  <button
                    key={programa.id_programa}
                    type="button"
                    className={selectedPrograma?.id_programa === programa.id_programa ? 'coord-list-item is-selected' : 'coord-list-item'}
                    onClick={() => {
                      setSelectedPrograma(programa);
                      programaForm.reset({
                        expediente_id: String(programa.id_programa),
                        tipo_programa: programa.tipo_programa,
                        estatus: toUiProgramaStatus(programa.estatus),
                        oficio_liberacion: programa.oficio_liberacion || '',
                        horas_concluidas: programa.horas_concluidas ?? '',
                        observaciones: programa.observaciones || '',
                      });
                    }}
                  >
                    <strong>{programa.alumno?.usuario?.nombre_completo || `Alumno ${programa.id_alumno}`}</strong>
                    <span>{programa.tipo_programa}</span>
                    <span>{programa.estatus}</span>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="coord-card">
            <h3>Actualizacion de estatus y liberacion</h3>
            <form className="form-grid" onSubmit={programaForm.handleSubmit(submitPrograma)}>
              <fieldset className="coord-fieldset" disabled={!selectedPrograma || loading || sending}>
                <label htmlFor="coord-prg-exp">Expediente</label>
                <select id="coord-prg-exp" {...programaForm.register('expediente_id')}>
                  <option value="">Selecciona expediente</option>
                  {programas.map((programa) => (
                    <option key={`p-${programa.id_programa}`} value={String(programa.id_programa)}>
                      {`#${programa.id_programa} · ${programa.alumno?.usuario?.nombre_completo || `Alumno ${programa.id_alumno}`}`}
                    </option>
                  ))}
                </select>

                <label htmlFor="coord-prg-tipo">Tipo programa</label>
                <select id="coord-prg-tipo" {...programaForm.register('tipo_programa')}>
                  <option value="servicio_social">Servicio social</option>
                  <option value="practicas_profesionales">Practicas profesionales</option>
                </select>

                <label htmlFor="coord-prg-estatus">Estatus</label>
                <select id="coord-prg-estatus" {...programaForm.register('estatus')}>
                  {programaStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>

                <label htmlFor="coord-prg-oficio">Oficio/Documento de liberacion</label>
                <input id="coord-prg-oficio" placeholder="OF-SS-2026-123" {...programaForm.register('oficio_liberacion')} />
                {programaForm.formState.errors.oficio_liberacion ? <small>{programaForm.formState.errors.oficio_liberacion.message}</small> : null}

                <label htmlFor="coord-prg-horas">Horas concluidas</label>
                <input id="coord-prg-horas" type="number" min="0" step="1" {...programaForm.register('horas_concluidas')} />
                {programaForm.formState.errors.horas_concluidas ? <small>{programaForm.formState.errors.horas_concluidas.message}</small> : null}

                <label htmlFor="coord-prg-obs">Observaciones</label>
                <textarea id="coord-prg-obs" className="coord-textarea" rows="3" {...programaForm.register('observaciones')} />

                <button type="submit" className="btn-secondary" disabled={loading || sending || !selectedPrograma}>
                  {sending ? 'Actualizando...' : 'Actualizar expediente'}
                </button>
              </fieldset>
            </form>
          </article>
        </div>
      ) : null}

      {activeTab === 'progreso' ? (
        <div className="coord-grid-2 coord-progreso-grid">
          <article className="coord-card">
            <h3>Asignar merito academico</h3>
            <form className="form-grid" onSubmit={meritoForm.handleSubmit(submitMerito)}>
              <label htmlFor="coord-merito-alumno">Alumno</label>
              <select id="coord-merito-alumno" {...meritoForm.register('alumno_id')}>
                <option value="">Selecciona alumno</option>
                {alumnos.map((alumno) => (
                  <option key={`m-a-${alumno.id_alumno}`} value={String(alumno.id_alumno)}>
                    {`${alumno.folio_matricula || 'SIN-FOLIO'} · ${alumno.nombre_completo}`}
                  </option>
                ))}
              </select>

              <label htmlFor="coord-merito-tipo">Tipo de distincion</label>
              <select id="coord-merito-tipo" {...meritoForm.register('tipo_merito')}>
                <option value="mencion_honorifica">Mencion honorifica</option>
                <option value="insignia">Insignia academica</option>
                <option value="cuadro_honor">Cuadro de honor</option>
              </select>

              <label htmlFor="coord-merito-nombre">Descripcion del merito</label>
              <input id="coord-merito-nombre" placeholder="Cuadro de honor bimestre 4" {...meritoForm.register('nombre')} />
              {meritoForm.formState.errors.nombre ? <small>{meritoForm.formState.errors.nombre.message}</small> : null}

              <label htmlFor="coord-merito-archivo">Evidencia URL (opcional)</label>
              <input id="coord-merito-archivo" placeholder="https://..." {...meritoForm.register('archivo_url')} />

              <button type="submit" className="btn-primary" disabled={loading || sending}>
                {sending ? 'Registrando...' : 'Registrar merito'}
              </button>
            </form>
          </article>

          <article className="coord-card coord-progreso-right">
            <div>
              <h3>Progreso curricular de alumnos</h3>
              <div className="table-wrap coord-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Alumno</th>
                      <th>Carrera</th>
                      <th>Avance</th>
                      <th>Promedio global</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnosProgreso.map((item) => (
                      <tr key={`prog-${item.id_alumno}`}>
                        <td>
                          <strong>{item.nombre_completo}</strong>
                          <p>{item.folio_matricula || 'SIN-FOLIO'}</p>
                        </td>
                        <td>{item.carrera}</td>
                        <td>{`${item.porcentaje_avance}%`}</td>
                        <td>{item.promedio_global ?? 'Sin datos'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3>Meritos recientes</h3>
              {meritosRecientes.length === 0 ? (
                <p className="coord-empty-state">Sin meritos registrados recientemente.</p>
              ) : (
                <div className="coord-list">
                  {meritosRecientes.map((merito) => (
                    <div key={`mr-${merito.id_merito}`} className="coord-list-item">
                      <strong>{merito.nombre}</strong>
                      <span>{`${merito.tipo_merito} · ${merito.fecha}`}</span>
                      <span>{`${merito.alumno?.folio_matricula || 'SIN-FOLIO'} · ${merito.alumno?.nombre_completo || `Alumno ${merito.id_alumno}`}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
