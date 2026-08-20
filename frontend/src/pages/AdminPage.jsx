import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import api from '../services/api';
import './AdminPage.css';

const asignacionSchema = z.object({
  id_alumno: z.string().min(1, 'Selecciona un alumno.'),
  id_materia: z.string().min(1, 'Selecciona una materia.'),
  grupo: z.string().trim().min(1, 'Selecciona un grupo.'),
});

export default function AdminPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [alumnoQuery, setAlumnoQuery] = useState('');
  const [alumnoSuggestions, setAlumnoSuggestions] = useState([]);
  const [selectedAlumno, setSelectedAlumno] = useState(null);
  const [materias, setMaterias] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [gruposPorMateria, setGruposPorMateria] = useState({});

  const asignacionForm = useForm({
    resolver: zodResolver(asignacionSchema),
    defaultValues: {
      id_alumno: '',
      id_materia: '',
      grupo: '',
    },
  });

  const selectedMateria = asignacionForm.watch('id_materia');
  const gruposDisponibles = useMemo(() => {
    if (selectedMateria && gruposPorMateria[selectedMateria]) {
      return gruposPorMateria[selectedMateria];
    }
    return grupos;
  }, [selectedMateria, gruposPorMateria, grupos]);

  async function loadCatalogos() {
    setCatalogLoading(true);
    setError('');

    try {
      const response = await api.get('/admin/alumno-grupos/catalogos');
      setMaterias(response?.data?.materias || []);
      setGrupos(response?.data?.grupos || []);
      setGruposPorMateria(response?.data?.grupos_por_materia || {});
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudieron cargar los catalogos de asignacion.');
    } finally {
      setCatalogLoading(false);
    }
  }

  async function buscarAlumnos(query) {
    setSearchLoading(true);

    try {
      const response = await api.get('/admin/alumno-grupos/buscar-alumnos', {
        params: { q: query.trim() },
      });
      setAlumnoSuggestions(response?.data?.items || []);
    } catch {
      setAlumnoSuggestions([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadAsignaciones(query = '') {
    setLoading(true);
    setError('');

    try {
      const params = {};
      if (query.trim()) params.q = query.trim();

      const response = await api.get('/admin/alumno-grupos', { params });
      setItems(response.data.items || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo consultar alumno-grupos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAsignaciones('');
    loadCatalogos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadAsignaciones(search);
    }, 280);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const trimmed = alumnoQuery.trim();
    if (trimmed.length < 2) {
      setAlumnoSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      buscarAlumnos(trimmed);
    }, 280);

    return () => clearTimeout(timeoutId);
  }, [alumnoQuery]);

  useEffect(() => {
    if (!selectedMateria) return;
    const selectedGrupo = asignacionForm.getValues('grupo');
    if (!selectedGrupo) return;

    const hasGroupInMateria = (gruposPorMateria[selectedMateria] || [])
      .some((item) => item.grupo === selectedGrupo);
    if (!hasGroupInMateria) {
      asignacionForm.setValue('grupo', '');
    }
  }, [selectedMateria, gruposPorMateria, asignacionForm]);

  async function handleSave(values) {
    setSending(true);
    setError('');
    setMessage('');

    try {
      await api.post('/admin/alumno-grupos', {
        id_alumno: Number(values.id_alumno),
        id_materia: Number(values.id_materia),
        grupo: values.grupo.trim(),
      });

      setMessage('Asignacion guardada correctamente.');
      asignacionForm.reset({ id_alumno: '', id_materia: '', grupo: '' });
      setAlumnoQuery('');
      setSelectedAlumno(null);
      setAlumnoSuggestions([]);
      await loadAsignaciones(search);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo guardar la asignacion.');
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(idAlumno, idMateria) {
    setError('');
    setMessage('');

    try {
      await api.delete(`/admin/alumno-grupos/${idAlumno}/${idMateria}`);
      setMessage('Asignacion eliminada.');
      await loadAsignaciones(search);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No se pudo eliminar la asignacion.');
    }
  }

  return (
    <section className="card admin-panel admin-page admin-alumno-page">
      <h2>Panel Administrativo - Alumno Grupo</h2>
      <p>Gestion de altas, actualizaciones y bajas de asignacion por materia y grupo.</p>

      <form className="form-grid" onSubmit={asignacionForm.handleSubmit(handleSave)}>
        <h3>Asignar o actualizar</h3>

        <label>
          Alumno
          <input
            id="asignacion-id-alumno"
            name="alumno_search"
            type="text"
            value={alumnoQuery}
            onChange={(event) => {
              setAlumnoQuery(event.target.value);
              if (selectedAlumno) {
                setSelectedAlumno(null);
                asignacionForm.setValue('id_alumno', '');
              }
            }}
            placeholder="Busca por matricula o nombre"
            autoComplete="off"
          />
          {searchLoading ? <small>Buscando alumnos...</small> : null}
          {!selectedAlumno && alumnoSuggestions.length > 0 ? (
            <div className="admin-combobox-list" role="listbox" aria-label="Resultados de alumnos">
              {alumnoSuggestions.map((alumno) => (
                <button
                  key={alumno.id_alumno}
                  type="button"
                  className="admin-combobox-option"
                  onClick={() => {
                    setSelectedAlumno(alumno);
                    setAlumnoQuery(alumno.label);
                    asignacionForm.setValue('id_alumno', String(alumno.id_alumno), { shouldValidate: true });
                    setAlumnoSuggestions([]);
                  }}
                >
                  {alumno.label}
                </button>
              ))}
            </div>
          ) : null}
          {selectedAlumno ? <small>{`Seleccionado: ${selectedAlumno.label}`}</small> : null}
          <input type="hidden" {...asignacionForm.register('id_alumno')} />
          {asignacionForm.formState.errors.id_alumno ? <small>{asignacionForm.formState.errors.id_alumno.message}</small> : null}
        </label>

        <label>
          Materia
          <select id="asignacion-id-materia" {...asignacionForm.register('id_materia')} disabled={catalogLoading}>
            <option value="">Selecciona materia activa</option>
            {materias.map((materia) => (
              <option key={materia.id_materia} value={String(materia.id_materia)}>
                {`${materia.nombre_materia} (${materia.codigo_materia || 'SIN-CODIGO'})`}
              </option>
            ))}
          </select>
          {asignacionForm.formState.errors.id_materia ? <small>{asignacionForm.formState.errors.id_materia.message}</small> : null}
        </label>

        <label>
          Grupo
          <select id="asignacion-grupo" {...asignacionForm.register('grupo')} disabled={catalogLoading || gruposDisponibles.length === 0}>
            <option value="">Selecciona grupo</option>
            {gruposDisponibles.map((item) => (
              <option key={`${item.id_materia}-${item.grupo}`} value={item.grupo}>
                {item.grupo}
              </option>
            ))}
          </select>
          {asignacionForm.formState.errors.grupo ? <small>{asignacionForm.formState.errors.grupo.message}</small> : null}
        </label>

        <button type="submit" className="btn-primary" disabled={loading || sending || catalogLoading}>
          {sending ? 'Guardando...' : 'Guardar asignacion'}
        </button>
      </form>

      <div className="form-grid admin-search-wrap">
        <h3>Busqueda en tiempo real</h3>
        <label>
          Buscar asignaciones
          <input
            id="filtro-global"
            name="filtro_global"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, matricula, materia, codigo o grupo"
          />
        </label>
      </div>

      {message ? <p className="ok-box">{message}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}

      <div className="table-wrap dark-table admin-alumno-table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Alumno</th>
              <th>Materia</th>
              <th>Grupo</th>
              <th>Fecha Alta</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6">Cargando...</td>
              </tr>
            ) : null}

            {!loading && items.length === 0 ? (
              <tr>
                <td colSpan="6">Sin resultados.</td>
              </tr>
            ) : null}

            {!loading
              ? items.map((item) => (
                <tr key={item.id_alumno_grupo}>
                  <td>{item.id_alumno_grupo}</td>
                  <td>{item.alumno?.usuario ? `${item.alumno.usuario.folio_matricula || 'SIN-FOLIO'} · ${item.alumno.usuario.nombre_completo}` : item.id_alumno}</td>
                  <td>{item.materia ? `${item.materia.nombre_materia} (${item.materia.codigo_materia || 'SIN-CODIGO'})` : item.id_materia}</td>
                  <td>{item.grupo}</td>
                  <td>{new Date(item.fecha_alta).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-danger-sm"
                      onClick={() => handleDelete(item.id_alumno, item.id_materia)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
